import { describe, expect, it } from "vitest";
import {
  endHeartbeat, initialSip, optionsFor, pauseSip, resolveReturn, startHeartbeat, statusLabel, stopSip,
} from "@/lib/rules";
import { REASONS } from "@/lib/schema";

describe("options table", () => {
  const cases: [string[], string[], boolean?][] = [
    [["salary_late", "money_tight", "debit_failed", "life_event", "unclear"], ["heartbeat", "pause", "stop"]],
    [["market_worry", "returns_doubt"], ["pause", "stop", "keep"]],
    [["app_confusion"], ["help", "keep", "stop"]],
    [["wants_advice"], ["keep", "pause", "stop"], true],
    [["wants_to_exit"], ["stop", "heartbeat", "pause"]],
  ];
  for (const [reasons, expected, decline] of cases) {
    for (const r of reasons) {
      it(`${r} -> ${expected.join(", ")}`, () => {
        const p = optionsFor(r as never);
        expect(p.options).toEqual(expected);
        expect(!!p.decline).toBe(!!decline);
      });
    }
  }
  it("every reason offers Stop", () => {
    for (const r of REASONS) expect(optionsFor(r).options).toContain("stop");
  });
});

describe("status logic", () => {
  it("starts active", () => expect(initialSip().status).toBe("active"));
  it("heartbeat drops to sample minimum and labels month", () => {
    const s = startHeartbeat(initialSip(), 2);
    expect(s.status).toBe("heartbeat");
    expect(s.amount).toBe(100);
    expect(statusLabel(s)).toBe("Heartbeat, month 1 of 2");
  });
  it("clamps months to 1..3", () => {
    expect(startHeartbeat(initialSip(), 9).heartbeatTotal).toBe(3);
    expect(startHeartbeat(initialSip(), 0).heartbeatTotal).toBe(1);
  });
  it("cannot heartbeat a stopped SIP", () => {
    expect(startHeartbeat(stopSip(initialSip()), 2).status).toBe("stopped");
  });
  it("pause and stop", () => {
    expect(pauseSip(initialSip()).status).toBe("paused");
    expect(stopSip(initialSip()).status).toBe("stopped");
  });
  it("return choices", () => {
    const ended = endHeartbeat(startHeartbeat(initialSip(), 2));
    expect(ended.returnDue).toBe(true);
    const back = resolveReturn(ended, "restore");
    expect(back.status).toBe("active");
    expect(back.amount).toBe(1000);
    const lower = resolveReturn(ended, "stay_lower");
    expect(lower.status).toBe("active");
    expect(lower.amount).toBe(100);
    expect(resolveReturn(ended, "stop").status).toBe("stopped");
  });
});
