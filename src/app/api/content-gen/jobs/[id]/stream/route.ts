/**
 * Content Generator — SSE temps réel logs job (Fix P1-15 audit opérationnel
 * 2026-05-14).
 *
 * § 12.4 master prompt — route `/api/content-gen/jobs/[id]/stream` Edge-no,
 * runtime Node (accès Prisma + Redis pub/sub futur). V1 polling DB
 * `GenerationLog` toutes les 3s + emit nouveaux logs comme SSE events.
 * V2 = Redis pub/sub (worker publish via redisPublisher).
 *
 * Auth admin requise (RBAC via session). 5 minutes max par stream (auto-close)
 * pour éviter connexions zombies.
 */

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/actions/content-gen/_auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 3000;
const MAX_DURATION_MS = 5 * 60 * 1000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return new Response("unauthorized", { status: 401 });
  }
  const { id } = await params;

  const job = await prisma.contentGenJob.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!job) return new Response("job_not_found", { status: 404 });

  const startedAt = Date.now();
  let lastSeenId: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 1. Initial snapshot : derniers 50 logs + status job actuel
      const initial = await prisma.generationLog.findMany({
        where: { jobId: id },
        orderBy: { timestamp: "desc" },
        take: 50,
      });
      const initialOrdered = initial.reverse();
      for (const log of initialOrdered) {
        sendEvent({
          type: "log",
          id: log.id,
          level: log.level,
          step: log.step,
          message: log.message,
          metadata: log.metadata,
          timestamp: log.timestamp.toISOString(),
        });
        lastSeenId = log.id;
      }
      sendEvent({ type: "ready", initialCount: initialOrdered.length });

      // 2. Polling toutes les 3s, emit nouveaux logs + status change
      const interval = setInterval(async () => {
        if (Date.now() - startedAt > MAX_DURATION_MS) {
          sendEvent({ type: "timeout", reason: "max_duration_5min" });
          clearInterval(interval);
          controller.close();
          return;
        }
        try {
          const newer = await prisma.generationLog.findMany({
            where: {
              jobId: id,
              ...(lastSeenId ? { id: { gt: lastSeenId } } : {}),
            },
            orderBy: { timestamp: "asc" },
            take: 100,
          });
          for (const log of newer) {
            sendEvent({
              type: "log",
              id: log.id,
              level: log.level,
              step: log.step,
              message: log.message,
              metadata: log.metadata,
              timestamp: log.timestamp.toISOString(),
            });
            lastSeenId = log.id;
          }
          // Status update
          const cur = await prisma.contentGenJob.findUnique({
            where: { id },
            select: { status: true, qualityScore: true, durationMs: true },
          });
          if (cur) {
            sendEvent({
              type: "status",
              status: cur.status,
              qualityScore: cur.qualityScore,
              durationMs: cur.durationMs,
            });
            if (
              cur.status === "published" ||
              cur.status === "failed" ||
              cur.status === "cancelled"
            ) {
              sendEvent({ type: "done", status: cur.status });
              clearInterval(interval);
              controller.close();
            }
          }
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
