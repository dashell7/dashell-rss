export type ReadingFilter = "all" | "unread" | "favorites" | "later";
export interface ChannelState {
  query: string;
  filter: ReadingFilter;
  selectedId: string;
  listTop: number;
  listAnchor?: { id: string; offset: number };
  readerTop: number;
  readingMode?: "original" | "translation" | "rewrite";
}
export interface WorkspacePreferences {
  listWidth: number;
  focused: boolean;
  channel: string;
  channels: Record<string, ChannelState>;
}
export function newChannel(): ChannelState {
  return { query: "", filter: "all", selectedId: "", listTop: 0, readerTop: 0 };
}
export function listWidth(value: number): number {
  return Number.isFinite(value) ? Math.max(220, Math.min(520, value)) : 300;
}
function listAnchor(value: ChannelState["listAnchor"]): ChannelState["listAnchor"] {
  return typeof value?.id === "string" && Number.isFinite(value.offset)
    ? { id: value.id, offset: Math.max(0, value.offset) }
    : undefined;
}
export function workspacePreferences(
  value?: WorkspacePreferences,
): WorkspacePreferences {
  const channels: Record<string, ChannelState> = Object.create(null) as Record<
    string,
    ChannelState
  >;
  for (const [id, state] of Object.entries(value?.channels ?? {}).slice(-200)) {
    if (!state || typeof state !== "object") continue;
    channels[id] = {
      query: typeof state.query === "string" ? state.query.slice(0, 500) : "",
      filter: ["all", "unread", "favorites", "later"].includes(state.filter)
        ? state.filter
        : "all",
      selectedId: typeof state.selectedId === "string" ? state.selectedId : "",
      listTop: Number.isFinite(state.listTop) ? Math.max(0, state.listTop) : 0,
      listAnchor: listAnchor(state.listAnchor),
      readerTop: Number.isFinite(state.readerTop)
        ? Math.max(0, state.readerTop)
        : 0,
      readingMode: state.readingMode === "translation" || state.readingMode === "rewrite" ? state.readingMode : "original",
    };
  }
  return {
    listWidth: listWidth(value?.listWidth ?? 300),
    focused: value?.focused === true,
    channel: typeof value?.channel === "string" ? value.channel : "@all",
    channels,
  };
}
