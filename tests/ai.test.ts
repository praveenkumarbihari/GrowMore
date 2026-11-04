import { describe, expect, it } from "vitest";
import { explain } from "@/lib/ai";
import { checkInput, checkOutput } from "@/lib/safety";
import { allow } from "@/lib/ratelimit";

const sip = { amount: 1000, month: 4, totalMonths: 12, status: "active" };
const good = (over: object = {}) => async () => ({
  reason: "salary_late", confidence: 0.9, language: "en",
  explanation: "Your SIP is active at 1000 rupees a month, in month 4 of 12.", ...over,
});

describe("input check", () => {
  it("blocks PAN-like", () => expect(checkInput("my pan ABCDE1234F").ok).toBe(false));
  it("blocks long account numbers", () => expect(checkInput("acct 123456789012").ok).toBe(false));
  it("allows normal text", () => expect(checkInput("salary is late").ok).toBe(true));
  it("rejects empty", () => expect(checkInput("   ").ok).toBe(false));
});

describe("output check", () => {
  for (const bad of ["guaranteed growth", "Hurry up", "Last chance", "don't miss out", "you should continue", "HDFC fund", "earn 12% returns"]) {
    it(`blocks: ${bad}`, () => expect(checkOutput(bad).ok).toBe(false));
  }
  it("allows plain status", () => expect(checkOutput("Your SIP is active in month 4 of 12.").ok).toBe(true));
});

describe("explain pipeline", () => {
  it("normal case", async () => expect((await explain("salary late", sip, good())).kind).toBe("ok"));
  it("hindi", async () =>
    expect((await explain("सैलरी देर से आई", sip, good({ language: "hi", explanation: "आपकी SIP चालू है।" }))).kind).toBe("ok"));
  it("hinglish", async () =>
    expect((await explain("salary late hai", sip, good({ language: "hinglish", explanation: "Aapki SIP active hai." }))).kind).toBe("ok"));
  it("advice declines with fixed text", async () => {
    const r = await explain("which fund?", sip, good({ reason: "wants_advice", explanation: "Buy XYZ fund" }));
    expect(r.kind).toBe("decline");
    if (r.kind === "decline") expect(r.explanation).not.toContain("XYZ");
  });
  it("unclear low confidence falls back", async () =>
    expect(await explain("hmm", sip, good({ reason: "unclear", confidence: 0.3 }))).toEqual({ kind: "fallback", why: "low_confidence" }));
  it("bad schema falls back", async () =>
    expect(await explain("x y", sip, async () => ({ reason: "nope" }))).toEqual({ kind: "fallback", why: "schema" }));
  it("over 40 words falls back", async () =>
    expect((await explain("x y", sip, good({ explanation: "word ".repeat(41) }))).kind).toBe("fallback"));
  it("unsafe output falls back", async () =>
    expect(await explain("x y", sip, good({ explanation: "This is guaranteed to help." }))).toEqual({ kind: "fallback", why: "unsafe_output" }));
  it("timeout falls back", async () =>
    expect(await explain("x y", sip, async () => { const e = new Error("t"); e.name = "AbortError"; throw e; })).toEqual({ kind: "fallback", why: "timeout" }));
  it("model error falls back", async () =>
    expect(await explain("x y", sip, async () => { throw new Error("http_500"); })).toEqual({ kind: "fallback", why: "error" }));
  it("blocked input never calls the model", async () => {
    let called = false;
    const r = await explain("ABCDE1234F", sip, async () => { called = true; return {}; });
    expect(r.kind).toBe("blocked");
    expect(called).toBe(false);
  });
});

describe("rate limit", () => {
  it("blocks the 21st call in a window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i++) expect(allow("1.1.1.1", now)).toBe(true);
    expect(allow("1.1.1.1", now)).toBe(false);
    expect(allow("2.2.2.2", now)).toBe(true);
  });
});

import { extractText, parseJsonText } from "@/lib/ai";

describe("model reply parsing", () => {
  const json = '{"reason":"salary_late","confidence":0.9,"language":"en","explanation":"ok"}';
  it("reads a Responses API reply", () => {
    const data = { output: [{ type: "reasoning", content: [{ text: "ignore" }] }, { type: "message", content: [{ type: "output_text", text: json }] }] };
    expect(extractText(data)).toBe(json);
  });
  it("reads output_text and chat completions replies", () => {
    expect(extractText({ output_text: json })).toBe(json);
    expect(extractText({ choices: [{ message: { content: json } }] })).toBe(json);
    expect(extractText({})).toBe("");
  });
  it("parses JSON wrapped in code fences", () => {
    expect(parseJsonText("```json\n" + json + "\n```")).toMatchObject({ reason: "salary_late" });
  });
});
