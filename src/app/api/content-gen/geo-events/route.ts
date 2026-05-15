/**
 * Content Generator — SSE geo events (Fix P1-15bis audit opérationnel
 * 2026-05-14).
 *
 * § 12.4 master prompt — push `{ villeSlug, status, score }` à chaque
 * changement de jobs content-gen. Le cockpit géographique consomme ce
 * stream pour re-colorier la carte ≤ 2s post-event.
 *
 * V1 : polling DB toutes les 5s sur ContentGenJob `updatedAt > lastPoll`.
 * V2 : Redis pub/sub (worker publish via redisPublisher.publish).
 *
 * Auth admin RBAC. Auto-close après 10min (anti-zombie).
 */

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/actions/content-gen/_auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 5000;
const MAX_DURATION_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }

  const startedAt = Date.now();
  let lastPolledAt = new Date();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      sendEvent({ type: "ready", since: lastPolledAt.toISOString() });

      const interval = setInterval(async () => {
        if (Date.now() - startedAt > MAX_DURATION_MS) {
          sendEvent({ type: "timeout", reason: "max_duration_10min" });
          clearInterval(interval);
          controller.close();
          return;
        }
        try {
          const now = new Date();
          const recent = await prisma.contentGenJob.findMany({
            where: {
              updatedAt: { gt: lastPolledAt },
              OR: [{ anchorVilleSlug: { not: null } }, { anchorRegionSlug: { not: null } }],
            },
            select: {
              id: true,
              status: true,
              contentType: true,
              anchorVilleSlug: true,
              anchorRegionSlug: true,
              qualityScore: true,
              updatedAt: true,
            },
            take: 200,
            orderBy: { updatedAt: "asc" },
          });
          for (const j of recent) {
            sendEvent({
              type: "geo-event",
              jobId: j.id,
              villeSlug: j.anchorVilleSlug,
              regionSlug: j.anchorRegionSlug,
              status: j.status,
              contentType: j.contentType,
              score: j.qualityScore,
              at: j.updatedAt.toISOString(),
            });
          }
          lastPolledAt = now;
          sendEvent({ type: "tick", count: recent.length });
        } catch (err) {
          sendEvent({
            type: "error",
            message: err instanceof Error ? err.message : "stream_error",
          });
        }
      }, POLL_INTERVAL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
