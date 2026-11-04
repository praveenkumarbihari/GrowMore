import { z } from "zod";

export const REASONS = [
  "salary_late",
  "money_tight",
  "debit_failed",
  "market_worry",
  "returns_doubt",
  "app_confusion",
  "life_event",
  "wants_advice",
  "wants_to_exit",
  "unclear",
] as const;
export type Reason = (typeof REASONS)[number];

export const AiOutputSchema = z.object({
  reason: z.enum(REASONS),
  confidence: z.number().min(0).max(1),
  language: z.enum(["en", "hi", "hinglish"]),
  explanation: z
    .string()
    .min(1)
    .refine((s) => s.trim().split(/\s+/).length <= 40, "max 40 words"),
});
export type AiOutput = z.infer<typeof AiOutputSchema>;

export const EventSchema = z.object({
  sessionId: z.string().min(8).max(64),
  event: z.string().min(1).max(40),
  reason: z.string().max(30).optional(),
  option: z.string().max(30).optional(),
  fallback: z.boolean().optional(),
  helped: z.boolean().optional(),
  comment: z.string().max(500).optional(),
  consent: z.boolean().optional(),
});
export type EventInput = z.infer<typeof EventSchema>;
