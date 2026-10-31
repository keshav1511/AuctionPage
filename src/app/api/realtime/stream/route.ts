import { NextRequest } from "next/server";
import { getAuthoritativeLeagueState, subscribeToAuctionEvents, AuctionRealtimeEvent } from "@/lib/server/auction-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId") || "league-ntl";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial authoritative state sync immediately on connect
      try {
        const state = getAuthoritativeLeagueState(leagueId);
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

      // 2. Subscribe to real-time events for this league
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

      // 4. Handle client disconnection
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
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
