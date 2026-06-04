// POST /api/chatbot/lead — capture de lead structurée (T-17) depuis le widget.
//
// Flux de consentement RGPD-propre (≠ extraction LLM) : le visiteur remplit un
// mini-formulaire (nom, email, besoin, consentement explicite). On résout le
// tenant serveur, on (re)lie la conversation, et on appelle capturerLead
// (idempotent → Submission source=chatbot). Gated CHATBOT_ENABLED. runtime nodejs.

import { randomUUID, createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getDefaultTenant, resolveTenantByKey } from "@/server/chatbot/tenant";
import { capturerLead } from "@/server/chatbot/tools/capturer-lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  nom: z.string().min(1).max(255),
  email: z.string().email(),
  telephone: z.string().max(30).optional(),
  structure: z.string().max(255).optional(),
  besoin: z.string().min(1).max(2000),
  consentement: z.boolean(),
  sessionUuid: z.string().uuid().optional(),
  tenantKey: z.string().min(1).max(120).optional(),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function hashIp(ip: string): string | null {
  const salt = process.env.IP_HASH_SALT;
  if (!salt || ip === "unknown") return null;
  return createHash("sha256").update(`${salt}::${ip}`).digest("hex").slice(0, 64);
}

/** Same-origin uniquement (PII) : une origine étrangère est rejetée. */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // pas de navigateur (server-to-server)
  try {
    return new URL(origin).host.toLowerCase() === (req.headers.get("host") ?? "").toLowerCase();
  } catch {
    return false;
  }
}

function json(obj: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (process.env.CHATBOT_ENABLED !== "true")
    return json({ ok: false, error: "chatbot_disabled" }, 503);
  if (!sameOrigin(req)) return json({ ok: false, error: "origin_not_allowed" }, 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "invalid_body" }, 400);
  const b = parsed.data;
  if (!b.consentement) return json({ ok: false, error: "consent_required" }, 400);

  const tenant = b.tenantKey ? await resolveTenantByKey(b.tenantKey) : await getDefaultTenant();
  if (!tenant) return json({ ok: false, error: "tenant_not_found" }, 404);

  const ip = clientIp(req);
  const ipHash = hashIp(ip);
  const ipKey = ipHash ?? ip;
  if (ipKey !== "unknown") {
    const limited = await checkRateLimit(`chatbot:lead:${ipKey}`, { limit: 5, windowSec: 3600 });
    if (!limited.allowed) return json({ ok: false, error: "rate_limited" }, 429);
  }

  // Lie le lead à la conversation (sessionUuid) ou en crée une.
  const sessionUuid = b.sessionUuid ?? randomUUID();
  const convo = await prisma.chatConversation.upsert({
    where: { sessionUuid },
    update: {},
    create: { tenantId: tenant.id, sessionUuid, ...(ipHash ? { ipHash } : {}) },
    select: { id: true },
  });

  try {
    const result = await capturerLead(
      {
        nom: b.nom,
        email: b.email,
        ...(b.telephone ? { telephone: b.telephone } : {}),
        ...(b.structure ? { structure: b.structure } : {}),
        besoin_resume: b.besoin,
        consentement_rgpd: true,
      },
      { tenantId: tenant.id, conversationId: convo.id, ...(ipHash ? { ipHash } : {}) },
    );
    return json(
      { ok: true, submissionId: result.submissionId, idempotent: result.idempotent },
      200,
    );
  } catch (err) {
    console.error("[chatbot:lead] erreur:", err);
    return json({ ok: false, error: "server_error" }, 500);
  }
}
