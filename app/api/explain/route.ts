import { NextRequest, NextResponse } from "next/server";
import { explain } from "@/lib/ai";
import { AiError, logAiFailure } from "@/lib/aiError";
import { allow } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  // Behind Nginx the client IP arrives in x-forwarded-for / x-real-ip.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  if (!allow(ip)) {
    logAiFailure("explain", new AiError("rate_limited"));
    return NextResponse.json({ kind: "fallback", why: "rate_limited", cause: "service" });
  }
  let body: { text?: unknown; sip?: { amount?: number; month?: number; totalMonths?: number; status?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ kind: "fallback", why: "bad_request", cause: "service" });
  }
  const text = typeof body.text === "string" ? body.text : "";
  // Only the fields the model needs; nothing else is forwarded.
  const sip = {
    amount: Number(body.sip?.amount) || 1000,
    month: Number(body.sip?.month) || 4,
    totalMonths: 12,
    status: String(body.sip?.status ?? "active").slice(0, 20),
  };
  return NextResponse.json(await explain(text, sip));
}
