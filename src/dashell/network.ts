import { requestUrl, type RequestUrlResponse } from "obsidian";
import { safeUrl, UserError } from "./safety";

export interface Network {
  text(url: string): Promise<string>;
  binary(url: string, limit: number): Promise<ArrayBuffer>;
}
async function response(url: string): Promise<RequestUrlResponse> {
  if (!safeUrl(url)) throw new UserError("网络链接无效。");
  let timer: number | undefined;
  try {
    const result = await Promise.race([
      requestUrl({ url, throw: false }),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(
          () => reject(new UserError("请求超时，请重试。")),
          45000,
        );
      }),
    ]);
    if (result.status === 401 || result.status === 403)
      throw new UserError("素材源拒绝访问，请检查授权或更新订阅链接。");
    if (result.status < 200 || result.status >= 300)
      throw new UserError(`素材源返回错误（${result.status}），请稍后重试。`);
    return result;
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}
export const network: Network = {
  async text(url) {
    const result = await response(url);
    if (result.arrayBuffer.byteLength > 5 * 1024 * 1024)
      throw new UserError("订阅内容超过 5 MB。");
    return result.text;
  },
  async binary(url, limit) {
    const result = await response(url);
    if (!result.arrayBuffer.byteLength) throw new UserError("下载文件为空。");
    if (result.arrayBuffer.byteLength > limit)
      throw new UserError("文件超过设置中的大小限制。");
    return result.arrayBuffer;
  },
};
// requestUrl buffers the response and has no AbortSignal. Cancellation invalidates
// the task before any later vault write; it cannot stop bytes already in flight.
