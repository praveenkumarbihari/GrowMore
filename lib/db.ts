import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { EventInput } from "./schema";

let db: Database.Database | null = null;

function get(): Database.Database {
  if (db) return db;
  const file = process.env.DATABASE_PATH ?? "./data/events.db";
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event TEXT NOT NULL,
    reason TEXT,
    option TEXT,
    fallback INTEGER,
    helped INTEGER,
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  return db;
}

/** Free text is stored only when the user ticked the consent box. */
export function logEvent(e: EventInput) {
  get()
    .prepare(
      `INSERT INTO events (session_id, event, reason, option, fallback, helped, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      e.sessionId,
      e.event,
      e.reason ?? null,
      e.option ?? null,
      e.fallback === undefined ? null : Number(e.fallback),
      e.helped === undefined ? null : Number(e.helped),
      e.consent && e.comment ? e.comment : null,
    );
}

export type SessionRow = {
  session_id: string;
  started: string;
  events: number;
  reason: string | null;
  option: string | null;
  completed: number;
  fallback: number;
  helped: number | null;
  comment: string | null;
};

export function sessionSummary(): SessionRow[] {
  return get()
    .prepare(
      `SELECT session_id, MIN(created_at) AS started, COUNT(*) AS events,
         MAX(reason) AS reason,
         MAX(CASE WHEN event='option_chosen' THEN option END) AS option,
         MAX(CASE WHEN event='return_choice' THEN 1 ELSE 0 END) AS completed,
         MAX(COALESCE(fallback,0)) AS fallback,
         MAX(helped) AS helped,
         MAX(comment) AS comment
       FROM events GROUP BY session_id ORDER BY started DESC`,
    )
    .all() as SessionRow[];
}

export function toCsv(rows: SessionRow[]): string {
  const head = ["session_id", "started", "events", "reason", "option", "completed", "fallback", "helped", "comment"];
  const esc = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // avoid spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) => head.map((h) => esc((r as Record<string, unknown>)[h])).join(","));
  return [head.join(","), ...lines].join("\n");
}
