import { Client } from "@neondatabase/serverless";
import { SNAPSHOT_SQL, mapSnapshot, publicSnapshot, type SnapshotRow } from "@/lib/realtime/snapshot";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const leagueId = new URL(req.url).searchParams.get("leagueId") || "league-main";
  const connectionString = process.env.DATABASE_DIRECT_URL;
  let validConnection = false;
  try {
    const url = new URL(connectionString || "");
    validConnection = ["postgres:", "postgresql:"].includes(url.protocol) && !url.hostname.includes("-pooler");
  } catch { /* Invalid configuration returns a sanitized error. */ }
  if (!validConnection || !connectionString) {
    return Response.json({ error: "Realtime requires a direct Neon connection configured server-side" }, { status: 503 });
  }
  if (!leagueId || leagueId.length > 200) return Response.json({ error: "Invalid leagueId" }, { status: 400 });

  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  const encoder = new TextEncoder();
  let closed = false;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let reading = false;
  let dirty = false;
  let lastRevision = -1;
  let timerRequest: AbortController | undefined;
  let expiryGeneration = 0;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    clearTimeout(expiry);
    timerRequest?.abort();
    req.signal.removeEventListener("abort", cleanup);
    void client.end().catch(() => {});
    try { controller?.close(); } catch { /* Already cancelled. */ }
  };
  const send = (value: string) => {
    if (closed) return;
    // Disconnect slow readers rather than accumulate unlimited snapshots.
    if (controller && (controller.desiredSize ?? 0) <= 0) { cleanup(); return; }
    controller?.enqueue(encoder.encode(value));
  };
  const scheduleExpiry = (snapshot: ReturnType<typeof mapSnapshot>) => {
    const generation = ++expiryGeneration;
    clearTimeout(expiry);
    timerRequest?.abort();
    const session = snapshot.session;
    if (session.status !== "IN_PROGRESS" || !session.currentPlayerId || !session.timerExpiresAt) return;
    const deadline = Date.parse(session.timerExpiresAt);
    if (!Number.isFinite(deadline)) return;
    let retries = 0;
    const resolveExpiry = async () => {
      if (closed || generation !== expiryGeneration) return;
      timerRequest = new AbortController();
      const request = timerRequest;
      const timeout = setTimeout(() => request.abort(), 10000);
      try {
        const url = new URL("/api/auction/state", req.url);
        url.searchParams.set("leagueId", leagueId);
        const response = await fetch(url, { cache: "no-store", signal: request.signal });
        if (!response.ok) throw new Error("Timer resolution unavailable");
        const result = await response.json();
        // Guard against an early timer or a transient unsuccessful timer action.
        if (result.session?.status === "IN_PROGRESS" && result.session?.currentPlayerId === session.currentPlayerId &&
            result.session?.version === session.version) throw new Error("Timer not resolved yet");
      } catch {
        if (!closed && generation === expiryGeneration) expiry = setTimeout(resolveExpiry, Math.min(5000, 1000 * 2 ** Math.min(retries++, 3)));
      } finally { clearTimeout(timeout); if (timerRequest === request) timerRequest = undefined; }
    };
    expiry = setTimeout(resolveExpiry, Math.max(100, deadline - Date.now() + 100));
  };
  const refresh = async () => {
    dirty = true;
    if (reading || closed || !controller) return;
    reading = true;
    try {
      while (dirty && !closed) {
        dirty = false;
        const result = await client.query<SnapshotRow>(SNAPSHOT_SQL, [leagueId]);
        if (closed) return;
        if (!result.rows[0]) { cleanup(); return; }
        const snapshot = publicSnapshot(mapSnapshot(result.rows[0]));
        if (snapshot.revision > lastRevision) {
          const initial = lastRevision < 0;
          lastRevision = snapshot.revision;
          send(`id: ${encodeURIComponent(leagueId)}:${snapshot.revision}\ndata: ${JSON.stringify({ ...snapshot, leagueId,
            type: initial ? "INITIAL_SYNC" : "AUCTION_UPDATED", timestamp: new Date().toISOString() })}\n\n`);
          scheduleExpiry(snapshot);
        }
      }
    } catch { cleanup(); }
    finally { reading = false; }
  };
  client.on("notification", message => {
    try { if (JSON.parse(message.payload || "{}").leagueId === leagueId) void refresh(); }
    catch { /* Ignore malformed notifications. */ }
  });
  client.on("error", cleanup);
  req.signal.addEventListener("abort", cleanup, { once: true });
  try {
    await client.connect();
    if (closed || req.signal.aborted) { cleanup(); return new Response(null, { status: 499 }); }
    // LISTEN completes before the first snapshot query: no subscribe/read gap.
    await client.query("LISTEN auction_changes");
    if (closed || req.signal.aborted) { cleanup(); return new Response(null, { status: 499 }); }
  } catch {
    cleanup();
    return Response.json({ error: "Realtime database connection unavailable" }, { status: 503 });
  }
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      if (closed || req.signal.aborted) { cleanup(); try { c.close(); } catch {} return; }
      send(": connected\nretry: 1000\n\n");
      void refresh();
      heartbeat = setInterval(() => send(`event: heartbeat\ndata: ${Date.now()}\n\n`), 10000);
      lifetime = setTimeout(cleanup, 240000);
    },
    cancel: cleanup,
  }, { highWaterMark: 8 });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, no-transform",
    "X-Accel-Buffering": "no",
  } });
}
