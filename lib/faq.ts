import { LEARN_LINKS, MAX_HEARTBEAT_MONTHS, SAMPLE_MINIMUM } from "./config";
import { checkInput } from "./safety";

export type FaqCtx = { name: string; category: string; about: string; min: number; risk: string; reasonNote: string };
export type FaqId = "what" | "sip" | "min" | "risk" | "stop" | "tough" | "why" | "advice";
export const UNKNOWN_TEXT =
  "I can answer basic questions about this fund and your SIP. Try one of the questions below, or see the investor education pages.";
export type FaqReply =
  | { kind: "answer"; id: FaqId; text: string }
  | { kind: "decline"; text: string; links: typeof LEARN_LINKS }
  | { kind: "blocked"; text: string }
  | { kind: "unknown"; text: string };

export const SUGGESTED: { id: FaqId; label: string }[] = [
  { id: "what", label: "What is this fund?" },
  { id: "sip", label: "How does a SIP work?" },
  { id: "min", label: "What is the minimum?" },
  { id: "risk", label: "Is it risky?" },
  { id: "tough", label: "What if I can't pay one month?" },
  { id: "why", label: "Why start a SIP?" },
];

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function faqText(id: FaqId, c: FaqCtx): string {
  switch (id) {
    case "what":
      return `${c.name} is a ${c.category} fund. ${c.about}`;
    case "sip":
      return "A SIP moves a fixed amount from your bank to the fund on a date you choose each month. You pick the amount and the date, and you can change, pause or stop it any time.";
    case "min":
      return `The sample minimum here is ${inr(c.min)} a month. Real minimums vary by fund, so check the fund's official page.`;
    case "risk":
      return `This sample is shown as risk level: ${c.risk}. A fund's value can go up and down, and you can get back less than you put in. The fund's official riskometer is the place to confirm its risk level.`;
    case "stop":
      return "Yes. You can change the amount, pause or stop at any time. Stop is always one tap away.";
    case "tough":
      return `Nothing breaks. With Heartbeat you can drop to ${inr(SAMPLE_MINIMUM)} for 1 to ${MAX_HEARTBEAT_MONTHS} months and your SIP stays active. Afterwards you choose whether to go back to your usual amount.`;
    case "why":
      return `Many people find a SIP easier than finding a big amount at once: a small, regular amount becomes a habit, and you set the pace. You started because of “${c.reasonNote}”. There is no rush, and starting with an amount you are comfortable with in a tight month is a good way to begin. Nothing here promises any result.`;
    case "advice":
      return "We can't say which fund to pick, whether it will earn, or whether to continue. That is a personal choice, and nothing here is advice. These pages explain the basics:";
  }
}

const ADVICE = /\b(should i|which fund|best|buy|sell|return|returns|profit|double|guarantee|safe|will it|worth|recommend|kitna milega|fayda|munafa)\b/i;
const RULES: [FaqId, RegExp][] = [
  ["tough", /(can'?t pay|cannot pay|miss|fail|salary|late|tight|afford|paise nahi|nahi de|debit)/i],
  ["stop", /(stop|pause|cancel|exit|band|withdraw|change)/i],
  ["min", /(minimum|min\b|least|kam se kam|how much)/i],
  ["risk", /(risk|risky|loss|lose|khatra|dar\b|safe)/i],
  ["sip", /(how.*sip|sip.*work|what is (a )?sip|sip kya|sip kaise)/i],
  ["why", /(why|motivat|start|benefit|kyun|fayde)/i],
  ["what", /(what is|this fund|about|kya hai|category)/i],
];

/** Fixed answers only: matches a question to a canned reply. No model, no invented facts. */
export function answer(q: string, c: FaqCtx): FaqReply {
  const input = checkInput(q);
  if (!input.ok) return { kind: "blocked", text: input.message };
  const t = input.text;
  if (ADVICE.test(t)) return { kind: "decline", text: faqText("advice", c), links: LEARN_LINKS };
  for (const [id, re] of RULES) if (re.test(t)) return { kind: "answer", id, text: faqText(id, c) };
  return { kind: "unknown", text: UNKNOWN_TEXT };
}
