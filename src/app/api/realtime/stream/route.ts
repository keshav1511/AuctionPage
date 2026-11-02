import { NextRequest } from "next/server";
import { getAuthoritativeLeagueState, subscribeToAuctionEvents, AuctionRealtimeEvent } from "@/lib/server/auction-store";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId") || "league-main";

  const state = await getAuthoritativeLeagueState(leagueId);
  if (!state) {
    return new Response(JSON.stringify({ error: `League with ID "${leagueId}" not found` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial authoritative state sync immediately on connect
      try {
        const initialRev = state.session.revision || state.session.version || 1;
        const initialEvent: AuctionRealtimeEvent = {
          type: "INITIAL_SYNC",
          leagueId,
          timestamp: new Date().toISOString(),
          revision: initialRev,
          session: state.session,
          teams: state.teams,
          players: state.players,
          rules: state.rules,
          league: state.league,
          lastAction: {
            type: "UPDATE_LEAGUE",
            message: "Connected to live auction stream",
          },
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`));
      } catch (err) {
        console.error("Error sending initial sync event:", err);
      }

      // 2. Subscribe to real-time in-process events for this league
      const unsubscribe = subscribeToAuctionEvents(leagueId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream might be closed
        }
      });

      // 3. Keep-alive heartbeat every 10s to prevent proxy timeouts
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 10000);

      // 4. Serverless cross-instance sync check every 2.0s
      let lastKnownRevision = state.session.revision || state.session.version || 1;
      let lastKnownStateSummary = `${state.session.status}-${state.session.currentPlayerId}-${state.session.currentHighestBid}-${state.session.bidCount}`;
      const crossInstanceSync = setInterval(async () => {
        try {
          const fresh = await getAuthoritativeLeagueState(leagueId);
          if (fresh) {
            const freshRev = fresh.session.revision || fresh.session.version || 1;
            const summary = `${fresh.session.status}-${fresh.session.currentPlayerId}-${fresh.session.currentHighestBid}-${fresh.session.bidCount}`;
            if (freshRev > lastKnownRevision || summary !== lastKnownStateSummary) {
              lastKnownRevision = Math.max(lastKnownRevision, freshRev);
              lastKnownStateSummary = summary;
              const syncEvent: AuctionRealtimeEvent = {
                type: "AUCTION_UPDATED",
                leagueId,
                timestamp: new Date().toISOString(),
                revision: freshRev,
                session: fresh.session,
                teams: fresh.teams,
                players: fresh.players,
                rules: fresh.rules,
                league: fresh.league,
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(syncEvent)}\n\n`));
            }
          }
        } catch {}
      }, 2000);

      const cleanup = () => {
        clearInterval(heartbeat);
        clearInterval(crossInstanceSync);
        unsubscribe();
      };

      // 5. Graceful close before Vercel serverless function execution limit
      const lifetimeTimeout = setTimeout(() => {
        cleanup();
        try {
          controller.close();
        } catch {}
      }, 20000);

      // 6. Handle client disconnection
      req.signal.addEventListener("abort", () => {
        clearTimeout(lifetimeTimeout);
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
