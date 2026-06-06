/**
 * Qualiopi — Route Handler SSE alertes système (T15 AGENT C).
 *
 * GET /api/qualiopi/alertes/stream
 *
 * Auth admin requise (auth() NextAuth v5). 401 si session absente ou rôle
 * insuffisant. Pousse toutes les N secondes :
 *   - event "count"  : { nonLues: number }
 *   - event "alertes": { items: AlerteSysteme[] }
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", émet un seul event
 * "count" { nonLues: 0 } puis ferme le stream immédiatement.
 *
 * Fermeture propre :
 *   - req.signal "abort" (client déconnecté) → clearInterval + controller.close()
 *   - MAX_DURATION_MS (10 min) → event "timeout" + close
 *
 * Pas de lib SSE tierce — ReadableStream natif.
 */

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { countNonLues, listAlertes } from "@/server/qualiopi/alertes/alertes-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 10_000; // 10 secondes
const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("unauthorized", { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "reader";
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    return new Response("forbidden", { status: 401 });
  }

  // ── Stub-aware : close immédiat ────────────────────────────────────────────
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    const encoder = new TextEncoder();
    const body = encoder.encode('event: count\ndata: {"nonLues":0}\n\n');
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // ── Stream SSE ─────────────────────────────────────────────────────────────
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (eventName: string, data: unknown): void => {
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      const pushSnapshot = async (): Promise<void> => {
        try {
          const [nonLues, items] = await Promise.all([
            countNonLues(),
            listAlertes({ resolue: false, limit: 50 }),
          ]);
          sendEvent("count", { nonLues });
          sendEvent("alertes", { items });
        } catch (err) {
          sendEvent("error", {
            message: err instanceof Error ? err.message : "stream_error",
          });
        }
      };

      // Snapshot initial immédiat
      await pushSnapshot();

      const interval = setInterval(async () => {
        if (req.signal.aborted) {
          clearInterval(interval);
          try {
            controller.close();
          } catch {
            // already closed
          }
          return;
        }

        if (Date.now() - startedAt > MAX_DURATION_MS) {
          sendEvent("timeout", { reason: "max_duration_10min" });
          clearInterval(interval);
          try {
            controller.close();
          } catch {
            // already closed
          }
          return;
        }

        await pushSnapshot();
      }, POLL_INTERVAL_MS);

      // Fermeture propre sur déconnexion client
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
