# Grow More (concept prototype, featuring SIP Heartbeat)

Concept prototype with sample data. Not affiliated with any investing app. Nothing here is investment advice.

## Run

```
npm install
cp .env.example .env     # fill AI_API_KEY, AI_BASE_URL (OpenAI-compatible), AI_MODEL, ADMIN_PASSWORD
npm run dev              # or: npm run build && npm start
npm test                 # rules + safety tests
npm run eval             # golden-set score -> evals/results.json
```

Without an AI key the app still works: the AI step steps back and shows the rules-based options.

## Where things are

- `lib/rules.ts` options table and SIP status logic (no AI involved in money decisions)
- `lib/ai.ts`, `lib/safety.ts` model call and the six safety layers
- `lib/db.ts` SQLite event log; free text saved only with the user's consent box
- `/admin` Basic auth, password from `ADMIN_PASSWORD`; CSV at `/api/admin/export`
- `evals/golden.json` 20 drafted messages with `expected_reason` left blank. **Label them by hand**, then `npm run eval`. The app footer shows the score from `evals/results.json`.

## Deploy (Phase 6)

`ecosystem.config.js` runs on port 3107 under PM2. Put `.env` on the server only, and set `DATABASE_PATH` to a folder outside the deploy directory (for example `/var/lib/sip-heartbeat/events.db`). Use a separate Nginx server block, then Certbot.
