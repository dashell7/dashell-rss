// Adapted from Qiaomu AI RSS 0.29.2 (0133ff2), GPL-3.0-only.
/** Variable heights with prefix sums, independent of the number of mounted rows. */
export class ListWindow {
  private ids: string[] = [];
  private positions = new Map<string, number>();
  private sizes = new Map<string, number>();
  private tree = new Float64Array(1);
  private heights: number[] = [];
  constructor(private estimate = 130) {}

  setItems(ids: string[]): void {
    if (ids.length === this.ids.length && ids.every((id, i) => id === this.ids[i])) return;
    this.ids = [...ids];
    this.positions = new Map(ids.map((id, i) => [id, i]));
    this.sizes = new Map([...this.sizes].filter(([id]) => this.positions.has(id)));
    this.tree = new Float64Array(ids.length + 1);
    this.heights = ids.map(id => this.sizes.get(id) ?? this.estimate);
    for (let i = 1; i < this.tree.length; i++) {
      this.tree[i] = (this.tree[i] ?? 0) + (this.heights[i - 1] ?? 0);
      const parent = i + (i & -i);
      if (parent < this.tree.length) this.tree[parent] = (this.tree[parent] ?? 0) + (this.tree[i] ?? 0);
    }
  }
  offset(index: number): number {
    let value = 0;
    for (let i = Math.min(index, this.ids.length); i > 0; i -= i & -i) value += this.tree[i] ?? 0;
    return value;
  }
  get total(): number { return this.offset(this.ids.length); }
  indexAt(top: number): number {
    let lo = 0, hi = this.ids.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.offset(mid + 1) <= top) lo = mid + 1;
      else hi = mid;
    }
    return Math.min(lo, Math.max(0, this.ids.length - 1));
  }
  idAt(index: number): string | undefined { return this.ids[index]; }
  position(id: string): number | undefined { return this.positions.get(id); }
  measure(id: string, height: number): boolean {
    const index = this.positions.get(id);
    const previous = index === undefined ? undefined : this.heights[index];
    if (index === undefined || previous === undefined || !Number.isFinite(height) || height <= 0 || Math.abs(previous - height) < 0.5) return false;
    const delta = height - previous;
    for (let i = index + 1; i < this.tree.length; i += i & -i) this.tree[i] = (this.tree[i] ?? 0) + delta;
    this.heights[index] = height;
    this.sizes.set(id, height);
    return true;
  }
  range(top: number, viewport: number): { start: number; end: number; before: number; after: number } {
    const start = Math.max(0, this.indexAt(Math.max(0, top)) - 6);
    const end = Math.min(this.ids.length, Math.max(start + 1, this.indexAt(top + viewport) + 7));
    return { start, end, before: this.offset(start), after: this.total - this.offset(end) };
  }
  clearMeasurements(): void {
    const ids = this.ids;
    this.ids = [];
    this.sizes.clear();
    this.setItems(ids);
  }
}
