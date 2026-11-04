import { NextRequest, NextResponse } from "next/server";
import { EventSchema } from "@/lib/schema";
import { logEvent } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const parsed = EventSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
    logEvent(parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    // Logging must never break the user flow.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
