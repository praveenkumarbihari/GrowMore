import { NextRequest, NextResponse } from "next/server";
import { answerWithAi } from "@/lib/faqAi";
import { answer } from "@/lib/faq";
import { allow } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  let body: { q?: unknown; ctx?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ kind: "unknown", text: "Sorry, something went wrong.", viaAi: false });
  }
  const c = body.ctx ?? {};
  const ctx = {
    name: String(c.name ?? "this fund").slice(0, 60),
    category: String(c.category ?? "").slice(0, 30),
    about: String(c.about ?? "").slice(0, 300),
    min: Number(c.min) || 100,
    risk: String(c.risk ?? "").slice(0, 20),
    reasonNote: String(c.reasonNote ?? "my reason").slice(0, 60),
  };
  const q = typeof body.q === "string" ? body.q : "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  // Rate limited: skip the model, use keyword matching only.
  if (!allow(ip)) return NextResponse.json({ ...answer(q, ctx), viaAi: false });
  return NextResponse.json(await answerWithAi(q, ctx));
}
