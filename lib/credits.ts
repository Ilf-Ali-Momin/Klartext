import { randomInt } from "node:crypto";
import { PACKS, type Pack } from "@/lib/config";
import { isPublicDemo } from "@/lib/demo";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";

// Paid credit codes: create after payment, reserve before a model call, refund when the call fails.

export const CODE_COOKIE = "bk_code";
export const CODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;

/** No 0/O, 1/I/L, so codes survive being read aloud or written down. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 10;

export function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Accepts what a person types: lower case, spaces and dashes. Returns null if it cannot be a code. */
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) if (!CODE_ALPHABET.includes(char)) return null;
  return code;
}

/** ABCDE-FGHJK */
export function formatCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function packById(id: string): Pack | undefined {
  return PACKS.find((pack) => pack.id === id);
}

/** Start of the current hour in UTC, the bucket for paid request limits. */
export function hourBucket(now: Date = new Date()): string {
  return `${now.toISOString().slice(0, 13)}:00:00.000Z`;
}

export class CodeTakenError extends Error {}

export interface CreditStore {
  /** Create the credit for a Checkout session, or return the code it already has. */
  create(input: { code: string; sessionId: string; pack: string; credits: number }): Promise<string>;
  /** Take one credit. Returns the credits left afterwards, or null if the code is unknown or empty. */
  reserve(code: string): Promise<number | null>;
  /** Give back one credit. Returns the credits left afterwards, or null if the code is unknown. */
  refund(code: string): Promise<number | null>;
  /** Credits left, or null if the code is unknown. */
  creditsLeft(code: string): Promise<number | null>;
  /** Count one request for the code in this hour. False when the limit is reached or the code is unknown. */
  consumeHourly(code: string, hour: string, limit: number): Promise<boolean>;
}

/**
 * Create credits for a paid session with a fresh code. Safe to call from both the webhook and the
 * success page: the second call returns the code the first one created.
 */
export async function claimCredits(
  store: CreditStore,
  input: { sessionId: string; packId: string },
  newCode: () => string = generateCode,
): Promise<string> {
  const pack = packById(input.packId);
  if (!pack) throw new Error("Unknown pack");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await store.create({ code: newCode(), sessionId: input.sessionId, pack: pack.id, credits: pack.letters });
    } catch (error) {
      if (!(error instanceof CodeTakenError)) throw error;
    }
  }
  throw new Error("Could not create a unique code");
}

export function memoryCreditStore(): CreditStore {
  const rows = new Map<string, { sessionId: string; total: number; left: number }>();
  const usage = new Map<string, number>();
  return {
    async create({ code, sessionId, credits }) {
      for (const [existingCode, row] of rows) if (row.sessionId === sessionId) return existingCode;
      if (rows.has(code)) throw new CodeTakenError();
      rows.set(code, { sessionId, total: credits, left: credits });
      return code;
    },
    async reserve(code) {
      const row = rows.get(code);
      if (!row || row.left <= 0) return null;
      row.left -= 1;
      return row.left;
    },
    async refund(code) {
      const row = rows.get(code);
      if (!row) return null;
      row.left = Math.min(row.left + 1, row.total);
      return row.left;
    },
    async creditsLeft(code) {
      return rows.get(code)?.left ?? null;
    },
    async consumeHourly(code, hour, limit) {
      if (!rows.has(code)) return false;
      const key = `${code}:${hour}`;
      const count = usage.get(key) ?? 0;
      if (count >= limit) return false;
      usage.set(key, count + 1);
      return true;
    },
  };
}

const UNIQUE_VIOLATION = "23505";

export function supabaseCreditStore(): CreditStore {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabaseAdmin().rpc(name, args);
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new CodeTakenError();
      throw new Error(`${name} failed`);
    }
    return data as T;
  }
  return {
    create: ({ code, sessionId, pack, credits }) =>
      rpc<string>("create_credit", {
        p_code: code,
        p_stripe_session_id: sessionId,
        p_pack: pack,
        p_credits: credits,
      }),
    reserve: (code) => rpc<number | null>("reserve_credit", { p_code: code }),
    refund: (code) => rpc<number | null>("refund_credit", { p_code: code }),
    creditsLeft: (code) => rpc<number | null>("credits_left", { p_code: code }),
    consumeHourly: async (code, hour, limit) =>
      (await rpc<boolean>("consume_paid_usage", { p_code: code, p_hour: hour, p_limit: limit })) === true,
  };
}

// Kept on globalThis so every route bundle in `next dev` shares one store.
const devStores = globalThis as typeof globalThis & { __bkCreditStore?: CreditStore };

/** Supabase when configured. In development without Supabase, an in-memory store for this process. */
export function creditStore(): CreditStore {
  if (isSupabaseConfigured()) return supabaseCreditStore();
  if (process.env.NODE_ENV === "production" && !isPublicDemo()) throw new Error("Supabase is not configured");
  devStores.__bkCreditStore ??= memoryCreditStore();
  return devStores.__bkCreditStore;
}
