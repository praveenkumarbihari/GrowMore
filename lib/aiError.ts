export type AiErrorType = "config" | "timeout" | "network" | "http" | "empty" | "parse" | "schema" | "rate_limited" | "unknown";

/** A model-call failure with just enough detail to diagnose it. Never carries prompts or user text. */
export class AiError extends Error {
  constructor(
    public type: AiErrorType,
    public status?: number,
    public providerMessage?: string,
  ) {
    super(type === "config" ? "no_key" : `${type}${status ? `_${status}` : ""}`);
    this.name = "AiError";
  }
}

/** Strip anything that looks like a secret and cap the length. */
export function sanitize(msg: unknown, max = 200): string {
  return String(msg ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(sk|or|pk)-[A-Za-z0-9_-]{6,}\b/gi, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Classify any thrown value into an AiError (aborts, network errors, validation errors). */
export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const err = e as { name?: string; message?: string; cause?: { code?: string } };
  if (err?.name === "AbortError") return new AiError("timeout");
  if (err?.name === "ZodError") return new AiError("schema");
  if (err?.name === "SyntaxError") return new AiError("parse");
  if (err instanceof TypeError || err?.cause?.code) {
    return new AiError("network", undefined, sanitize(err?.cause?.code ?? err?.message));
  }
  return new AiError("unknown", undefined, sanitize(err?.message, 80));
}

/** One log line per failure: type, status and the provider's error message. No keys, prompts or user text. */
export function logAiFailure(scope: string, e: unknown) {
  const a = toAiError(e);
  let host = "";
  try { host = new URL(process.env.AI_BASE_URL ?? "").host; } catch { /* unset */ }
  console.error(
    "[ai-failure] " +
      JSON.stringify({
        scope,
        type: a.type,
        status: a.status,
        message: a.providerMessage ? sanitize(a.providerMessage) : undefined,
        model: process.env.AI_MODEL,
        host,
        style: process.env.AI_API_STYLE === "chat" ? "chat" : "responses",
      }),
  );
}
