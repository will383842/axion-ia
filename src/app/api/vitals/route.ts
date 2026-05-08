// use-client: not needed — this is a Route Handler, not a React Component.
//
// P-303 — Runtime Node.js (default Next 16) au lieu de `runtime = "edge"`.
// Raison : Hetzner CX32 self-hosted (ADR 0009) ne supporte pas Edge Runtime.
// L'annotation `edge` était trompeuse : `next start` exécutait quand même
// cette route en Node, mais avec contraintes Edge subset (pas d'`fs`).
// Désormais on assume Node.js, on valide Zod + on persiste en ndjson rotatif
// (fire-and-forget — la réponse 204 part avant l'écriture disque).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { appendVitalsRecord } from "@/lib/observability/vitals-store";

const VitalsSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.enum(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]),
  value: z.number().finite(),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
  delta: z.number().finite().optional(),
  navigationType: z.string().max(40).optional(),
  href: z.string().url().max(2048).optional(),
  route: z.string().max(512).optional(),
  locale: z.string().max(10).optional(),
  effectiveType: z.string().max(10).nullable().optional(),
  deviceMemory: z.number().finite().nullable().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    // Bad JSON — no logging in prod, swallow silently to avoid log spam from
    // bots and broken clients. 204 keeps Cloudflare/Caddy happy.
    return new Response(null, { status: 204 });
  }

  const parsed = VitalsSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(null, { status: 204 });
  }

  // Fire-and-forget : on n'attend pas la persistance pour répondre. La cible
  // de critère 1.3 / 5.2 du prompt est < 50 ms — l'I/O ndjson est queued.
  void appendVitalsRecord(parsed.data);

  return new Response(null, { status: 204 });
}
