import { Client } from "@neondatabase/serverless";
import { SNAPSHOT_SQL, mapSnapshot, publicSnapshot, type SnapshotRow } from "@/lib/realtime/snapshot";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const leagueId = new URL(req.url).searchParams.get("leagueId") || "league-main";
  const connectionString = process.env.DATABASE_DIRECT_URL;
  if (!connectionString || new URL(connectionString).hostname.includes("-pooler")) {
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
    clearTimeout(expiry);
    const session = snapshot.session;
    if (session.status !== "IN_PROGRESS" || !session.currentPlayerId || !session.timerExpiresAt) return;
    const deadline = Date.parse(session.timerExpiresAt);
    if (!Number.isFinite(deadline)) return;
    expiry = setTimeout(async () => {
      if (closed) return;
      // Reuse the Node authoritative timer processor only when a lot expires.
      timerRequest = new AbortController();
      try {
        const url = new URL("/api/auction/state", req.url);
        url.searchParams.set("leagueId", leagueId);
        await fetch(url, { cache: "no-store", signal: timerRequest.signal });
      } catch { /* Recovery read on reconnect or next notification. */ }
      finally { timerRequest = undefined; }
    }, Math.max(100, deadline - Date.now() + 100));
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
          send(`id: ${leagueId}:${snapshot.revision}\ndata: ${JSON.stringify({ ...snapshot, leagueId,
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
  } catch {
    cleanup();
    return Response.json({ error: "Realtime database connection unavailable" }, { status: 503 });
  }
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
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
