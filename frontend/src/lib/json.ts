/** JSON with bigint support (bigints are sent as decimal strings). */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}



type JsonRes = { status(code: number): { setHeader(k: string, v: string): unknown; send(body: string): unknown } };

export function sendJson(res: JsonRes, value: unknown, status = 200): void {
  const r = res.status(status);
  r.setHeader("content-type", "application/json");
  r.send(toJson(value));
}

export function sendError(res: JsonRes, err: unknown, status = 400): void {
  const message = err instanceof Error ? err.message : String(err);
  sendJson(res, { error: message.split("\n")[0]?.slice(0, 500) }, status);
}
