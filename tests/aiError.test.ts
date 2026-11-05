import { afterEach, describe, expect, it, vi } from "vitest";
import { AiError, logAiFailure, sanitize, toAiError } from "@/lib/aiError";
import { explain } from "@/lib/ai";

const sip = { amount: 1000, month: 4, totalMonths: 12, status: "active" };

afterEach(() => vi.restoreAllMocks());

describe("safe failure logging", () => {
  it("logs type, status and provider message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logAiFailure("explain", new AiError("http", 404, "No endpoints found for model x"));
    const line = String(spy.mock.calls[0][0]);
    expect(line).toContain('"type":"http"');
    expect(line).toContain('"status":404');
    expect(line).toContain("No endpoints found");
  });

  it("never logs keys, bearer tokens or the user's text", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.AI_API_KEY = "sk-or-v1-SECRETSECRETSECRET123456";
    const call = async () => {
      throw new AiError("http", 401, "Invalid key sk-or-v1-SECRETSECRETSECRET123456 Bearer sk-or-v1-SECRETSECRETSECRET123456");
    };
    await explain("my private salary story 98765", sip, call);
    const all = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(all).not.toContain("SECRETSECRET");
    expect(all).not.toContain("private salary story");
    expect(all).toContain("[redacted]");
    delete process.env.AI_API_KEY;
  });

  it("sanitize caps length and redacts long tokens", () => {
    expect(sanitize("x".repeat(500)).length).toBeLessThanOrEqual(200);
    expect(sanitize("token abcdefghijklmnopqrstuvwxyz0123456789ABCD")).toContain("[redacted]");
  });

  it("classifies thrown values", () => {
    const abort = new Error("x"); abort.name = "AbortError";
    expect(toAiError(abort).type).toBe("timeout");
    expect(toAiError(new TypeError("fetch failed")).type).toBe("network");
    expect(toAiError(new SyntaxError("bad json")).type).toBe("parse");
  });
});

describe("fallback causes are kept separate", () => {
  const good = (over: object) => async () => ({ reason: "salary_late", confidence: 0.9, language: "en", explanation: "Your sample SIP is active.", ...over });

  it("service failures are cause=service", async () => {
    for (const err of [new AiError("http", 401, "bad key"), new AiError("network"), new AiError("parse"), new AiError("config")]) {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const r = await explain("salary is late", sip, async () => { throw err; });
      expect(r).toMatchObject({ kind: "fallback", cause: "service" });
    }
  });
  it("unsure is cause=unsure", async () => {
    expect(await explain("hmm", sip, good({ confidence: 0.2 }))).toMatchObject({ kind: "fallback", cause: "unsure" });
  });
  it("advice questions decline with fixed text and never name a fund or return", async () => {
    const r = await explain("Which fund should I buy?", sip, good({ reason: "wants_advice", explanation: "Buy HDFC fund for 12% returns" }));
    expect(r.kind).toBe("decline");
    if (r.kind === "decline") expect(r.explanation).not.toMatch(/hdfc|12%|returns/i);
  });
  it("a PAN is blocked before any model call and not repeated back", async () => {
    let called = false;
    const r = await explain("My PAN is ABCDE1234F", sip, async () => { called = true; return {}; });
    expect(called).toBe(false);
    expect(JSON.stringify(r)).not.toContain("ABCDE1234F");
  });
});
