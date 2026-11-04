import { sessionSummary } from "@/lib/db";
import { BASE } from "@/lib/base";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

export default function Admin() {
  const rows = sessionSummary();
  const n = rows.length || 1;
  const pct = (x: number) => `${Math.round((x / n) * 100)}%`;
  const heartbeat = rows.filter((r) => r.option === "heartbeat").length;
  const completed = rows.filter((r) => r.completed).length;
  const fallback = rows.filter((r) => r.fallback).length;
  return (
    <main className="mx-auto max-w-3xl p-4 text-sm">
      <h1 className="text-xl font-semibold">Test sessions</h1>
      <p className="my-3">
        {rows.length} sessions · Heartbeat take-up {pct(heartbeat)} · Completion {pct(completed)} · Fallback rate{" "}
        {pct(fallback)}
      </p>
      <a className="text-calm underline" href={`${BASE}/api/admin/export`}>Download CSV</a>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              {["Session", "Started", "Reason", "Chose", "Completed", "Fallback", "Helped", "Comment"].map((h) => (
                <th key={h} className="p-1">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.session_id} className="border-b">
                <td className="p-1">{r.session_id.slice(0, 8)}</td>
                <td className="p-1">{r.started}</td>
                <td className="p-1">{r.reason ?? ""}</td>
                <td className="p-1">{r.option ?? ""}</td>
                <td className="p-1">{r.completed ? "yes" : "no"}</td>
                <td className="p-1">{r.fallback ? "yes" : "no"}</td>
                <td className="p-1">{r.helped == null ? "" : r.helped ? "yes" : "no"}</td>
                <td className="p-1">{r.comment ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
