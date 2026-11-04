import { MAX_INPUT_CHARS } from "./config";

const PAN = /\b[A-Za-z]{5}\s?[0-9]{4}\s?[A-Za-z]\b/;
const LONG_DIGITS = /(?:\d[\s-]?){9,}/;

export type InputCheck = { ok: true; text: string } | { ok: false; message: string };

/** Layer 1: block PAN-like and long account-like numbers before any model call. */
export function checkInput(raw: string): InputCheck {
  const text = (raw ?? "").trim().slice(0, MAX_INPUT_CHARS);
  if (!text) return { ok: false, message: "Please tell us a little about what is going on." };
  if (PAN.test(text) || LONG_DIGITS.test(text)) {
    return {
      ok: false,
      message:
        "That looks like an ID or account number. Please don't share those here. Just tell us in words what is going on.",
    };
  }
  return { ok: true, text };
}

const BANNED_PHRASES = [
  "guaranteed", "guarantee", "hurry", "last chance", "don't miss", "dont miss", "you should",
  "you must", "act now", "limited time", "before it's too late", "missing out", "fomo",
  "we recommend", "i recommend", "best fund", "invest in", "buy ", "sell ",
  "जल्दी करें", "आखिरी मौका", "गारंटी",
];
const FUND_HOUSES = [
  "sbi", "hdfc", "icici", "axis", "nippon", "kotak", "mirae", "parag parikh", "ppfas", "uti",
  "aditya birla", "sundaram", "quant", "motilal", "dsp", "franklin", "tata", "groww", "zerodha",
  "bandhan", "canara", "edelweiss", "invesco", "hsbc", "navi", "pgim", "mahindra",
];

/** Layer 5: banned words, fund house names, return figures. */
export function checkOutput(text: string): { ok: boolean; hit?: string } {
  const t = text.toLowerCase();
  for (const p of BANNED_PHRASES) if (t.includes(p)) return { ok: false, hit: p };
  for (const f of FUND_HOUSES) {
    if (new RegExp(`(^|[^a-z])${f}([^a-z]|$)`).test(t)) return { ok: false, hit: f };
  }
  if (/\d+(\.\d+)?\s?%/.test(t) || /returns? of/.test(t)) return { ok: false, hit: "return figure" };
  return { ok: true };
}
