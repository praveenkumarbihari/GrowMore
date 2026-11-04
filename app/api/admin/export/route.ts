import { NextResponse } from "next/server";
import { sessionSummary, toCsv } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(toCsv(sessionSummary()), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="sessions.csv"',
    },
  });
}
