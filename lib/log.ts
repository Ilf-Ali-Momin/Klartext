// The only server logger. It takes no free text, so letter content and model output cannot reach the logs.

export function logError(requestId: string, type: string, status: number): void {
  console.error(JSON.stringify({ level: "error", requestId, type, status }));
}
