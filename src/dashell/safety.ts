export function safeUrl(value: string, base?: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function safeFolder(value: string): string {
  const path = value.trim().replace(/\\/g, "/");
  const parts = path.split("/");
  if (
    !path ||
    path.length > 300 ||
    parts.some(
      (part) =>
        !part ||
        part.startsWith(".") ||
        /[<>:"|?*]/.test(part) ||
        Array.from(part).some((char) => char.charCodeAt(0) < 32) ||
        /[. ]$/.test(part),
    )
  ) {
    throw new Error(
      "请选择库内普通文件夹，不能使用绝对路径、隐藏目录或上级路径。",
    );
  }
  return path;
}

export const allowedExtensions = new Set([
  "epub",
  "pdf",
  "md",
  "txt",
  "html",
  "mp3",
  "m4a",
  "wav",
  "ogg",
  "flac",
  "mp4",
  "webm",
  "mov",
  "mkv",
  "srt",
  "vtt",
]);

export function resourceName(role: string, extension: string): string {
  if (!allowedExtensions.has(extension))
    throw new Error("素材文件类型暂不支持。");
  return `${role === "transcript" ? "transcript" : "material"}.${extension}`;
}

export function extensionFor(url: string, mime = ""): string {
  const byMime: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "application/pdf": "pdf",
    "application/epub+zip": "epub",
    "text/vtt": "vtt",
    "application/x-subrip": "srt",
  };
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? "";
  const result = allowedExtensions.has(extension)
    ? extension
    : byMime[mime.toLowerCase()];
  if (!result) throw new Error("下载链接缺少可识别的文件格式。");
  return result;
}

export async function stableId(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function displayError(error: unknown): string {
  // Never display raw network exceptions: they may contain signed/private feed URLs.
  return error instanceof UserError
    ? error.message
    : "操作未完成，请检查网络、库目录权限后重试。";
}
export class UserError extends Error {}
