// Product limits and credit packs. Prices live in Stripe, not in code.

export const FREE_LETTERS_PER_DEVICE = 1; // tracked by httpOnly cookie
export const FREE_LETTERS_PER_IP_PER_DAY = 3; // tracked in free_usage
export const PAID_REQUESTS_PER_CODE_PER_HOUR = 20;
export const MAX_IMAGES = 4;
export const MAX_UPLOAD_MB = 4;

export type PackId = "pack5" | "pack15";

export interface Pack {
  id: PackId;
  letters: number;
  priceEnv: "STRIPE_PRICE_PACK5" | "STRIPE_PRICE_PACK15";
}

export const PACKS: readonly Pack[] = [
  { id: "pack5", letters: 5, priceEnv: "STRIPE_PRICE_PACK5" },
  { id: "pack15", letters: 15, priceEnv: "STRIPE_PRICE_PACK15" },
];

export const DEFAULT_LLM_MODEL = "claude-sonnet-5-5";
