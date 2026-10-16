import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from "obsidian";

type Transport = (request: RequestUrlParam) => Promise<RequestUrlResponse>;
type Priority = 0 | 1 | 2;
interface Job {
  request: RequestUrlParam;
  priority: Priority;
  resolve: (response: RequestUrlResponse) => void;
  reject: (error: Error) => void;
  timer: number;
  retryTimer?: number;
  settled: boolean;
  attempted: boolean;
  key: string;
}
interface OriginHealth { until: number; failures: number }
const TIMEOUT = 30000;
const MAX_QUEUE = 64;

function requestKey(request: RequestUrlParam): string {
  const headers = Object.entries(request.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]).sort();
  return JSON.stringify([request.url, (request.method ?? "GET").toUpperCase(), headers, request.contentType ?? ""]);
}
function originOf(url: string): string {
  try { return new URL(url).origin; } catch { return "invalid"; }
}
function retryAfter(headers: Record<string, string>): number {
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === "retry-after")?.[1];
  if (!value) return 10000;
  const seconds = Number(value);
  return Math.max(10000, Math.min(3600000, Number.isFinite(seconds) ? seconds * 1000 : (Date.parse(value) - Date.now()) || 10000));
}

/** One transport budget for feeds, article reads and images. A UI timeout does
 * not release an unabortable requestUrl slot; only the transport settlement does.
 * GET recovery is bounded and only follows a settled failure (never hedged).
 */
export class ReadRequests {
  private queue: Job[] = [];
  private jobs = new Set<Job>();
  private pending = new Map<string, { job: Job; promise: Promise<RequestUrlResponse> }>();
  private health = new Map<string, OriginHealth>();
  private active = 0;
  private backgroundActive = 0;
  private disposed = false;
  private retries: number[] = [];
  constructor(private transport: Transport, private concurrency = 8) {}

  request(request: RequestUrlParam, options: { priority?: Priority } = {}): Promise<RequestUrlResponse> {
    if (this.disposed) return Promise.reject(new Error("请求服务已关闭。"));
    const get = (request.method ?? "GET").toUpperCase() === "GET" && !request.body;
    const key = get ? requestKey(request) : "";
    const priority = options.priority ?? 1;
    const shared = key && this.pending.get(key);
    if (shared) {
      shared.job.priority = Math.min(shared.job.priority, priority) as Priority;
      this.drain();
      return shared.promise;
    }
    if (this.queue.length >= MAX_QUEUE) return Promise.reject(new Error("请求队列已满，请稍后重试。"));
    let job!: Job;
    const promise = new Promise<RequestUrlResponse>((resolve, reject) => {
      job = { request, key, priority, resolve, reject, settled: false, attempted: false, timer: 0 };
      job.timer = window.setTimeout(() => this.finish(job, new Error("请求超时，请重试。")), TIMEOUT);
    });
    this.jobs.add(job);
    if (key) this.pending.set(key, { job, promise });
    this.queue.push(job);
    this.drain();
    return promise;
  }

  dispose(): void {
    this.disposed = true;
    for (const job of this.jobs) this.finish(job, new Error("请求已取消。"));
    this.queue = [];
    this.health.clear();
  }
  private finish(job: Job, result: RequestUrlResponse | Error): void {
    if (job.settled) return;
    job.settled = true;
    window.clearTimeout(job.timer);
    if (job.retryTimer !== undefined) window.clearTimeout(job.retryTimer);
    this.jobs.delete(job);
    this.queue = this.queue.filter(queued => queued !== job);
    if (job.key && this.pending.get(job.key)?.job === job) this.pending.delete(job.key);
    if (result instanceof Error) job.reject(result); else job.resolve(result);
  }
  private drain(): void {
    if (this.disposed) return;
    this.queue.sort((a, b) => a.priority - b.priority);
    while (this.active < this.concurrency) {
      const index = this.queue.findIndex(job => job.priority < 2 || this.backgroundActive < Math.max(1, this.concurrency - 2));
      if (index < 0) break;
      const job = this.queue.splice(index, 1)[0];
      if (!job) break;
      if (job.settled) continue;
      if ((this.health.get(originOf(job.request.url))?.until ?? 0) > Date.now()) {
        this.finish(job, new Error("来源繁忙，请稍后重试。"));
        continue;
      }
      this.start(job);
    }
  }
  private start(job: Job): void {
    this.active++;
    const background = job.priority === 2;
    if (background) this.backgroundActive++;
    let transport: Promise<RequestUrlResponse>;
    try { transport = this.transport({ ...job.request, throw: false }); }
    catch (error) { transport = Promise.reject(error instanceof Error ? error : new Error("连接失败，请重试。")); }
    // Preserve the SDK error so parser diagnostics can distinguish DNS,
    // connection and certificate failures after the bounded retry.
    void transport.then(response => this.completed(job, response), (error: unknown) => this.completed(job, error instanceof Error ? error : new Error("连接失败，请重试。"))).finally(() => {
      this.active--;
      if (background) this.backgroundActive--;
      this.drain();
    });
  }
  private completed(job: Job, result: RequestUrlResponse | Error): void {
    if (this.disposed || job.settled) return;
    const origin = originOf(job.request.url);
    const status = result instanceof Error ? 0 : result.status;
    const previous = this.health.get(origin) ?? { until: 0, failures: 0 };
    const failures = status === 0 || status >= 500 ? previous.failures + 1 : 0;
    if (this.health.size >= 200 && !this.health.has(origin)) this.health.delete(this.health.keys().next().value as string);
    if (status === 429 || status === 503 || failures >= 3) {
      this.health.set(origin, { failures, until: Date.now() + (result instanceof Error ? 10000 : retryAfter(result.headers)) });
    } else {
      this.health.set(origin, { failures, until: 0 });
    }
    this.retries = this.retries.filter(time => Date.now() - time < 30000);
    if (job.key && !job.attempted && [0, 408, 502, 504].includes(status) && this.retries.length < 2 && (this.health.get(origin)?.until ?? 0) <= Date.now()) {
      job.attempted = true;
      this.retries.push(Date.now());
      job.retryTimer = window.setTimeout(() => {
        job.retryTimer = undefined;
        if (job.settled || this.disposed) return;
        this.queue.push(job);
        this.drain();
      }, 1000 + Math.random() * 1000);
    } else this.finish(job, result);
  }
}

let sharedRequests: ReadRequests | undefined;
export function readRequest(request: RequestUrlParam, options: { priority?: Priority } = {}): Promise<RequestUrlResponse> {
  sharedRequests ??= new ReadRequests(request => requestUrl(request));
  return sharedRequests.request(request, options).then(response => {
    if (request.throw !== false && response.status >= 400) throw new Error(`请求失败（${response.status}）。`);
    return response;
  });
}
export function disposeReadRequests(): void {
  sharedRequests?.dispose();
  sharedRequests = undefined;
}
