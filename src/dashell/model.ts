import { safeFolder, safeUrl, allowedExtensions } from "./safety";

export type Kind = "article" | "book" | "audio" | "video";
export type Mode = "original" | "translation" | "rewrite";
export interface Asset {
  url: string;
  extension: string;
  role: "main" | "subtitle" | "transcript";
  required: boolean;
  bytes?: number;
}
export interface SourceMetadata {
  id?: string;
  language?: string;
  level?: string;
  assets?: Asset[];
  translation?: string;
  rewrite?: string;
}
export interface Session {
  started: number;
  completed?: number;
}
export interface Material {
  id: string;
  title: string;
  link: string;
  kind: Kind;
  content: string;
  translation?: string;
  rewrite?: string;
  published: string;
  language: string;
  level: string;
  assets: Asset[];
  localPath?: string;
  localFiles?: string[];
  download: "idle" | "queued" | "downloading" | "ready" | "failed";
  error?: string;
  sessions: Session[];
}
export interface Preferences {
  folder: string;
  maxFileMB: number;
}
export interface State {
  schemaVersion: 1;
  preferences: Preferences;
  materials: Material[];
}

export function emptyState(): State {
  return {
    schemaVersion: 1,
    preferences: { folder: "Dashell/Materials", maxFileMB: 64 },
    materials: [],
  };
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("数据格式无效。");
  return value as Record<string, unknown>;
}
export function string(value: unknown, max = 1000000): string {
  if (typeof value !== "string" || value.length > max)
    throw new Error("数据字段格式无效。");
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new Error("数据列表格式无效。");
  return value.map((item) => string(item, 300));
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("数据状态格式无效。");
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("数据数值无效。");
  return value;
}
function path(value: unknown): string {
  return safeFolder(string(value, 300));
}
function url(value: unknown): string {
  const result = safeUrl(string(value, 8000));
  if (!result) throw new Error("数据链接格式无效。");
  return result;
}
export function readAsset(value: unknown): Asset {
  const item = record(value);
  const role = item.role;
  const extension = string(item.extension, 12);
  if (
    !["main", "subtitle", "transcript"].includes(String(role)) ||
    !allowedExtensions.has(extension)
  )
    throw new Error("素材清单格式无效。");
  return {
    url: url(item.url),
    role: role as Asset["role"],
    extension,
    required: boolean(item.required),
    ...(item.bytes === undefined ? {} : { bytes: number(item.bytes) }),
  };
}
function readMaterial(value: unknown): Material {
  const item = record(value);
  const kind = string(item.kind, 20);
  const download = string(item.download, 20);
  if (
    !["article", "book", "audio", "video"].includes(kind) ||
    !["idle", "queued", "downloading", "ready", "failed"].includes(download)
  )
    throw new Error("素材状态无效。");
  if (
    !Array.isArray(item.assets) ||
    !Array.isArray(item.sessions) ||
    item.assets.length > 20
  )
    throw new Error("素材清单无效。");
  return {
    id: string(item.id, 100),
    title: string(item.title, 2000),
    link: item.link ? url(item.link) : "",
    kind: kind as Kind,
    content: string(item.content),
    published: string(item.published, 100),
    language: string(item.language, 100),
    level: string(item.level, 100),
    assets: item.assets.map(readAsset),
    download: download as Material["download"],
    sessions: item.sessions.map((value) => {
      const session = record(value);
      return {
        started: number(session.started),
        ...(session.completed === undefined
          ? {}
          : { completed: number(session.completed) }),
      };
    }),
    ...(item.translation === undefined
      ? {}
      : { translation: string(item.translation) }),
    ...(item.rewrite === undefined ? {} : { rewrite: string(item.rewrite) }),
    ...(item.localPath === undefined
      ? {}
      : { localPath: path(item.localPath) }),
    ...(item.localFiles === undefined
      ? {}
      : { localFiles: strings(item.localFiles).map(path) }),
    ...(item.error === undefined ? {} : { error: string(item.error, 500) }),
  };
}
export function readState(value: unknown): State {
  if (value === null || value === undefined) return emptyState();
  const data = record(value);
  if (data.schemaVersion !== 1)
    throw new Error("数据版本不受支持；为保护现有记录，插件未覆盖配置。");
  if (!Array.isArray(data.materials))
    throw new Error("记录格式无效；现有配置已保留。");
  const prefs = record(data.preferences);
  const maxFileMB = number(prefs.maxFileMB);
  if (maxFileMB < 1 || maxFileMB > 512) throw new Error("设置格式无效。");
  return {
    schemaVersion: 1,
    preferences: { folder: path(prefs.folder), maxFileMB },
    materials: data.materials.map(readMaterial),
  };
}
