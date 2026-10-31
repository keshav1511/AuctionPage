import { NextRequest } from "next/server";
import { getAuthoritativeLeagueState, subscribeToAuctionEvents, AuctionRealtimeEvent } from "@/lib/server/auction-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId") || "league-ntl";

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
        const initialEvent: AuctionRealtimeEvent = {
          type: "INITIAL_SYNC",
          leagueId,
          timestamp: new Date().toISOString(),
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

      // 3. Keep-alive heartbeat every 15s to prevent proxy timeouts
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // 4. Serverless cross-instance sync check every 2.5s
      let lastKnownStateSummary = `${state.session.status}-${state.session.currentPlayerId}-${state.session.currentHighestBid}-${state.session.bidCount}`;
      const crossInstanceSync = setInterval(async () => {
        try {
          const fresh = await getAuthoritativeLeagueState(leagueId);
          if (fresh) {
            const summary = `${fresh.session.status}-${fresh.session.currentPlayerId}-${fresh.session.currentHighestBid}-${fresh.session.bidCount}`;
            if (summary !== lastKnownStateSummary) {
              lastKnownStateSummary = summary;
              const syncEvent: AuctionRealtimeEvent = {
                type: "AUCTION_UPDATED",
                leagueId,
                timestamp: new Date().toISOString(),
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
      }, 2500);

      // 5. Handle client disconnection
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clearInterval(crossInstanceSync);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
