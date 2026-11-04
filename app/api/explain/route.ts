import { NextRequest, NextResponse } from "next/server";
import { explain } from "@/lib/ai";
import { allow } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!allow(ip)) {
    // Rate limited: same safe fallback the user would see on any AI failure.
    return NextResponse.json({ kind: "fallback", why: "error" });
  }
  let body: { text?: unknown; sip?: { amount?: number; month?: number; totalMonths?: number; status?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ kind: "fallback", why: "error" });
  }
  const text = typeof body.text === "string" ? body.text : "";
  const sip = {
    amount: Number(body.sip?.amount) || 1000,
    month: Number(body.sip?.month) || 4,
    totalMonths: 12,
    status: String(body.sip?.status ?? "active").slice(0, 20),
  };
  return NextResponse.json(await explain(text, sip));
}
