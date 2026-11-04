/** Illustrative sample price series for the prototype. Not real fund performance. */
export const RANGES = { "1M": 12, "6M": 40, "1Y": 70, "3Y": 140, All: 180 } as const;
export type Range = keyof typeof RANGES;

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic wandering series that goes up and down, seeded by the fund id. */
export function samplePrices(seed: string, n: number = RANGES.All): number[] {
  const rand = mulberry32(hash(seed));
  const out: number[] = [];
  let p = 10;
  for (let i = 0; i < n; i++) {
    p *= 1 + (rand() - 0.5) * 0.07 + 0.0015;
    out.push(Math.round(p * 100) / 100);
  }
  return out;
}

export function slicePrices(prices: number[], range: Range): number[] {
  return prices.slice(-RANGES[range]);
}

/** SVG polyline path for a series in a w x h box with padding. */
export function toPath(values: number[], w: number, h: number, pad = 8): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
