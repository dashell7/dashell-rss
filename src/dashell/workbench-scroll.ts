export function restoreReadingScroll(
  body: HTMLElement,
  top: number,
): () => void {
  const Observer = (body.ownerDocument.win as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  let observer: ResizeObserver | undefined;
  const events = ["wheel", "pointerdown", "touchstart", "keydown"] as const;
  const stop = () => {
    observer?.disconnect();
    observer = undefined;
    for (const event of events) body.removeEventListener(event, stop);
  };
  const apply = () => {
    if (!body.clientHeight) return;
    body.scrollTop = top;
    if (body.scrollHeight - body.clientHeight >= top || top === 0) stop();
  };
  if (Observer) {
    observer = new Observer(apply);
    observer.observe(body);
    const content = body.querySelector(".rss-reader-article-content");
    if (content) observer.observe(content);
    for (const event of events)
      body.addEventListener(event, stop, { passive: true });
  }
  apply();
  return stop;
}
