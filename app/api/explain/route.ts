import type { NextRequest } from "next/server";
import { errorResponse, handleExplain } from "@/lib/api/explain";
import { logError } from "@/lib/log";
import { freeUsageStore, ipHashSalt } from "@/lib/ratelimit";

// Two model attempts on a multi page letter can take a while.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!process.env.ANTHROPIC_API_KEY) return errorResponse("not_configured", requestId);
  try {
    return await handleExplain(request, { store: freeUsageStore(), salt: ipHashSalt(), requestId });
  } catch (error) {
    logError(requestId, error instanceof Error ? error.name : "unknown", 500);
    return errorResponse("server_error", requestId);
  }
}
