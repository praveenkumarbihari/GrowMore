"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import scenarios from "@/data/scenarios.json";
import fundData from "@/data/funds.json";
import {
  LEARN_LINKS, MAX_HEARTBEAT_MONTHS, MIN_NOTE, NOT_ADVICE, PROTOTYPE_LABEL, SAMPLE_MINIMUM,
} from "@/lib/config";
import {
  endHeartbeat, initialSip, optionsFor, pauseSip, resolveReturn, startHeartbeat, statusLabel, stopSip,
  type OptionId, type ReturnChoice, type Sip,
} from "@/lib/rules";
import type { Reason } from "@/lib/schema";
import { faqText, SUGGESTED, type FaqId } from "@/lib/faq";
import { BASE } from "@/lib/base";

type Ai =
  | { kind: "ok"; reason: Reason; explanation: string }
  | { kind: "decline"; reason: Reason; explanation: string }
  | { kind: "fallback"; why: string }
  | { kind: "blocked"; message: string };

type Screen =
  | "explore" | "dashboard" | "sips" | "watchlist"
  | "fund" | "sipSetup" | "sipReview" | "mandate" | "sipDone" | "sipDetail" | "fundHelp"
  | "failed" | "ask" | "ai" | "options" | "note" | "confirm" | "return" | "stop" | "stopped" | "help"
  | "feedback" | "thanks" | "alerts" | "learn" | "profile";

type Fund = (typeof fundData.funds)[number];
type Channel = "whatsapp" | "call" | "sms" | "email" | "push";

const CHANNELS: { id: Channel; title: string; body: string }[] = [
  { id: "whatsapp", title: "WhatsApp", body: "A short message before each debit" },
  { id: "call", title: "Phone call", body: "A brief automated call if a debit fails" },
  { id: "sms", title: "SMS", body: "A text before each debit" },
  { id: "email", title: "Email", body: "A monthly SIP summary" },
  { id: "push", title: "App notification", body: "A quiet in-app reminder" },
];
const NO_ALERTS: Record<Channel, boolean> = { whatsapp: false, call: false, sms: false, email: false, push: false };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const LEARN: Record<"en" | "hi" | "hinglish", [string, string][]> = {
  en: [
    ["What is a SIP?", "A SIP sets aside a fixed amount on a fixed date each month. The amount and date are yours to choose."],
    ["What does Heartbeat do?", `In a tough month you can drop to the sample minimum of ${inr(SAMPLE_MINIMUM)} for 1 to ${MAX_HEARTBEAT_MONTHS} months. Your SIP stays active, and afterwards you choose whether to go back.`],
    ["What if a debit fails?", "Nothing breaks. You can change, pause or stop your SIP any time."],
  ],
  hi: [
    ["SIP क्या है?", "SIP में हर महीने तय तारीख पर एक तय रकम अलग रखी जाती है। रकम और तारीख आप चुनते हैं।"],
    ["Heartbeat क्या करता है?", `मुश्किल महीने में आप 1 से ${MAX_HEARTBEAT_MONTHS} महीने के लिए सैंपल न्यूनतम ${inr(SAMPLE_MINIMUM)} पर आ सकते हैं। आपकी SIP चालू रहती है, और बाद में आप खुद चुनते हैं कि पुरानी रकम पर लौटना है या नहीं।`],
    ["डेबिट फेल हो जाए तो?", "कुछ नहीं बिगड़ता। आप कभी भी SIP बदल, रोक या बंद कर सकते हैं।"],
  ],
  hinglish: [
    ["SIP kya hai?", "SIP mein har mahine tay tareekh par ek tay rakam alag rakhi jaati hai. Rakam aur tareekh aap chunte hain."],
    ["Heartbeat kya karta hai?", `Mushkil mahine mein aap 1 se ${MAX_HEARTBEAT_MONTHS} mahine ke liye sample minimum ${inr(SAMPLE_MINIMUM)} par aa sakte hain. Aapki SIP chalu rehti hai, aur baad mein aap khud chunte hain ki purani rakam par wapas jaana hai ya nahi.`],
    ["Debit fail ho jaye to?", "Kuch nahi bigadta. Aap kabhi bhi SIP badal, pause ya stop kar sakte hain."],
  ],
};

const EXIT_REASONS = ["Money is tight", "Market worries", "I need the money", "Don't understand it", "Something else"];
const REASON_CHIPS = ["My first bike", "A safety cushion", "A trip", "Education", "Something else"];

const OPTION_TEXT: Record<OptionId, { title: string; body: string }> = {
  heartbeat: {
    title: "Heartbeat",
    body: `Drop to ${inr(SAMPLE_MINIMUM)} a month for 1 to ${MAX_HEARTBEAT_MONTHS} months. Your SIP stays active. Afterwards you choose whether to go back to your usual amount.`,
  },
  pause: { title: "Pause", body: "No debits while paused. You can resume whenever you like." },
  stop: { title: "Stop", body: "Ends this SIP. One confirmation, nothing more." },
  keep: { title: "Keep as it is", body: "Nothing changes. Your SIP continues as before." },
  help: { title: "Help page", body: "A short page explaining how this SIP and its debits work." },
};

const STORIES = [
  { who: "Asha, month 9", text: "Salary came late in month 4. I dropped to the minimum for two months with Heartbeat, then went back to my usual amount." },
  { who: "Ravi, month 7", text: "Money got tight and I almost stopped. Pausing felt too final, so I lowered it for a while instead." },
  { who: "Meera, month 11", text: "A reminder two days before the debit gave me time to top up my account, so I never missed one." },
];

const Icon = ({ d, className = "h-6 w-6", fill = "none" }: { d: string; className?: string; fill?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ICONS = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  pie: "M12 3v9h9A9 9 0 1112 3zM15 3.5A9 9 0 0120.5 9H15V3.5z",
  bell: "M18 16v-5a6 6 0 10-12 0v5l-2 2h16l-2-2zM10 21h4",
  book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM19 19v2H6",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  back: "M15 5l-7 7 7 7",
  pause: "M9 5v14M15 5v14",
  heart: "M12 21s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z",
  warn: "M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  chevron: "M9 5l7 7-7 7",
  check: "M5 12l5 5 9-10",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
  bank: "M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18",
  lock: "M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z",
  help: "M9.5 9a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17h.01M12 21a9 9 0 100-18 9 9 0 000 18z",
};

const Logo = ({ name, color, size = 44 }: { name: string; color: string; size?: number }) => (
  <span className="flex shrink-0 items-center justify-center rounded-xl font-bold text-white" style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}>
    {name.replace("Sample ", "").charAt(0)}
  </span>
);

const MF_TABS: { id: Screen; label: string }[] = [
  { id: "explore", label: "Explore" }, { id: "dashboard", label: "Dashboard" },
  { id: "sips", label: "SIPs" }, { id: "watchlist", label: "Watchlist" },
];
const MF_SCREENS: Screen[] = ["explore", "dashboard", "sips", "watchlist"];
const NAV_SCREENS: Screen[] = [...MF_SCREENS, "alerts", "learn", "profile"];

const TITLE: Partial<Record<Screen, string>> = {
  fund: "Fund details", sipSetup: "SIP details", sipReview: "Review", mandate: "AutoPay", sipDone: "All set",
  sipDetail: "My SIP", fundHelp: "AI Help", alerts: "SIP alerts", learn: "Learn", profile: "More", failed: "Debit update",
  ask: "What's going on?", ai: "About your SIP", options: "Your options", note: "Note to Self",
  confirm: "Confirm Heartbeat", return: "Welcome back", stop: "Stop SIP", stopped: "SIP stopped",
  help: "How it works", feedback: "Feedback", thanks: "Thank you",
};

export default function Flow() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [hist, setHist] = useState<Screen[]>([]);
  const [sip, setSip] = useState<Sip>(initialSip);
  const [instalments, setInstalments] = useState<number[]>([1000, 1000, 1000]);
  const [legendInfo, setLegendInfo] = useState(false);
  const [fundName, setFundName] = useState("Sample Flexi Cap Fund");
  const [sipDay, setSipDay] = useState(5);
  const [reasonNote, setReasonNote] = useState(scenarios.sip.reasonNote);
  const [heartbeatPref, setHeartbeatPref] = useState<"ask" | "off">("ask");

  const [text, setText] = useState("");
  const [ai, setAi] = useState<Ai | null>(null);
  const [loading, setLoading] = useState(false);
  const [plain, setPlain] = useState(false);
  const [months, setMonths] = useState(2);
  const [helped, setHelped] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [score, setScore] = useState<string>("AI quality check: not scored yet");
  const [alerts, setAlerts] = useState<Record<Channel, boolean>>(NO_ALERTS);
  const [leadDays, setLeadDays] = useState(2);
  const [lang, setLang] = useState<"en" | "hi" | "hinglish">("en");
  const [exitReason, setExitReason] = useState<string | null>(null);

  // Explore / purchase journey state
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [watch, setWatch] = useState<string[]>([]);
  const [fund, setFund] = useState<Fund | null>(null);
  const [amountText, setAmountText] = useState("500");
  const [day, setDay] = useState(5);
  const [reasonChip, setReasonChip] = useState(REASON_CHIPS[0]);
  const [reasonText, setReasonText] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [bank, setBank] = useState("Sample Bank A");
  const [paying, setPaying] = useState(false);
  type Msg = { from: "bot" | "me"; text: string; links?: { label: string; href: string }[]; tag?: string };
  const [chat, setChat] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now(),
  );
  const reasonRef = useRef<string | undefined>(undefined);
  const fallbackRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  function log(event: string, extra: Record<string, unknown> = {}) {
    fetch(`${BASE}/api/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, event, reason: reasonRef.current, fallback: fallbackRef.current, ...extra }),
    }).catch(() => {});
  }

  // Navigation: go() pushes history, reset() jumps to a tab, back() pops.
  const go = (s: Screen) => { setHist((h) => [...h, screen]); setScreen(s); };
  const reset = (s: Screen) => { setHist([]); setScreen(s); };
  const back = () => {
    const prev = hist[hist.length - 1];
    setHist((h) => h.slice(0, -1));
    setScreen(prev ?? "dashboard");
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sip_alerts");
      if (saved) setAlerts({ ...NO_ALERTS, ...JSON.parse(saved) });
      const d = Number(localStorage.getItem("sip_lead_days"));
      if (d >= 1 && d <= 3) setLeadDays(d);
      const w = localStorage.getItem("sip_watch");
      if (w) setWatch(JSON.parse(w));
    } catch {}
    log("session_start");
    fetch(`${BASE}/api/score`)
      .then((r) => r.json())
      .then((s) => {
        if (s.available) {
          setScore(`AI quality check: ${s.agreement}% agreement on ${s.labelled} hand-labelled messages, ${s.safetyFailures} safety failures`);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = useMemo(() => {
    const reason: Reason = ai && (ai.kind === "ok" || ai.kind === "decline") ? ai.reason : "unclear";
    return optionsFor(reason);
  }, [ai]);

  const atMinimum = sip.normalAmount <= SAMPLE_MINIMUM;
  const hasSip = sip.status !== "stopped";
  const onChannels = CHANNELS.filter((c) => alerts[c.id]).map((c) => c.title);

  async function submit(t: string) {
    setLoading(true);
    setText(t);
    log("reason_submitted");
    try {
      const res = await fetch(`${BASE}/api/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t, sip: { amount: sip.amount, month: sip.month, status: sip.status } }),
      });
      const data: Ai = await res.json();
      setAi(data);
      reasonRef.current = data.kind === "ok" || data.kind === "decline" ? data.reason : "unclear";
      fallbackRef.current = data.kind === "fallback";
      log("ai_result", { option: data.kind });
    } catch {
      setAi({ kind: "fallback", why: "error" });
      fallbackRef.current = true;
      reasonRef.current = "unclear";
    }
    setLoading(false);
    go("ai");
  }

  function choose(o: OptionId) {
    log("option_chosen", { option: o });
    if (o === "heartbeat") go("note");
    else if (o === "pause") { setSip(pauseSip(sip)); go("feedback"); }
    else if (o === "stop") go("stop");
    else if (o === "help") go("help");
    else reset("dashboard");
  }

  function toggleAlert(c: Channel) {
    const next = { ...alerts, [c]: !alerts[c] };
    setAlerts(next);
    try { localStorage.setItem("sip_alerts", JSON.stringify(next)); } catch {}
    log("alert_toggled", { option: `${c}:${next[c] ? "on" : "off"}` });
  }
  function changeLead(d: number) {
    setLeadDays(d);
    try { localStorage.setItem("sip_lead_days", String(d)); } catch {}
    log("alert_lead_days", { option: String(d) });
  }
  function toggleWatch(id: string) {
    const next = watch.includes(id) ? watch.filter((x) => x !== id) : [...watch, id];
    setWatch(next);
    try { localStorage.setItem("sip_watch", JSON.stringify(next)); } catch {}
  }
  function sendFeedback() {
    log("feedback", { helped: helped ?? undefined, comment: comment || undefined, consent });
    go("thanks");
  }

  const helpFund = fund ?? fundData.funds.find((f) => f.name === fundName) ?? fundData.funds[0];
  const faqCtx = { name: helpFund.name, category: helpFund.category, about: helpFund.about, min: helpFund.min, risk: helpFund.risk, reasonNote };

  function openHelp() {
    if (chat.length === 0) {
      setChat([{ from: "bot", text: `Hi, I'm AI Help. I can answer basic questions about ${helpFund.name} and how your SIP works. I can't recommend funds or predict results.` }]);
    }
    log("help_opened");
    go("fundHelp");
  }
  async function askFaq(q: string, id?: FaqId) {
    setChatInput("");
    if (id) {
      // Suggested chips map straight to a fixed answer; no model needed.
      setChat((c) => [...c, { from: "me", text: q }, { from: "bot", text: faqText(id, faqCtx) }]);
      log("fund_question", { option: id });
    } else {
      setChat((c) => [...c, { from: "me", text: q }]);
      setChatBusy(true);
      try {
        const res = await fetch(`${BASE}/api/faq`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ q, ctx: faqCtx }),
        });
        const r = await res.json();
        const tag = r.kind === "blocked" ? undefined : r.viaAi ? "AI matched your question to a fixed answer" : "AI stepped back; matched by keywords";
        setChat((c) => [...c, { from: "bot", text: r.text, links: r.links, tag }]);
        log("fund_question", { option: r.kind === "answer" ? r.id : r.kind });
        fallbackRef.current = !r.viaAi;
      } catch {
        setChat((c) => [...c, { from: "bot", text: "Sorry, I could not answer that. Please try one of the questions below." }]);
      }
      setChatBusy(false);
    }
    setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function openFund(f: Fund) {
    setFund(f);
    setAmountText(String(Math.max(f.min, 500)));
    log("fund_viewed");
    go("fund");
  }

  const amount = Number(amountText) || 0;
  const minForFund = fund?.min ?? SAMPLE_MINIMUM;
  const amountError =
    amount < minForFund ? `Minimum is ${inr(minForFund)} (sample)` : amount > 100000 ? "Maximum is ₹1,00,000 in this prototype" : "";

  function approveMandate() {
    setPaying(true);
    log("autopay_approved");
    setTimeout(() => {
      const note = reasonChip === "Something else" ? reasonText.trim() || "my reason" : reasonChip.toLowerCase();
      setSip({ ...initialSip(), amount, normalAmount: amount, month: 1 });
      setInstalments([]);
      setFundName(fund?.name ?? "Sample fund");
      setSipDay(day);
      setReasonNote(note);
      setPaying(false);
      setExitReason(null);
      log("sip_created", { option: String(amount) });
      setHist([]);
      setScreen("sipDone");
    }, 1400);
  }

  const filteredFunds = fundData.funds.filter(
    (f) => (category === "All" || f.category === category) && f.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const isMf = MF_SCREENS.includes(screen);
  const showNav = NAV_SCREENS.includes(screen);
  const activeNav = isMf ? "mf" : screen;
  const stopVisible = hasSip && screen !== "stop" && screen !== "stopped";
  const done = instalments.length;
  const invested = instalments.reduce((a, b) => a + b, 0);
  const lowMonths = instalments.filter((a) => a < sip.normalAmount).length;
  const plannedTotal = Math.max(invested + Math.max(sip.totalMonths - instalments.length, 0) * sip.normalAmount, 1);
  const inrShort = (n: number) => (n >= 1000 ? `₹${+(n / 1000).toFixed(1)}k` : `₹${n}`);
  const milestones = [
    { m: 3, label: "3 months" }, { m: 6, label: "6 months" }, { m: 12, label: "1 year" },
  ];

  const sipSummaryCard = (
    <button className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm" onClick={() => go("sipDetail")}>
      <Logo name={fundName} color="#0d9488" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{fundName}</span>
        <span className="block text-xs text-slate-500">{inr(sip.amount)} · {ord(sipDay)} of every month</span>
      </span>
      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">{statusLabel(sip)}</span>
    </button>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col bg-slate-50 shadow-xl sm:my-4 sm:min-h-[760px] sm:overflow-hidden sm:rounded-3xl">
      <div className="hidden items-center justify-between bg-white px-6 pt-2 text-xs font-semibold sm:flex">
        <span>9:41</span><span>5G ▂▄▆</span>
      </div>

      {isMf ? (
        <header className="bg-white">
          <div className="flex items-center gap-3 px-4 pb-2 pt-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-calm text-white"><Icon d={ICONS.heart} className="h-5 w-5" /></span>
            <span className="flex-1 text-lg font-bold text-ink">Grow More</span>
            <button aria-label="Search" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100" onClick={() => { setSearching((s) => !s); if (screen !== "explore") reset("explore"); }}>
              <Icon d={ICONS.search} className="h-5 w-5" />
            </button>
            <button aria-label="Alerts" className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100" onClick={() => go("alerts")}>
              <Icon d={ICONS.bell} className="h-5 w-5" />
              {onChannels.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-calm" />}
            </button>
            <button aria-label="Profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold" onClick={() => go("profile")}>S</button>
          </div>
          <div className="flex border-b">
            {MF_TABS.map((t) => (
              <button key={t.id} className={`flex-1 border-b-[3px] py-2.5 text-sm ${screen === t.id ? "border-ink font-semibold text-ink" : "border-transparent text-slate-500"}`} onClick={() => reset(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </header>
      ) : (
        <header className="grid grid-cols-[48px_1fr_48px] items-center border-b border-slate-100 bg-white px-3 py-2">
          <button aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100" onClick={back}>
            <Icon d={ICONS.back} />
          </button>
          <p className="truncate text-center text-base font-semibold text-ink">{TITLE[screen] ?? "Grow More"}</p>
          {screen === "fund" && fund ? (
            <button aria-label="Watchlist" className={`flex h-10 w-10 items-center justify-center rounded-full ${watch.includes(fund.id) ? "text-amber-500" : "text-slate-400"}`} onClick={() => toggleWatch(fund.id)}>
              <Icon d={ICONS.star} fill={watch.includes(fund.id) ? "currentColor" : "none"} />
            </button>
          ) : screen !== "stopped" ? (
            <button aria-label="Home" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => reset("dashboard")}>
              <Icon d={ICONS.home} className="h-5 w-5" />
            </button>
          ) : <span />}
        </header>
      )}

      <div className="flex items-start justify-between gap-3 bg-amber-50 px-4 py-1.5 text-[11px] leading-snug text-amber-900">
        <span>{PROTOTYPE_LABEL}</span>
        {stopVisible && (
          <button aria-label="Stop SIP" className="shrink-0 text-xs text-slate-600 underline underline-offset-2" onClick={() => go("stop")}>
            Stop SIP
          </button>
        )}
      </div>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* ---------- EXPLORE ---------- */}
        {screen === "explore" && (
          <>
            {searching && (
              <input autoFocus className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5" placeholder="Search sample funds" value={query} onChange={(e) => setQuery(e.target.value)} />
            )}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5">
              <div className="pr-3">
                <p className="text-lg font-semibold leading-snug">Start a SIP, one calm step at a time</p>
                <button className="mt-3 rounded-lg bg-calm px-5 py-2.5 font-semibold text-white" onClick={() => listRef.current?.scrollIntoView({ behavior: "smooth" })}>
                  Start a SIP
                </button>
              </div>
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-calm">
                <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M8 14h2M12 14h2M16 14h2M8 17h2" /></svg>
              </span>
            </div>

            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <p className="flex items-center gap-2 font-medium"><Icon d={ICONS.heart} className="h-4 w-4 text-calm" />Tough month? There&apos;s a middle path.</p>
              <p className="mt-1 text-sm text-slate-600">With SIP Heartbeat you can drop to the sample minimum for 1 to {MAX_HEARTBEAT_MONTHS} months instead of stopping. Your SIP stays active.</p>
            </div>


            <div>
              <p className="font-semibold">Getting through a tough month</p>
              <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
                {STORIES.map((st) => (
                  <div key={st.who} className="w-64 shrink-0 rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-700">“{st.text}”</p>
                    <p className="mt-2 text-xs font-medium text-slate-500">{st.who}</p>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Illustrative sample stories written for this prototype. Not real customers. No results or returns are implied.</p>
            </div>

            <div ref={listRef} className="scroll-mt-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold">Sample funds</h2>
                <span className="text-xs text-slate-500">Alphabetical, not ranked</span>
              </div>
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
                {fundData.categories.map((c) => (
                  <button key={c} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${category === c ? "border-calm bg-teal-50 font-medium text-calm" : "border-slate-300 bg-white text-slate-600"}`} onClick={() => setCategory(c)}>{c}</button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {filteredFunds.map((f) => (
                  <button key={f.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-left" onClick={() => openFund(f)}>
                    <Logo name={f.name} color={f.color} size={40} />
                    <span className="mt-3 block text-sm font-medium leading-snug">{f.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{f.category}</span>
                    <span className="mt-2 block text-xs text-slate-600">Min {inr(f.min)} (sample)</span>
                  </button>
                ))}
                {filteredFunds.length === 0 && <p className="col-span-2 text-sm text-slate-500">No sample funds match.</p>}
              </div>
              <p className="mt-3 text-xs text-slate-500">Placeholder funds only. No returns or rankings are shown, and nothing here is a recommendation.</p>
            </div>
          </>
        )}

        {/* ---------- DASHBOARD ---------- */}
        {screen === "dashboard" && (
          <>
            <div>
              <p className="text-sm text-slate-500">Hello, Sample User</p>
              <p className="text-lg font-semibold">Your SIP at a glance</p>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-teal-600 to-teal-800 p-5 text-white shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-teal-100">Monthly SIP (sample)</p>
                  <p className="mt-1 text-4xl font-semibold">{inr(hasSip ? sip.amount : 0)}</p>
                </div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs">{statusLabel(sip)}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${(Math.min(done, sip.totalMonths) / sip.totalMonths) * 100}%` }} />
              </div>
              <p className="mt-2 text-sm text-teal-50">
                {done} of {sip.totalMonths} instalments done · Why you started: “{reasonNote}”
              </p>
            </div>

            {(sip.status === "active" || sip.status === "heartbeat") && (
              <div className="flex flex-wrap gap-2">
                {([
                  ["Debit failed", ICONS.warn, () => { log("debit_failed_simulated"); go("failed"); }],
                  ["Pause", ICONS.pause, () => { setSip(pauseSip(sip)); log("option_chosen", { option: "pause" }); }],
                  ["Alerts", ICONS.bell, () => go("alerts")],
                  ["AI Help", ICONS.help, openHelp],
                ] as [string, string, () => void][]).map(([label, d, f]) => (
                  <button key={label} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm" onClick={f}>
                    <Icon d={d} className="h-4 w-4 text-calm" />{label}
                  </button>
                ))}
              </div>
            )}

            {sip.status === "heartbeat" && !sip.returnDue && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
                <p className="font-medium">You&apos;re on Heartbeat</p>
                <p className="text-sm text-slate-600">Your SIP is still active at the lower amount.</p>
                <button className="btn-secondary mt-3 w-full" onClick={() => { setInstalments((i) => [...i, ...Array(sip.heartbeatTotal).fill(sip.amount)]); setSip(endHeartbeat(sip)); go("return"); }}>
                  Skip to the end (simulated)
                </button>
              </div>
            )}
            {sip.status === "paused" && <button className="btn-primary w-full" onClick={() => setSip(resolveReturn(sip, "restore"))}>Resume SIP</button>}
            {sip.status === "stopped" && <button className="btn-primary w-full" onClick={() => reset("explore")}>Start a new SIP</button>}
            {sip.status === "active" && sip.amount < sip.normalAmount && (
              <button className="btn-secondary w-full" onClick={() => { log("return_choice", { option: "restore_later" }); setSip(resolveReturn(sip, "restore")); }}>
                Go back to {inr(sip.normalAmount)} whenever you are ready
              </button>
            )}

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Invested so far (sample)</p>
              <p className="text-3xl font-semibold">{inr(invested)}</p>
              <div className="relative mt-5 flex h-32 items-end" aria-label="Your climb: total invested, month by month">
                {Array.from({ length: sip.totalMonths }, (_, i) => {
                  const a = instalments[i];
                  const last = instalments.length - 1;
                  const cum = i <= last
                    ? instalments.slice(0, i + 1).reduce((x, y) => x + y, 0)
                    : invested + (i - last) * sip.normalAmount;
                  const h = Math.max(10, (cum / plannedTotal) * 100);
                  const low = a !== undefined && a < sip.normalAmount;
                  const here = i === last;
                  return (
                    <div key={i} className="relative flex-1" style={{ height: `${h}%` }} title={a === undefined ? `Month ${i + 1}: planned` : `Month ${i + 1}: ${inr(a)} added`}>
                      <div className={`h-full w-full rounded-t-sm border-t-[3px] ${
                        a === undefined
                          ? "border-slate-300 border-dashed bg-slate-100/70"
                          : low ? "border-amber-400 bg-teal-500/90" : "border-teal-800 bg-calm"
                      }`} />
                      {here && (
                        <span className="absolute -top-7 left-1/2 flex -translate-x-1/2 flex-col items-center text-[10px] font-semibold text-calm">
                          You
                          <span className="mt-0.5 h-3 w-3 rounded-full border-2 border-white bg-calm shadow" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 grid grid-cols-12 text-center text-[9px] leading-tight">
                {Array.from({ length: sip.totalMonths }, (_, i) => {
                  const a = instalments[i];
                  const low = a !== undefined && a < sip.normalAmount;
                  return (
                    <div key={i} className={`mx-px rounded py-0.5 ${low ? "bg-amber-100 font-semibold text-amber-900" : a !== undefined ? "text-slate-600" : "text-slate-300"}`}>
                      <div>{i + 1}</div>
                      <div>{a !== undefined ? inrShort(a) : "·"}</div>
                      {low && <Icon d={ICONS.heart} className="mx-auto h-2.5 w-2.5" fill="currentColor" />}
                    </div>
                  );
                })}
              </div>
              <p className="mt-0.5 text-center text-[10px] text-slate-400">Month number and amount added</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-calm align-middle" />Full amount</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-300 align-middle" />Heartbeat (lower amount)</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-slate-400 align-middle" />Planned</span>
              </div>
              <p className={`mt-3 rounded-xl p-3 text-xs ${lowMonths ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-600"}`}>
                {lowMonths
                  ? `Heartbeat in month ${instalments.map((a, i) => (a < sip.normalAmount ? i + 1 : 0)).filter(Boolean).join(", ")}: you paid ${inr(SAMPLE_MINIMUM)} instead of ${inr(sip.normalAmount)}. Your SIP stayed active, and every instalment still counts toward your total.`
                  : "No Heartbeat months yet. If a month gets tight, you can lower the amount for a while instead of stopping."}
              </p>
              <p className="mt-2 text-xs text-slate-500">Each step is one month and every instalment takes you higher. The dotted steps are the path ahead.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Instalments done</p>
                <p className="mt-1 text-2xl font-semibold">{done}<span className="text-sm font-normal text-slate-400"> / {sip.totalMonths}</span></p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Heartbeat months</p>
                <p className="mt-1 text-2xl font-semibold">{lowMonths}</p>
                <p className="text-[11px] text-slate-400">paid less, SIP stayed active</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              <Icon d={ICONS.help} className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <p><span className="font-medium text-ink">Returns are not shown here.</span> Market value changes every day and past numbers do not predict the future. Check your official statement.</p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Next instalment</p>
              <p className="font-medium">{sip.status === "paused" || sip.status === "stopped" ? "None scheduled" : `${inr(sip.amount)} on the ${ord(sipDay)} of next month`}</p>
              <p className="mt-1 text-xs text-slate-500">{onChannels.length ? `Alerts on: ${onChannels.join(", ")}` : "Alerts are off"}</p>
            </div>


            <div>
              <p className="font-semibold">Getting through a tough month</p>
              <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
                {STORIES.map((st) => (
                  <div key={st.who} className="w-64 shrink-0 rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-700">“{st.text}”</p>
                    <p className="mt-2 text-xs font-medium text-slate-500">{st.who}</p>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Illustrative sample stories written for this prototype. Not real customers. No results or returns are implied.</p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">Your journey</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                {milestones.map((ms) => {
                  const reached = done >= ms.m;
                  return (
                    <div key={ms.m} className={`rounded-xl p-3 ${reached ? "bg-teal-50 text-teal-900" : "bg-slate-100 text-slate-400"}`}>
                      <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-white">{reached ? <Icon d={ICONS.check} className="h-4 w-4 text-calm" /> : <span>{ms.m}</span>}</span>
                      {ms.label}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">Months of instalments completed. No pressure, at your own pace.</p>
            </div>
          </>
        )}

        {/* ---------- SIPs ---------- */}
        {screen === "sips" && (
          <>
            <div className="rounded-3xl bg-gradient-to-br from-teal-700 to-teal-900 p-5 text-white shadow-md">
              <p className="text-xs uppercase tracking-wide text-teal-100">Your target board</p>
              <div className="mt-3 flex items-center gap-4">
                <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90" aria-hidden>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(Math.min(done, sip.totalMonths) / sip.totalMonths) * 264} 264`} />
                </svg>
                <div>
                  <p className="text-xs text-teal-100">Total invested (sample)</p>
                  <p className="text-3xl font-semibold">{inr(invested)}</p>
                  <p className="text-sm text-teal-50">{done} of {sip.totalMonths} instalments</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-teal-50">Why you started: “{reasonNote}”</p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <p className="flex items-center gap-1.5 font-semibold">
                  12-month calendar
                  <button aria-label="What do the colours mean?" aria-expanded={legendInfo} className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold ${legendInfo ? "border-calm bg-calm text-white" : "border-slate-300 text-slate-500"}`} onClick={() => setLegendInfo((v) => !v)}>i</button>
                </p>
                <p className="text-xs text-slate-500">{sip.status === "stopped" ? "Stopped" : `Next: ${ord(sipDay)} of next month`}</p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {Array.from({ length: sip.totalMonths }, (_, i) => {
                  const a = instalments[i];
                  const next = a === undefined && i === instalments.length && sip.status !== "stopped";
                  const low = a !== undefined && a < sip.normalAmount;
                  const milestone = [3, 6, 12].includes(i + 1);
                  const cls = a !== undefined
                    ? low ? "border-amber-200 bg-amber-50 text-amber-900" : "border-teal-200 bg-teal-50 text-teal-900"
                    : next ? "border-dashed border-calm text-calm" : "border-transparent bg-slate-100 text-slate-400";
                  return (
                    <div key={i} className={`relative flex h-16 flex-col items-center justify-center rounded-xl border text-xs ${cls} ${milestone ? "ring-2 ring-amber-300 ring-offset-1" : ""}`}>
                      <span className="text-[10px] opacity-70">Month {i + 1}</span>
                      {a !== undefined ? (
                        <><Icon d={ICONS.check} className="h-4 w-4" /><span className="font-medium">{inrShort(a)}</span></>
                      ) : next ? <span className="font-medium">Next</span> : <span>·</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-400" />Done</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-300" />Heartbeat (lower amount)</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full ring-2 ring-amber-300" />Milestone</span>
                <button className="text-calm underline underline-offset-2" onClick={() => setLegendInfo((v) => !v)}>{legendInfo ? "Hide meaning" : "What do these mean?"}</button>
              </div>
              {legendInfo && (
                <dl className="mt-3 space-y-2.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  {([
                    ["bg-teal-400", "Done", "Your instalment for that month went through at your usual amount."],
                    ["bg-amber-300", "Heartbeat (lower amount)", `A month you paid the lower sample amount (${inr(SAMPLE_MINIMUM)}) instead of your usual ${inr(sip.normalAmount)}. Your SIP stayed active and the instalment still counts.`],
                    ["border-2 border-dashed border-calm bg-white", "Next", "Your upcoming debit."],
                    ["bg-slate-200", "Upcoming", "Months still ahead. Nothing is due yet."],
                    ["ring-2 ring-amber-300 bg-white", "Milestone", "Months 3, 6 and 12. A moment to notice how far you have come. There is no reward or deadline attached."],
                  ] as [string, string, string][]).map(([sw, t, d]) => (
                    <div key={t} className="flex gap-2.5">
                      <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-sm ${sw}`} />
                      <div><dt className="font-semibold text-ink">{t}</dt><dd>{d}</dd></div>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <h2 className="text-xl font-semibold">Your SIPs</h2>
            {sip.status !== "stopped" ? sipSummaryCard : <p className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">No active SIP. Start one whenever you like.</p>}
            <button className="btn-secondary w-full" onClick={() => reset("explore")}>Start a new SIP</button>
            <p className="text-xs text-slate-500">This prototype tracks one SIP at a time. Starting a new one replaces the current sample.</p>
          </>
        )}

        {/* ---------- WATCHLIST ---------- */}
        {screen === "watchlist" && (
          <>
            {fundData.funds.filter((f) => watch.includes(f.id)).map((f) => (
              <button key={f.id} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm" onClick={() => openFund(f)}>
                <Logo name={f.name} color={f.color} />
                <span className="flex-1"><span className="block font-medium">{f.name}</span><span className="text-xs text-slate-500">{f.category} · Min {inr(f.min)} (sample)</span></span>
                <Icon d={ICONS.chevron} className="h-4 w-4 text-slate-400" />
              </button>
            ))}
            {watch.length === 0 && (
              <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                <p className="font-medium">Your watchlist is empty</p>
                <p className="mt-1 text-sm text-slate-500">Tap the star on any fund to save it here. You can come back to it any time.</p>
                <button className="btn-primary mt-4" onClick={() => reset("explore")}>Explore funds</button>
              </div>
            )}
          </>
        )}

        {/* ---------- FUND DETAIL ---------- */}
        {screen === "fund" && fund && (
          <>
            <div className="flex items-center gap-3">
              <Logo name={fund.name} color={fund.color} size={56} />
              <div>
                <p className="text-lg font-semibold leading-snug">{fund.name}</p>
                <div className="mt-1 flex gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">{fund.category}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">Risk: {fund.risk} (sample)</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">About this type of fund</p>
              <p className="mt-1 text-sm text-slate-600">{fund.about}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Minimum SIP</p><p className="font-semibold">{inr(fund.min)} (sample)</p></div>
              <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">You can</p><p className="font-semibold">Change, pause or stop any time</p></div>
            </div>
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm">
              <p className="font-medium">Built-in safety net</p>
              <p className="mt-1 text-slate-600">If a month gets tight, you can drop to the minimum for 1 to {MAX_HEARTBEAT_MONTHS} months instead of stopping.</p>
            </div>
            <button className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm" onClick={openHelp}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-calm"><Icon d={ICONS.help} /></span>
              <span className="flex-1"><span className="block font-medium">AI Help</span><span className="block text-xs text-slate-500">Ask about this fund and how a SIP works</span></span>
              <Icon d={ICONS.chevron} className="h-4 w-4 text-slate-400" />
            </button>
            <p className="text-xs text-slate-500">Returns are not shown. Past numbers do not predict the future. {NOT_ADVICE}</p>
            <div className="sticky bottom-0 -mx-4 -mb-5 border-t bg-white p-4">
              <button className="btn-primary w-full" onClick={() => { log("sip_setup_started"); go("sipSetup"); }}>Start a SIP</button>
            </div>
          </>
        )}

        {/* ---------- SIP SETUP ---------- */}
        {screen === "sipSetup" && fund && (
          <>
            <div>
              <p className="text-xs text-slate-500">Step 1 of 3 · {fund.name}</p>
              <p className="mt-1 text-lg font-semibold">Choose your monthly amount</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <label className="text-xs text-slate-500" htmlFor="amt">Amount per month</label>
              <div className="mt-1 flex items-center border-b-2 border-slate-300 focus-within:border-calm">
                <span className="text-2xl">₹</span>
                <input id="amt" inputMode="numeric" className="w-full bg-transparent px-2 py-2 text-2xl font-semibold outline-none" value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </div>
              {amountError && <p className="mt-1 text-xs text-red-600">{amountError}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {[100, 500, 1000, 2000].filter((v) => v >= fund.min).map((v) => (
                  <button key={v} className={`chip ${amount === v ? "border-calm bg-teal-50" : ""}`} onClick={() => setAmountText(String(v))}>{inr(v)}</button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Pick an amount you would still be comfortable setting aside in a tight month. You can change it later.</p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">Debit date</p>
              <p className="text-xs text-slate-500">A few days after your salary usually arrives can help avoid a missed debit.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 5, 10, 15, 20, 25].map((d) => (
                  <button key={d} className={`chip ${day === d ? "border-calm bg-teal-50" : ""}`} onClick={() => setDay(d)}>{ord(d)}</button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">Why are you starting?</p>
              <p className="text-xs text-slate-500">We will show this back to you later, in your own words. It stays on this device.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {REASON_CHIPS.map((r) => (
                  <button key={r} className={`chip ${reasonChip === r ? "border-calm bg-teal-50" : ""}`} onClick={() => setReasonChip(r)}>{r}</button>
                ))}
              </div>
              {reasonChip === "Something else" && (
                <input className="mt-3 w-full rounded-lg border border-slate-300 p-2.5" maxLength={60} placeholder="In your own words" value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
              )}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">If a month gets tough</p>
              <div className="mt-2 space-y-2 text-sm">
                <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={heartbeatPref === "ask"} onChange={() => setHeartbeatPref("ask")} />Ask me about Heartbeat first (lower amount for a while)</label>
                <label className="flex items-start gap-2"><input type="radio" className="mt-1" checked={heartbeatPref === "off"} onChange={() => setHeartbeatPref("off")} />Not now</label>
              </div>
              <p className="mt-3 text-sm font-medium">Heads-up before each debit</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHANNELS.filter((c) => c.id !== "email" && c.id !== "call").map((c) => (
                  <button key={c.id} className={`chip ${alerts[c.id] ? "border-calm bg-teal-50" : ""}`} onClick={() => toggleAlert(c.id)}>{c.title}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Optional. All off unless you choose.</p>
            </div>

            <div className="sticky bottom-0 -mx-4 -mb-5 border-t bg-white p-4">
              <button className="btn-primary w-full" disabled={!!amountError || amount === 0} onClick={() => go("sipReview")}>Continue</button>
            </div>
          </>
        )}

        {/* ---------- REVIEW ---------- */}
        {screen === "sipReview" && fund && (
          <>
            <p className="text-xs text-slate-500">Step 2 of 3</p>
            <div className="divide-y rounded-2xl bg-white shadow-sm">
              {[
                ["Fund", fund.name],
                ["Monthly amount", inr(amount)],
                ["Debit date", `${ord(day)} of every month`],
                ["Your reason", reasonChip === "Something else" ? reasonText || "—" : reasonChip],
                ["Tough-month plan", heartbeatPref === "ask" ? "Ask me about Heartbeat" : "Not now"],
                ["Alerts", onChannels.length ? onChannels.join(", ") : "Off"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 p-4 text-sm"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              I understand I can change, pause or stop this SIP at any time.
            </label>
            <p className="text-xs text-slate-500">{NOT_ADVICE} Prototype: starting a SIP here replaces the current sample SIP.</p>
            <div className="sticky bottom-0 -mx-4 -mb-5 border-t bg-white p-4">
              <button className="btn-primary w-full" disabled={!understood} onClick={() => go("mandate")}>Continue to AutoPay</button>
            </div>
          </>
        )}

        {/* ---------- MANDATE ---------- */}
        {screen === "mandate" && (
          <>
            <p className="text-xs text-slate-500">Step 3 of 3</p>
            <p className="text-lg font-semibold">Set up AutoPay (simulated)</p>
            <div className="divide-y rounded-2xl bg-white shadow-sm">
              {["Sample Bank A", "Sample Bank B"].map((b) => (
                <label key={b} className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon d={ICONS.bank} className="h-5 w-5" /></span>
                  <span className="flex-1 font-medium">{b}</span>
                  <input type="radio" checked={bank === b} onChange={() => setBank(b)} />
                </label>
              ))}
            </div>
            <div className="flex items-start gap-2 rounded-2xl bg-teal-50 p-4 text-sm text-teal-900">
              <Icon d={ICONS.lock} className="mt-0.5 h-5 w-5 shrink-0" />
              <p>No real payment happens. We never ask for your account number, PAN or UPI PIN in this prototype.</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
              <p className="text-slate-500">AutoPay up to</p>
              <p className="text-xl font-semibold">{inr(amount)} a month</p>
              <p className="mt-1 text-xs text-slate-500">You can cancel AutoPay any time.</p>
            </div>
            <div className="sticky bottom-0 -mx-4 -mb-5 border-t bg-white p-4">
              <button className="btn-primary w-full" disabled={paying} onClick={approveMandate}>
                {paying ? "Waiting for approval…" : "Approve in UPI app (simulated)"}
              </button>
            </div>
          </>
        )}

        {/* ---------- DONE ---------- */}
        {screen === "sipDone" && (
          <>
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-calm text-white"><Icon d={ICONS.check} className="h-8 w-8" /></span>
              <p className="mt-4 text-xl font-semibold">Your SIP is set up</p>
              <p className="mt-1 text-sm text-slate-600">{inr(sip.amount)} a month in {fundName}. First instalment on the {ord(sipDay)}.</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
              <p className="font-medium">Your Note to Self</p>
              <p className="mt-1 text-slate-600">“{reasonNote}”. We&apos;ll show this back to you if things get tough.</p>
              <p className="mt-3 font-medium">Tough-month plan</p>
              <p className="mt-1 text-slate-600">{heartbeatPref === "ask" ? "If a debit fails, we will ask whether you want Heartbeat." : "You can still choose Heartbeat any time."}</p>
            </div>
            <button className="btn-primary w-full" onClick={() => reset("sips")}>View my SIP</button>
            <button className="btn-secondary w-full" onClick={() => reset("dashboard")}>Go to dashboard</button>
          </>
        )}

        {/* ---------- SIP DETAIL ---------- */}
        {screen === "sipDetail" && (
          <>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Logo name={fundName} color="#0d9488" />
                <div className="flex-1"><p className="font-semibold">{fundName}</p><p className="text-xs text-slate-500">{inr(sip.amount)} · {ord(sipDay)} of every month</p></div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">{statusLabel(sip)}</span>
              </div>
              <div className="mt-4 grid grid-cols-6 gap-2">
                {Array.from({ length: sip.totalMonths }, (_, i) => {
                  const m = i + 1;
                  const dn = m < sip.month;
                  const cur = m === sip.month;
                  return (
                    <span key={m} className={`flex h-9 items-center justify-center rounded-full text-xs ${dn ? "bg-calm text-white" : cur ? "border-2 border-calm text-calm" : "bg-slate-100 text-slate-400"}`}>
                      {dn ? <Icon d={ICONS.check} className="h-4 w-4" /> : m}
                    </span>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate-500">12-month journey. Filled = instalment done.</p>
            </div>
            <div className="rounded-2xl bg-white shadow-sm">
              <p className="px-4 pt-4 text-sm font-semibold">Instalments</p>
              <div className="divide-y">
                {Array.from({ length: done }, (_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 text-sm">
                    <span>Instalment {i + 1}</span><span className="text-slate-500">{instalments[i] < sip.normalAmount ? "Heartbeat" : "Successful"}</span><span className="font-medium">{inr(instalments[i])}</span>
                  </div>
                ))}
                {done === 0 && <p className="p-4 text-sm text-slate-500">Your first instalment is on the {ord(sipDay)}.</p>}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
              <p className="text-slate-500">Tough-month plan</p>
              <p className="font-medium">{heartbeatPref === "ask" ? "Ask me about Heartbeat first" : "Not now"}</p>
            </div>
            {(sip.status === "active" || sip.status === "heartbeat") && (
              <div className="grid grid-cols-2 gap-3">
                <button className="btn-secondary" onClick={() => { log("debit_failed_simulated"); go("failed"); }}>Debit failed?</button>
                <button className="btn-secondary" onClick={() => { setSip(pauseSip(sip)); log("option_chosen", { option: "pause" }); }}>Pause</button>
              </div>
            )}
            {sip.status === "paused" && <button className="btn-primary w-full" onClick={() => setSip(resolveReturn(sip, "restore"))}>Resume SIP</button>}
            <button className="w-full text-sm text-calm underline underline-offset-2" onClick={openHelp}>AI Help: ask about this fund</button>
          </>
        )}

        {/* ---------- FUND HELP ---------- */}
        {screen === "fundHelp" && (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <Logo name={helpFund.name} color={helpFund.color} size={36} />
              <div className="text-sm"><p className="font-medium">{helpFund.name}</p><p className="text-xs text-slate-500">{helpFund.category} · sample</p></div>
            </div>
            <div className="space-y-3">
              {chat.map((m, i) => (
                <div key={i} className={m.from === "me" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "me" ? "bg-calm text-white" : "bg-white shadow-sm"}`}>
                    <p>{m.text}</p>
                    {m.tag && <p className="mt-1.5 text-[11px] text-slate-400">{m.tag}</p>}
                    {m.links && (
                      <ul className="mt-2 list-disc pl-5">
                        {m.links.map((l) => <li key={l.href}><a className="text-calm underline" href={l.href} target="_blank" rel="noreferrer">{l.label}</a></li>)}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button key={s.id} className="chip bg-white" onClick={() => askFaq(s.label, s.id)}>{s.label}</button>
              ))}
            </div>
            <form className="sticky bottom-0 -mx-4 -mb-5 flex gap-2 border-t bg-white p-3" onSubmit={(e) => { e.preventDefault(); if (chatInput.trim()) askFaq(chatInput); }}>
              <input className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2.5" disabled={chatBusy} placeholder="Ask a question" maxLength={200} value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
              <button className="btn-primary px-5" type="submit" disabled={!chatInput.trim() || chatBusy}>{chatBusy ? "…" : "Send"}</button>
            </form>
            <p className="text-xs text-slate-500">AI Help only picks which fixed answer fits your question, so it can't make up fund facts. Please don&apos;t share PAN or account numbers. {NOT_ADVICE}</p>
          </>
        )}

        {/* ---------- FAILED DEBIT ---------- */}
        {screen === "failed" && (
          <>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-lg font-semibold">Your {inr(sip.amount)} debit on the {ord(sipDay)} didn&apos;t go through</p>
              <p className="mt-2 text-sm text-slate-600">This happens, and nothing is lost. Your SIP is still active. You have time to decide what suits you.</p>
              {onChannels.length > 0 && <p className="mt-2 text-xs text-slate-500">A calm alert was sent via {onChannels.join(", ")} (simulated).</p>}
            </div>
            {atMinimum ? (
              <>
                <p className="text-sm text-slate-600">You are already at the sample minimum, so a lower amount isn&apos;t available. Pausing is the gentle option.</p>
                <button className="btn-primary w-full" onClick={() => { setSip(pauseSip(sip)); log("option_chosen", { option: "pause" }); go("feedback"); }}>Pause for now</button>
              </>
            ) : (
              <>
                <button className={`w-full ${heartbeatPref === "ask" ? "btn-primary" : "btn-secondary"}`} onClick={() => { log("option_chosen", { option: "heartbeat" }); go("note"); }}>
                  Lower it to {inr(SAMPLE_MINIMUM)} for a while
                </button>
                <p className="-mt-2 text-xs text-slate-500">Heartbeat keeps your SIP active for 1 to {MAX_HEARTBEAT_MONTHS} months. {MIN_NOTE}</p>
              </>
            )}
            <button className="btn-secondary w-full" onClick={() => { setText(""); go("ask"); }}>Tell us what&apos;s going on</button>
            <button className="btn-secondary w-full" onClick={() => reset("dashboard")}>Keep as it is</button>
          </>
        )}

        {/* ---------- ALERTS ---------- */}
        {screen === "alerts" && (
          <>
            <p className="text-sm text-slate-600">Choose how you&apos;d like to hear about your SIP. All are off until you switch them on, and you can change this any time. Alerts are calm reminders, never pressure.</p>
            <p className="text-xs text-slate-500">Prototype: no real messages or calls are sent. We never ask for your phone number here; a sample number is used.</p>
            <div className="divide-y rounded-2xl bg-white shadow-sm">
              {CHANNELS.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-slate-500">{c.body}</p>
                    {(c.id === "whatsapp" || c.id === "call" || c.id === "sms") && <p className="text-xs text-slate-400">to +91 98••• ••210 (sample)</p>}
                  </div>
                  <button role="switch" aria-checked={alerts[c.id]} aria-label={`${c.title} alerts`} onClick={() => toggleAlert(c.id)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${alerts[c.id] ? "bg-calm" : "bg-slate-300"}`}>
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${alerts[c.id] ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">Heads-up before each debit</p>
              <p className="text-xs text-slate-500">So you can top up your account if needed.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((d) => (
                  <button key={d} className={leadDays === d ? "btn-primary" : "btn-secondary"} onClick={() => changeLead(d)}>{d} day{d > 1 ? "s" : ""}</button>
                ))}
              </div>
            </div>
            {onChannels.length > 0 && (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm">
                <p className="font-medium">Preview (simulated)</p>
                <p className="mt-1">“Hi, your SIP of {inr(sip.normalAmount)} is due in {leadDays} day{leadDays > 1 ? "s" : ""}, on the {ord(sipDay)}. Nothing is needed from you. If you&apos;d like to change or stop it, you can do that in the app.”</p>
                <p className="mt-1 text-xs text-slate-500">via {onChannels.join(", ")}</p>
              </div>
            )}
          </>
        )}

        {/* ---------- LEARN ---------- */}
        {screen === "learn" && (
          <>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {([["en", "English"], ["hi", "हिंदी"], ["hinglish", "Hinglish"]] as const).map(([id, label]) => (
                <button key={id} className={lang === id ? "btn-primary" : "btn-secondary"} onClick={() => setLang(id)}>{label}</button>
              ))}
            </div>
            {LEARN[lang].map(([t, b]) => (
              <div key={t} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-sm text-slate-600">{b}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-semibold">Investor education</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {LEARN_LINKS.map((l) => (
                  <li key={l.href}><a className="text-calm underline" href={l.href} target="_blank" rel="noreferrer">{l.label}</a></li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-slate-500">{NOT_ADVICE}</p>
          </>
        )}

        {/* ---------- MORE ---------- */}
        {screen === "profile" && (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-calm"><Icon d={ICONS.user} /></span>
              <div><p className="font-semibold">Sample User</p><p className="text-xs text-slate-500">Sample data only</p></div>
            </div>
            <div className="divide-y rounded-2xl bg-white shadow-sm">
              {([
                ["SIP alerts", () => go("alerts")],
                ["Learn about SIPs", () => go("learn")],
                ["Give feedback", () => go("feedback")],
              ] as [string, () => void][]).map(([t, f]) => (
                <button key={t} className="flex w-full items-center justify-between p-4 text-left" onClick={f}>
                  {t}<Icon d={ICONS.chevron} className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
              <p className="font-semibold text-ink">Your privacy</p>
              <p className="mt-1">This prototype never asks for PAN, account numbers or screenshots. We keep only which options were chosen. Your comments are saved only if you tick the consent box.</p>
            </div>
            <button className="btn-secondary w-full" onClick={() => { setSip(initialSip()); setInstalments([1000, 1000, 1000]); setFundName("Sample Flexi Cap Fund"); setSipDay(5); setReasonNote(scenarios.sip.reasonNote); setAi(null); reset("dashboard"); }}>Reset the sample</button>
          </>
        )}

        {/* ---------- AI FLOW ---------- */}
        {screen === "ask" && (
          <>
            <h1 className="text-xl font-semibold">What&apos;s going on?</h1>
            <p className="text-sm text-slate-600">Pick one, or write in Hindi, Hinglish or English. Please don&apos;t share PAN or account numbers.</p>
            {onChannels.length > 0 && <p className="rounded-xl bg-teal-50 p-3 text-xs text-teal-900">A calm alert about this would go to: {onChannels.join(", ")} (simulated).</p>}
            <div className="flex flex-wrap gap-2">
              {scenarios.chips.map((c) => (
                <button key={c.label} className="chip" disabled={loading} onClick={() => submit(c.text)}>{c.label}</button>
              ))}
            </div>
            <textarea className="h-28 w-full rounded-lg border border-slate-300 p-3" placeholder="e.g. is mahine salary late hai" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn-primary w-full" disabled={loading || !text.trim()} onClick={() => submit(text)}>
              {loading ? "Thinking…" : "Continue"}
            </button>
          </>
        )}

        {screen === "ai" && ai && (
          <>
            <h1 className="text-xl font-semibold">About your SIP</h1>
            {ai.kind === "ok" && <p className="rounded-lg bg-soft p-4">{ai.explanation}</p>}
            {ai.kind === "decline" && (
              <div className="rounded-lg bg-soft p-4">
                <p>{ai.explanation}</p>
                <p className="mt-2 text-sm">For general learning:</p>
                <ul className="list-disc pl-5 text-sm">
                  {LEARN_LINKS.map((l) => (
                    <li key={l.href}><a className="text-calm underline" href={l.href} target="_blank" rel="noreferrer">{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
            {ai.kind === "fallback" && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                I&apos;m not sure about this one, so here are your options. <span className="text-xs text-slate-500">(The AI step stepped back on purpose.)</span>
              </p>
            )}
            {ai.kind === "blocked" && <p className="rounded-lg border border-amber-300 bg-amber-50 p-4">{ai.message}</p>}
            <p className="text-xs text-slate-500">{NOT_ADVICE}</p>
            {ai.kind === "blocked" ? (
              <button className="btn-primary w-full" onClick={back}>Go back</button>
            ) : (
              <button className="btn-primary w-full" onClick={() => go("options")}>See your options</button>
            )}
          </>
        )}

        {screen === "options" && (
          <>
            <h1 className="text-xl font-semibold">Your options</h1>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={plain} onChange={(e) => setPlain(e.target.checked)} />
              See the non-AI version
            </label>
            {plain && <p className="text-xs text-slate-500">Same moment, a plain fixed menu with no AI step.</p>}
            {!plain && ai && (ai.kind === "ok" || ai.kind === "decline") && <p className="text-xs text-slate-500">{NOT_ADVICE}</p>}
            {(plain ? (["heartbeat", "pause", "stop"] as OptionId[]) : plan.options)
              .filter((o) => !(o === "heartbeat" && atMinimum))
              .map((o, i) =>
                o === "stop" ? (
                  <button key={o} className="w-full py-2 text-sm text-slate-500 underline-offset-2 hover:underline" onClick={() => choose(o)}>
                    Stop my SIP instead
                  </button>
                ) : (
                  <div key={o} className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold">{OPTION_TEXT[o].title}</p>
                    <p className="mt-1 text-sm text-slate-600">{OPTION_TEXT[o].body}</p>
                    {o === "heartbeat" && <p className="mt-1 text-xs text-slate-500">{MIN_NOTE}</p>}
                    <button className={`mt-3 w-full ${i === 0 ? "btn-primary" : "btn-secondary"}`} onClick={() => choose(o)}>
                      {OPTION_TEXT[o].title}
                    </button>
                  </div>
                ),
              )}
          </>
        )}

        {screen === "help" && (
          <>
            <h1 className="text-xl font-semibold">How this SIP works</h1>
            <p className="text-sm">A SIP debits a fixed sample amount each month. If a debit fails, you can change, pause or stop it at any time. This is sample information only.</p>
            <button className="btn-primary w-full" onClick={back}>Back to options</button>
          </>
        )}

        {screen === "note" && (
          <>
            <h1 className="text-xl font-semibold">Note to Self</h1>
            <p className="text-sm text-slate-600">You wrote this when you started:</p>
            <blockquote className="rounded-lg bg-soft p-4 text-lg">“{reasonNote}”</blockquote>
            <button className="btn-primary w-full" onClick={() => go("confirm")}>Continue</button>
          </>
        )}

        {screen === "confirm" && (
          <>
            <h1 className="text-xl font-semibold">Confirm Heartbeat</h1>
            <p className="text-sm">Pay {inr(SAMPLE_MINIMUM)} a month for:</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((m) => (
                <button key={m} className={months === m ? "btn-primary" : "btn-secondary"} onClick={() => setMonths(m)}>
                  {m} month{m > 1 ? "s" : ""}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">{MIN_NOTE}</p>
            <button className="btn-primary w-full" onClick={() => { setSip(startHeartbeat(sip, months)); log("heartbeat_confirmed", { option: String(months) }); reset("dashboard"); }}>
              Confirm
            </button>
            <button className="btn-secondary w-full" onClick={back}>Back</button>
          </>
        )}

        {screen === "return" && (
          <>
            <h1 className="text-xl font-semibold">Go back to {inr(sip.normalAmount)}?</h1>
            <p className="text-sm text-slate-600">Your Heartbeat period has ended. Your SIP is still active. It&apos;s your choice.</p>
            {(["restore", "stay_lower", "stop"] as ReturnChoice[]).map((c) => (
              <button
                key={c}
                className={c === "restore" ? "btn-primary w-full" : c === "stay_lower" ? "btn-secondary w-full" : "w-full py-2 text-sm text-slate-500 underline-offset-2 hover:underline"}
                onClick={() => {
                  log("return_choice", { option: c });
                  setSip(resolveReturn(sip, c));
                  if (c === "stop") reset("stopped"); else go("feedback");
                }}
              >
                {c === "restore" ? "Yes" : c === "stay_lower" ? `Stay lower (${inr(SAMPLE_MINIMUM)})` : "Stop my SIP instead"}
              </button>
            ))}
          </>
        )}

        {screen === "stop" && (
          <>
            <h1 className="text-xl font-semibold">Stop this SIP?</h1>
            <p className="text-sm">Your sample SIP will end. You can start a new one whenever you like.</p>
            <button className="btn-primary w-full" onClick={back}>Keep my SIP</button>
            <button className="w-full py-2 text-sm text-slate-500 underline-offset-2 hover:underline" onClick={() => { setSip(stopSip(sip)); log("stop_confirmed", { option: "stop" }); reset("stopped"); }}>
              Yes, stop it
            </button>
          </>
        )}

        {screen === "stopped" && (
          <>
            <h1 className="text-xl font-semibold">Your SIP is stopped</h1>
            <p className="text-sm">Nothing more is needed.</p>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-medium">Why did you stop? (optional)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXIT_REASONS.map((r) => (
                  <button key={r} className={`chip ${exitReason === r ? "border-calm bg-teal-50" : ""}`} onClick={() => { setExitReason(r); log("exit_reason", { option: r.slice(0, 30) }); }}>{r}</button>
                ))}
              </div>
              {exitReason && <p className="mt-2 text-xs text-slate-500">Thank you. This only helps us improve.</p>}
            </div>
            <button className="btn-primary w-full" onClick={() => go("feedback")}>Continue</button>
          </>
        )}

        {screen === "feedback" && (
          <>
            <h1 className="text-xl font-semibold">Did this help?</h1>
            <div className="grid grid-cols-2 gap-3">
              <button className={helped === true ? "btn-primary" : "btn-secondary"} onClick={() => setHelped(true)}>Yes</button>
              <button className={helped === false ? "btn-primary" : "btn-secondary"} onClick={() => setHelped(false)}>No</button>
            </div>
            <textarea className="h-24 w-full rounded-lg border border-slate-300 p-3" placeholder="Optional comment" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              You may save my comment. Otherwise only my Yes/No is kept.
            </label>
            <button className="btn-primary w-full" disabled={helped === null} onClick={sendFeedback}>Send</button>
            <button className="text-sm text-slate-500 underline" onClick={() => reset("dashboard")}>Skip</button>
          </>
        )}

        {screen === "thanks" && (
          <>
            <h1 className="text-xl font-semibold">Thank you</h1>
            <button className="btn-primary w-full" onClick={() => reset("dashboard")}>Back to dashboard</button>
          </>
        )}
      </main>

      {showNav && (
        <nav className="grid grid-cols-4 border-t bg-white text-[11px]">
          {([
            ["mf", "Mutual Funds", ICONS.pie, () => reset("dashboard")],
            ["alerts", "Alerts", ICONS.bell, () => reset("alerts")],
            ["learn", "Learn", ICONS.book, () => reset("learn")],
            ["profile", "More", ICONS.more, () => reset("profile")],
          ] as [string, string, string, () => void][]).map(([id, label, d, f]) => (
            <button key={id} className={`flex flex-col items-center gap-0.5 py-2 ${activeNav === id ? "font-semibold text-calm" : "text-slate-500"}`} onClick={f}>
              <Icon d={d} className="h-6 w-6" />{label}
            </button>
          ))}
        </nav>
      )}
      <footer className="bg-white px-4 py-3 text-xs text-slate-500">
        <p>Nothing here is investment advice. No fund or stock is recommended.</p>
        <p className="mt-1">{score}</p>
      </footer>
    </div>
  );
}
