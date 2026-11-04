import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/** Reads the latest eval result from evals/results.json. Never hardcoded. */
export async function GET() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "evals", "results.json"), "utf8");
    const r = JSON.parse(raw);
    return NextResponse.json({
      available: typeof r.agreement === "number" && r.labelled > 0,
      agreement: r.agreement,
      labelled: r.labelled,
      safetyFailures: r.safetyFailures,
      ranAt: r.ranAt,
    });
  } catch {
    return NextResponse.json({ available: false });
  }
}
