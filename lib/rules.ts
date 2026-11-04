import { MAX_HEARTBEAT_MONTHS, SAMPLE_MINIMUM } from "./config";
import type { Reason } from "./schema";

export type OptionId = "heartbeat" | "pause" | "stop" | "keep" | "help";
export type Status = "active" | "heartbeat" | "paused" | "stopped";

export type OptionPlan = {
  options: OptionId[];
  decline?: boolean; // show decline message (and AMFI/SEBI links) first
};

const TABLE: Record<Reason, OptionPlan> = {
  salary_late: { options: ["heartbeat", "pause", "stop"] },
  money_tight: { options: ["heartbeat", "pause", "stop"] },
  debit_failed: { options: ["heartbeat", "pause", "stop"] },
  life_event: { options: ["heartbeat", "pause", "stop"] },
  market_worry: { options: ["pause", "stop", "keep"] },
  returns_doubt: { options: ["pause", "stop", "keep"] },
  app_confusion: { options: ["help", "keep", "stop"] },
  wants_advice: { options: ["keep", "pause", "stop"], decline: true },
  wants_to_exit: { options: ["stop", "heartbeat", "pause"] },
  unclear: { options: ["heartbeat", "pause", "stop"] },
};

/** Options come from rules only, never from the model. Stop is always present. */
export function optionsFor(reason: Reason): OptionPlan {
  return TABLE[reason] ?? TABLE.unclear;
}

export type Sip = {
  amount: number;
  normalAmount: number;
  month: number; // month of the SIP, 1..12
  totalMonths: number;
  status: Status;
  heartbeatMonth: number; // 0 when not in heartbeat
  heartbeatTotal: number;
  returnDue: boolean; // heartbeat ended, waiting for the user's choice
};

export function initialSip(): Sip {
  return {
    amount: 1000, normalAmount: 1000, month: 4, totalMonths: 12,
    status: "active", heartbeatMonth: 0, heartbeatTotal: 0, returnDue: false,
  };
}

export function canHeartbeat(sip: Sip): boolean {
  return (sip.status === "active" || sip.status === "paused") && sip.month <= 12;
}

export function startHeartbeat(sip: Sip, months: number): Sip {
  if (!canHeartbeat(sip)) return sip;
  const m = Math.min(Math.max(Math.round(months), 1), MAX_HEARTBEAT_MONTHS);
  return {
    ...sip, status: "heartbeat", amount: SAMPLE_MINIMUM,
    heartbeatMonth: 1, heartbeatTotal: m, returnDue: false,
  };
}

export function pauseSip(sip: Sip): Sip {
  if (sip.status === "stopped") return sip;
  return { ...sip, status: "paused", heartbeatMonth: 0, heartbeatTotal: 0, returnDue: false };
}

export function stopSip(sip: Sip): Sip {
  return { ...sip, status: "stopped", heartbeatMonth: 0, heartbeatTotal: 0, returnDue: false };
}

/** Simulated "Skip to the end": heartbeat finishes and the user is asked what to do. */
export function endHeartbeat(sip: Sip): Sip {
  if (sip.status !== "heartbeat") return sip;
  return { ...sip, month: Math.min(sip.month + sip.heartbeatTotal, sip.totalMonths), returnDue: true };
}

export type ReturnChoice = "restore" | "stay_lower" | "stop";

export function resolveReturn(sip: Sip, choice: ReturnChoice): Sip {
  if (choice === "stop") return stopSip(sip);
  if (choice === "restore") {
    return { ...sip, status: "active", amount: sip.normalAmount, heartbeatMonth: 0, heartbeatTotal: 0, returnDue: false };
  }
  // stay lower: still active at the minimum; the user can change again later
  return { ...sip, status: "active", amount: SAMPLE_MINIMUM, heartbeatMonth: 0, heartbeatTotal: 0, returnDue: false };
}

export function statusLabel(sip: Sip): string {
  switch (sip.status) {
    case "heartbeat": return `Heartbeat, month ${sip.heartbeatMonth} of ${sip.heartbeatTotal}`;
    case "paused": return "Paused";
    case "stopped": return "Stopped";
    default: return "Active";
  }
}
