/**
 * Diagnoses the AI setup from inside the running environment (run it on the VPS, in the app folder).
 * Prints only booleans, status codes, timings and sanitized provider messages. Never the key.
 *   npm run check:ai
 */
import fs from "fs";
import path from "path";
import { chatJson } from "../lib/ai";
import { toAiError, sanitize } from "../lib/aiError";
import { AI_TIMEOUT_MS } from "../lib/config";

function loadEnvFile() {
  for (const name of [".env", ".env.production"]) {
    const f = path.join(process.cwd(), name);
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const ok = (b: boolean) => (b ? "OK  " : "FAIL");

async function timed<T>(fn: () => Promise<T>): Promise<[T | undefined, unknown, number]> {
  const t = Date.now();
  try {
    return [await fn(), undefined, Date.now() - t];
  } catch (e) {
    return [undefined, e, Date.now() - t];
  }
}

async function main() {
  loadEnvFile();
  const key = process.env.AI_API_KEY;
  const base = (process.env.AI_BASE_URL ?? "").replace(/\/$/, "");
  const model = process.env.AI_MODEL ?? "";
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || AI_TIMEOUT_MS;

  console.log("1. Environment (values are not printed)");
  console.log(`   ${ok(!!key)} AI_API_KEY is set (${key ? `${key.length} characters` : "missing"})`);
  console.log(`   ${ok(!!base)} AI_BASE_URL = ${base || "(missing)"}`);
  console.log(`   ${ok(!!model)} AI_MODEL    = ${model || "(missing)"}`);
  console.log(`   style = ${process.env.AI_API_STYLE === "chat" ? "chat" : "responses"}, timeout = ${timeoutMs} ms`);
  if (!key || !base || !model) {
    console.log("\nStop here: set the missing values in the .env that sits next to package.json, then restart the service.");
    process.exit(1);
  }

  console.log("\n2. Can this server reach the provider?");
  const [models, mErr, mMs] = await timed(async () => {
    const r = await fetch(`${base}/models`, { signal: AbortSignal.timeout(10000) });
    return { status: r.status, body: r.ok ? ((await r.json()) as { data?: { id: string }[] }) : undefined };
  });
  if (mErr || !models) {
    console.log(`   FAIL cannot reach ${base}/models: ${toAiError(mErr).type} ${sanitize((mErr as Error)?.message)} (${mMs} ms)`);
  } else {
    console.log(`   ${ok(models.status === 200)} GET /models -> ${models.status} (${mMs} ms)`);
    const ids = models.body?.data?.map((m) => m.id) ?? [];
    if (ids.length) console.log(`   ${ok(ids.includes(model))} model "${model}" is ${ids.includes(model) ? "listed" : "NOT listed by the provider"}`);
  }

  console.log("\n3. Is the key accepted?");
  const [kr, kErr, kMs] = await timed(async () => {
    const r = await fetch(`${base}/key`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
    return { status: r.status, msg: r.ok ? "" : sanitize(await r.text()) };
  });
  if (kErr || !kr) console.log(`   FAIL ${toAiError(kErr).type} (${kMs} ms)`);
  else console.log(`   ${ok(kr.status === 200)} GET /key -> ${kr.status} (${kMs} ms) ${kr.msg}`);

  console.log("\n4. Real model call, both request formats (tiny prompt, no user data)");
  const sys = 'Reply with JSON only: {"reason":"salary_late","confidence":0.9,"language":"en","explanation":"ok"}';
  for (const style of ["responses", "chat"]) {
    process.env.AI_API_STYLE = style;
    const [res, err, ms] = await timed(() => chatJson(sys, "Salary is late this month"));
    if (err) {
      const a = toAiError(err);
      console.log(`   FAIL ${style.padEnd(9)} ${a.type}${a.status ? ` ${a.status}` : ""} ${a.providerMessage ?? ""} (${ms} ms)`);
    } else {
      console.log(`   OK   ${style.padEnd(9)} parsed JSON in ${ms} ms${ms > timeoutMs * 0.75 ? "  (close to the timeout!)" : ""} -> ${JSON.stringify(res).slice(0, 90)}`);
    }
  }
  console.log("\nSet AI_API_STYLE in .env to the format that shows OK, then restart the service.");
}

main();
