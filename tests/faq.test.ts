import { describe, expect, it } from "vitest";
import { answer, faqText, SUGGESTED, type FaqId } from "@/lib/faq";
import { checkOutput } from "@/lib/safety";

const ctx = { name: "Sample Flexi Cap Fund", category: "Flexi Cap", about: "A flexi cap fund can hold companies of different sizes.", min: 100, risk: "Very High", reasonNote: "my first bike" };

describe("fund help answers", () => {
  const ids: FaqId[] = ["what", "sip", "min", "risk", "stop", "tough", "why", "advice"];
  for (const id of ids) {
    it(`${id} passes the output safety check`, () => expect(checkOutput(faqText(id, ctx)).ok).toBe(true));
  }
  it("every suggested chip gets an answer", () => {
    for (const s of SUGGESTED) expect(answer(s.label, ctx).kind).toBe("answer");
  });
  it("declines advice and return questions", () => {
    for (const q of ["which fund is best?", "will it give good returns", "should I buy this", "kitna munafa milega"]) {
      expect(answer(q, ctx).kind).toBe("decline");
    }
  });
  it("blocks PAN-like input", () => expect(answer("my pan is ABCDE1234F", ctx).kind).toBe("blocked"));
  it("handles unknown questions", () => expect(answer("xyzzy", ctx).kind).toBe("unknown"));
  it("never promises results or uses urgency", () => {
    const t = faqText("why", ctx).toLowerCase();
    for (const bad of ["guarantee", "hurry", "last chance", "don't miss", "% "]) expect(t).not.toContain(bad);
  });
});

import { answerWithAi } from "@/lib/faqAi";

describe("AI help matching", () => {
  const pick = (id: string, confidence = 0.9) => async () => ({ id, confidence });
  it("uses the AI pick but returns fixed text", async () => {
    const r = await answerWithAi("kya paisa kam hoga to?", ctx, pick("tough"));
    expect(r.viaAi).toBe(true);
    expect(r.kind).toBe("answer");
    expect(r.text).toBe(faqText("tough", ctx));
  });
  it("declines when the AI flags advice", async () => {
    const r = await answerWithAi("tell me something", ctx, pick("advice"));
    expect(r.kind).toBe("decline");
  });
  it("falls back to keywords on low confidence, bad output or error", async () => {
    for (const call of [pick("tough", 0.2), async () => ({ nope: 1 }), async () => { throw new Error("x"); }]) {
      const r = await answerWithAi("what is the minimum?", ctx, call);
      expect(r.viaAi).toBe(false);
      expect(r.kind).toBe("answer");
    }
  });
  it("blocks PAN-like input before calling the model", async () => {
    let called = false;
    const r = await answerWithAi("ABCDE1234F", ctx, async () => { called = true; return {}; });
    expect(r.kind).toBe("blocked");
    expect(called).toBe(false);
  });
});
