import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// LetterCard: the fields the model fills. Anything not printed in the letter is null.

export const SENDER_TYPES = [
  "tax_office",
  "broadcasting_fee",
  "immigration_office",
  "jobcenter",
  "employment_agency",
  "health_insurance",
  "landlord",
  "utility",
  "bank",
  "debt_collector",
  "court",
  "police",
  "university",
  "employer",
  "other",
] as const;

export const MAX_KEY_TERMS = 5;

const isoDate = z.iso.date();

export const SenderTypeSchema = z.enum(SENDER_TYPES);

export const RelativePeriodSchema = z.object({
  count: z.number().int().positive(),
  unit: z.enum(["day", "week", "month"]),
  from: z.enum(["letter_date", "receipt", "other"]),
});

export const DeadlineSchema = z.object({
  kind: z.enum(["fixed", "relative", "none"]),
  date: isoDate.nullable(),
  relative_period: RelativePeriodSchema.nullable(),
  original_text: z.string().nullable(),
  translation: z.string().nullable(),
});

export const LetterCardSchema = z.object({
  readable: z.boolean(),
  unreadable_reason: z.string().nullable(),
  sender: z.object({
    name: z.string(),
    type: SenderTypeSchema,
  }),
  letter_type: z.string(),
  letter_date: isoDate.nullable(),
  summary: z.string(),
  what_they_want: z.array(z.string()),
  deadline: DeadlineSchema,
  amount: z
    .object({
      value: z.number(),
      currency: z.literal("EUR"),
      what_for: z.string(),
      original_text: z.string(),
    })
    .nullable(),
  payment: z
    .object({
      recipient: z.string().nullable(),
      iban: z.string().nullable(),
      reference: z.string().nullable(),
    })
    .nullable(),
  reference_numbers: z.array(z.object({ label: z.string(), value: z.string() })),
  if_ignored: z.string().nullable(),
  enforcement_language: z.boolean(),
  key_terms: z.array(
    z.object({ german: z.string(), english: z.string(), meaning: z.string() }),
  ),
  caution_flags: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
});

export type SenderType = z.infer<typeof SenderTypeSchema>;
export type RelativePeriod = z.infer<typeof RelativePeriodSchema>;
export type Deadline = z.infer<typeof DeadlineSchema>;
export type LetterCard = z.infer<typeof LetterCardSchema>;

/**
 * Cross-field rules the JSON schema cannot express. Messages name the field
 * and the rule only, never the value, so they are safe to send back to the model.
 */
export function consistencyIssues(card: LetterCard): string[] {
  const issues: string[] = [];
  if (!card.readable && !card.unreadable_reason) {
    issues.push("unreadable_reason: required when readable is false");
  }
  const d = card.deadline;
  if (d.kind === "fixed") {
    if (!d.date) issues.push('deadline.date: required when kind is "fixed"');
    if (d.relative_period) issues.push('deadline.relative_period: must be null when kind is "fixed"');
  } else if (d.kind === "relative") {
    if (!d.relative_period) issues.push('deadline.relative_period: required when kind is "relative"');
    if (d.date) issues.push('deadline.date: must be null when kind is "relative"');
  } else {
    if (d.date) issues.push('deadline.date: must be null when kind is "none"');
    if (d.relative_period) issues.push('deadline.relative_period: must be null when kind is "none"');
  }
  return issues;
}

export type ValidationResult =
  | { ok: true; card: LetterCard }
  | { ok: false; issues: string[] };

/** Validate raw model output: schema first, then cross-field rules. */
export function validateLetterCard(raw: unknown): ValidationResult {
  const parsed = LetterCardSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    };
  }
  const issues = consistencyIssues(parsed.data);
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    card: { ...parsed.data, key_terms: parsed.data.key_terms.slice(0, MAX_KEY_TERMS) },
  };
}

/**
 * Structured output format derived from the Zod schema. The SDK helper strips constraints
 * the API does not support; validateLetterCard checks them in code.
 */
export const letterCardOutputFormat = betaZodOutputFormat(LetterCardSchema);
