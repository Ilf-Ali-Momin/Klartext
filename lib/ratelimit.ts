import { createHash } from "node:crypto";
import { FREE_LETTERS_PER_DEVICE } from "@/lib/config";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";

// Free tier limits: one letter per device (httpOnly cookie) and a daily cap per hashed IP address.

export const FREE_COOKIE = "bk_free";
export const FREE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface FreeUsageStore {
  /** Atomically count one free letter. Returns false when the daily limit is reached. */
  consume(ipHash: string, day: string, limit: number): Promise<boolean>;
  /** Give back a free letter that was not used. */
  release(ipHash: string, day: string): Promise<void>;
}

export function hashIp(ip: string, salt: string, day: string): string {
  return createHash("sha256").update(`${ip}${salt}${day}`).digest("hex");
}

/** The client IP as set by the hosting proxy. Falls back to a constant so a missing header shares one bucket. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export function freeLettersUsed(cookieValue: string | undefined): number {
  const used = Number.parseInt(cookieValue ?? "0", 10);
  return Number.isFinite(used) && used > 0 ? used : 0;
}

export function hasFreeLetterLeft(cookieValue: string | undefined): boolean {
  return freeLettersUsed(cookieValue) < FREE_LETTERS_PER_DEVICE;
}

export function ipHashSalt(): string {
  const salt = process.env.IP_HASH_SALT;
  if (salt) return salt;
  if (process.env.NODE_ENV === "production") throw new Error("IP_HASH_SALT is not set");
  return "development-only-salt";
}

export function memoryFreeUsageStore(): FreeUsageStore {
  const counts = new Map<string, number>();
  const key = (ipHash: string, day: string) => `${ipHash}:${day}`;
  return {
    async consume(ipHash, day, limit) {
      const current = counts.get(key(ipHash, day)) ?? 0;
      if (current >= limit) return false;
      counts.set(key(ipHash, day), current + 1);
      return true;
    },
    async release(ipHash, day) {
      const current = counts.get(key(ipHash, day)) ?? 0;
      counts.set(key(ipHash, day), Math.max(current - 1, 0));
    },
  };
}

export function supabaseFreeUsageStore(): FreeUsageStore {
  return {
    async consume(ipHash, day, limit) {
      const { data, error } = await supabaseAdmin().rpc("consume_free_usage", {
        p_ip_hash: ipHash,
        p_day: day,
        p_limit: limit,
      });
      if (error) throw new Error("consume_free_usage failed");
      return data === true;
    },
    async release(ipHash, day) {
      const { error } = await supabaseAdmin().rpc("release_free_usage", { p_ip_hash: ipHash, p_day: day });
      if (error) throw new Error("release_free_usage failed");
    },
  };
}

// Kept on globalThis so every route bundle in `next dev` shares one store.
const devStores = globalThis as typeof globalThis & { __bkFreeUsageStore?: FreeUsageStore };

/** Supabase when configured. In development without Supabase, an in-memory store for this process. */
export function freeUsageStore(): FreeUsageStore {
  if (isSupabaseConfigured()) return supabaseFreeUsageStore();
  if (process.env.NODE_ENV === "production") throw new Error("Supabase is not configured");
  devStores.__bkFreeUsageStore ??= memoryFreeUsageStore();
  return devStores.__bkFreeUsageStore;
}
