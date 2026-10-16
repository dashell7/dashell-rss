import { describe, expect, it } from "vitest";
import { ListWindow } from "../../../src/dashell/list-window";

describe("variable-height article positions", () => {
  it("finds a bounded window far into a large library", () => {
    const list = new ListWindow(100);
    list.setItems(Array.from({ length: 10000 }, (_, i) => String(i)));
    expect(list.total).toBe(1000000);
    const range = list.range(800000, 400);
    expect(range.start).toBe(7994);
    expect(range.end).toBe(8011);
    expect(range.before + range.after + (range.end - range.start) * 100).toBe(list.total);
  });
  it("keeps measured heights by identity through insertion and reorder", () => {
    const ids = ["a", "b", "c"];
    const list = new ListWindow(100);
    list.setItems(ids);
    list.measure("b", 240);
    ids.unshift("new");
    list.setItems(ids);
    expect(list.offset(3)).toBe(440);
    list.setItems(["c", "b"]);
    expect(list.total).toBe(340);
    expect(list.indexAt(101)).toBe(1);
    list.clearMeasurements();
    expect(list.total).toBe(200);
  });
  it("ignores invalid sizes and supports empty lists", () => {
    const list = new ListWindow();
    list.setItems(["a"]);
    for (const size of [0, -1, NaN, Infinity]) expect(list.measure("a", size)).toBe(false);
    expect(list.measure("missing", 50)).toBe(false);
    list.setItems([]);
    expect(list.range(0, 400)).toEqual({ start: 0, end: 0, before: 0, after: 0 });
    expect(list.idAt(0)).toBeUndefined();
  });
});
