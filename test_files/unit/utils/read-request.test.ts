import { afterEach, expect, it, vi } from "vitest";
import { ReadRequests } from "../../../src/utils/read-request";
import type { RequestUrlResponse } from "obsidian";
const response = (status = 200, headers: Record<string, string> = {}): RequestUrlResponse => ({ status, headers, text: "ok", json: {}, arrayBuffer: new ArrayBuffer(0) });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("shares identical GETs while isolating headers", async () => {
  let finish!: (result: RequestUrlResponse) => void;
  const transport = vi.fn(() => new Promise<RequestUrlResponse>(resolve => { finish = resolve; }));
  const requests = new ReadRequests(transport);
  const first = requests.request({ url: "https://example.org/feed" });
  const second = requests.request({ url: "https://example.org/feed" });
  expect(transport).toHaveBeenCalledTimes(1);
  finish(response()); await Promise.all([first, second]);
  requests.dispose();
});
it("recovers a settled transient failure once and observes Retry-After without amplifying overload", async () => {
  vi.useFakeTimers();
  const transport = vi.fn().mockResolvedValueOnce(response(502)).mockResolvedValueOnce(response()).mockResolvedValueOnce(response(503, { "Retry-After": "60" }));
  const requests = new ReadRequests(transport);
  const pending = requests.request({ url: "https://example.org/feed" });
  await vi.advanceTimersByTimeAsync(2001); expect((await pending).status).toBe(200);
  expect((await requests.request({ url: "https://example.org/other" })).status).toBe(503);
  await expect(requests.request({ url: "https://example.org/another" })).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(3); requests.dispose();
});
it("reserves admission for the selected article and retains hung transport slots after UI timeout", async () => {
  vi.useFakeTimers();
  const transport = vi.fn(() => new Promise<RequestUrlResponse>(() => {}));
  const requests = new ReadRequests(transport, 4);
  const reads = Array.from({ length: 8 }, (_, index) => requests.request({ url: `https://example.org/${index}` }, { priority: 2 }).catch(() => undefined));
  expect(transport).toHaveBeenCalledTimes(2);
  reads.push(requests.request({ url: "https://example.org/selected" }, { priority: 0 }).catch(() => undefined));
  expect(transport).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(30001); await Promise.all(reads);
  expect(transport).toHaveBeenCalledTimes(3); requests.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves the transport error after its bounded retry for diagnostics", async () => {
  vi.useFakeTimers();
  const failure = new Error("net::ERR_CONNECTION_REFUSED");
  const transport = vi.fn().mockRejectedValue(failure);
  const requests = new ReadRequests(transport);
  const result = requests.request({ url: "https://example.org/feed" }).catch(error => error);
  await vi.advanceTimersByTimeAsync(2001);
  expect(await result).toBe(failure);
  expect(transport).toHaveBeenCalledTimes(2);
  requests.dispose();
});
