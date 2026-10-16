export function bindWorkbenchHotkeys(root: HTMLElement, actions: Record<string, () => void>): () => void {
  const handler = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")) return;
    const action = actions[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    action();
  };
  root.addEventListener("keydown", handler);
  return () => root.removeEventListener("keydown", handler);
}
