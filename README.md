# Grow More (concept prototype, featuring SIP Heartbeat)

Concept prototype with sample data. Not affiliated with any investing app. Nothing here is investment advice.

## Run

```
npm install
cp .env.example .env     # fill AI_API_KEY, AI_BASE_URL (OpenAI-compatible), AI_MODEL, ADMIN_PASSWORD
npm run dev              # or: npm run build && npm start
npm test                 # rules, safety and help tests
npm run eval             # golden-set score -> evals/results.json
```

Without an AI key the app still works: the AI steps step back and use rules and keyword matching.

## Where things are

- `lib/rules.ts` options table and SIP status logic (no AI involved in money decisions)
- `lib/ai.ts`, `lib/safety.ts` model call and the safety layers
- `lib/faq.ts`, `lib/faqAi.ts` AI Help: AI only picks which fixed answer applies
- `lib/db.ts` SQLite event log; free text saved only with the user's consent box
- `/admin` Basic auth, password from `ADMIN_PASSWORD`; CSV at `/api/admin/export`
- `evals/golden.json` 20 drafted messages with `expected_reason` left blank. **Label them by hand**, then `npm run eval`. The app footer shows the score from `evals/results.json`.

## Deploy under a sub-path (for example `/projects/growmore`)

Set `NEXT_PUBLIC_BASE_PATH=/projects/growmore` in the server's `.env` **before** `npm run build` (it is applied at build time). Run under PM2 with `ecosystem.config.js` (set the port there), and proxy `location /projects/growmore` to that port in Nginx. Keep `DATABASE_PATH` outside the deploy folder, for example `/var/lib/growmore/events.db`. Never commit `.env`.

## Diagnosing AI failures

Failures are logged as one `[ai-failure] {...}` line (type, HTTP status, provider message; never keys, prompts or user text). On the server: `pm2 logs <app> --lines 100 | grep ai-failure`. To test the setup from inside the server environment, run `npm run check:ai` in the app folder. It checks the env values, provider reachability, the model, the key, and both request formats, without printing the key.
