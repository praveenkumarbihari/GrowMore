import { describe, expect, it } from "vitest";
import { RANGES, samplePrices, slicePrices, toPath } from "@/lib/chart";

describe("sample chart data", () => {
  it("is deterministic per seed and differs between seeds", () => {
    expect(samplePrices("f1")).toEqual(samplePrices("f1"));
    expect(samplePrices("f1")).not.toEqual(samplePrices("f2"));
  });
  it("has the full length and only positive values", () => {
    const p = samplePrices("f3");
    expect(p).toHaveLength(RANGES.All);
    expect(p.every((v) => v > 0)).toBe(true);
  });
  it("is not a straight line up: it has falls as well as rises", () => {
    const p = samplePrices("f1");
    expect(p.some((v, i) => i > 0 && v < p[i - 1])).toBe(true);
  });
  it("slices ranges from the end", () => {
    const p = samplePrices("f1");
    expect(slicePrices(p, "1M")).toEqual(p.slice(-RANGES["1M"]));
  });
  it("builds a path", () => {
    expect(toPath([1, 2, 3], 100, 50)).toMatch(/^M[\d.]+ [\d.]+ L/);
    expect(toPath([1], 100, 50)).toBe("");
  });
});
