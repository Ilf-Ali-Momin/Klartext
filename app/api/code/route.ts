import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleCode } from "@/lib/api/payments";
import { creditStore } from "@/lib/credits";
import { logError } from "@/lib/log";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    return await handleCode(request, { store: creditStore(), requestId });
  } catch (error) {
    logError(requestId, error instanceof Error ? error.name : "unknown", 500);
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong. Please try again." },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}
