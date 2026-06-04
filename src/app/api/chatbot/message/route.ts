// POST /api/chatbot/message (T-07) — flux SSE principal du widget.
//
// runtime nodejs (accès Prisma/Redis + streaming). Résout le tenant serveur,
// charge l'état de conversation (slots/linkState), exécute l'orchestrateur,
// streame la réponse (deltas LLM + cartes + sources + RDV), persiste les messages.
// Gardé par CHATBOT_ENABLED (kill-switch / activation D-PROD).

import { randomUUID, createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getDefaultTenant, resolveTenantByKey } from "@/server/chatbot/tenant";
import { inspectUserMessage } from "@/server/chatbot/security/prompt-guard";
import { handleTurn } from "@/server/chatbot/orchestrator";
import { generateAnswer } from "@/server/chatbot/generation/generate-stream";
import { shouldSummarize, summarizeConversation } from "@/server/chatbot/context/summarize";
import { getActivePromptContent } from "@/server/chatbot/generation/prompt-version";
import type { SearchSlots } from "@/server/chatbot/catalog/slot-filling";
import type { LinkFlowState } from "@/server/chatbot/catalog/link-flow";
import type { TenantSettings } from "@/server/chatbot/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  sessionUuid: z.string().uuid().optional(),
  tenantKey: z.string().min(1).max(120).optional(),
  pageContext: z.string().max(300).optional(),
  /** Token Cloudflare Turnstile (REQ-062) — requis à l'ouverture de session si activé. */
  turnstileToken: z.string().max(2048).optional(),
});

// Anti-abus (REQ-062) : quotas glissants par IP et par session.
const RATE_LIMIT_IP = { limit: 20, windowSec: 60 } as const;
const RATE_LIMIT_SESSION = { limit: 30, windowSec: 60 } as const;

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

/**
 * CORS (REQ-061) : la route n'accepte que les requêtes same-origin OU provenant
 * du domaine déclaré du tenant. `Origin` absent (navigation server-to-server) =
 * autorisé. Cross-origin inconnu = rejeté.
 */
function checkOrigin(
  req: NextRequest,
  tenant: { domaine: string | null },
): { allowed: boolean; origin: string | null } {
  const origin = req.headers.get("origin");
  if (!origin) return { allowed: true, origin: null };
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return { allowed: false, origin };
  }
  const hostHeader = (req.headers.get("host") ?? "").toLowerCase();
  if (originHost === hostHeader) return { allowed: true, origin }; // same-origin
  const allow = new Set<string>();
  const d = tenant.domaine
    ?.replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (d) {
    allow.add(d);
    allow.add(`www.${d}`);
  }
  return { allowed: allow.has(originHost), origin };
}

/** En-têtes CORS à refléter quand l'origine est autorisée. */
function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonError(error: string, status: number, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

/** Petit flux SSE de déflexion (prompt-guard) — réponse polie, sans appel LLM. */
function deflectionResponse(
  sessionUuid: string,
  text: string,
  cors: Record<string, string>,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const send = (d: Record<string, unknown>) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(d)}\n\n`));
      send({ type: "session", sessionUuid });
      send({ type: "message", text });
      send({ type: "done" });
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...SSE_HEADERS, ...cors } });
}

/**
 * Préflight CORS. Ne reflète les en-têtes CORS que pour le same-origin (le seul
 * cas légitime au MVP single-tenant) ; une origine étrangère reçoit 204 SANS
 * `Access-Control-Allow-Origin` → le navigateur bloque la requête. Le POST refait
 * de toute façon la validation complète (same-origin + domaine tenant).
 */
export function OPTIONS(req: NextRequest): Response {
  const origin = req.headers.get("origin");
  let sameOrigin = false;
  if (origin) {
    try {
      sameOrigin =
        new URL(origin).host.toLowerCase() === (req.headers.get("host") ?? "").toLowerCase();
    } catch {
      sameOrigin = false;
    }
  }
  return new Response(null, { status: 204, headers: sameOrigin ? corsHeaders(origin) : {} });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (process.env.CHATBOT_ENABLED !== "true") {
    return jsonError("chatbot_disabled", 503);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError("invalid_body", 400);
  const { message, tenantKey, pageContext, turnstileToken } = parsed.data;

  const tenant = tenantKey ? await resolveTenantByKey(tenantKey) : await getDefaultTenant();
  if (!tenant) return jsonError("tenant_not_found", 404);

  // CORS (REQ-061) — refuse les origines étrangères au tenant.
  const cors = checkOrigin(req, tenant);
  if (!cors.allowed) return jsonError("origin_not_allowed", 403);
  const corsOut = corsHeaders(cors.origin);

  const ip = clientIp(req);
  const ipHash = hashIp(ip);
  const sessionUuid = parsed.data.sessionUuid ?? randomUUID();
  // `isNewSession` déterminé CÔTÉ SERVEUR : une session "continue" doit
  // correspondre à une conversation réellement persistée. Sinon un client
  // pourrait forger un sessionUuid pour contourner Turnstile (REQ-062).
  const existingConvo = parsed.data.sessionUuid
    ? await prisma.chatConversation.findUnique({
        where: { sessionUuid: parsed.data.sessionUuid },
        select: { id: true },
      })
    : null;
  const isNewSession = !existingConvo;

  // Anti-abus (REQ-062) — quotas glissants par IP puis par session (fail-open si
  // Redis indisponible, cf. checkRateLimit). 429 propre → le widget affiche un
  // message d'attente, jamais d'erreur brute.
  const ipKey = ipHash ?? ip;
  if (ipKey !== "unknown") {
    const ipLimited = await checkRateLimit(`chatbot:ip:${ipKey}`, RATE_LIMIT_IP);
    if (!ipLimited.allowed) return jsonError("rate_limited", 429, corsOut);
  }
  const sessLimited = await checkRateLimit(`chatbot:sess:${sessionUuid}`, RATE_LIMIT_SESSION);
  if (!sessLimited.allowed) return jsonError("rate_limited", 429, corsOut);

  // Turnstile (REQ-062) — vérifié à l'OUVERTURE de session (1er message) quand
  // activé. Gated par CHATBOT_TURNSTILE_ENABLED pour activation conjointe avec
  // l'émission du token côté widget (sinon no-op). verifyTurnstile fail-soft en dev.
  if (process.env.CHATBOT_TURNSTILE_ENABLED === "true" && isNewSession) {
    const ok = await verifyTurnstile(turnstileToken, ip === "unknown" ? undefined : ip);
    if (!ok) return jsonError("turnstile_failed", 403, corsOut);
  }

  // Anti-injection / exfiltration / jailbreak (REQ-063) — AVANT tout appel LLM.
  // Tentative détectée → déflexion polie, aucune génération, aucune fuite.
  const guard = inspectUserMessage(message);
  if (!guard.ok) {
    console.warn(`[chatbot:guard] message dévié (${guard.reason}) session=${sessionUuid}`);
    return deflectionResponse(
      sessionUuid,
      "Je suis l'assistant d'Axion-IA et je réponds uniquement aux questions sur nos services (audit, formation, implémentation IA, sites web). Comment puis-je vous aider sur ces sujets ?",
      corsOut,
    );
  }

  // Charge / crée la conversation (état multi-tours).
  const convo = await prisma.chatConversation.upsert({
    where: { sessionUuid },
    update: {},
    create: {
      tenantId: tenant.id,
      sessionUuid,
      ...(pageContext ? { pageContext } : {}),
      ...(ipHash ? { ipHash } : {}),
    },
  });
  const previousSlots = (convo.searchSlots as SearchSlots | null) ?? undefined;
  const linkFlow: LinkFlowState = {
    linkState: (convo.linkState as LinkFlowState["linkState"]) ?? "idle",
    proposedOfferIds: Array.isArray(convo.proposedOffers) ? (convo.proposedOffers as string[]) : [],
  };
  // T-20 : prompt système versionné actif du tenant (null → fallback codé).
  const promptOverride = await getActivePromptContent(tenant.id);

  const startedAt = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: "session", sessionUuid });

        const result = await handleTurn(
          message,
          {
            tenant,
            conversationId: convo.id,
            linkFlow,
            ...(previousSlots ? { previousSlots } : {}),
            ...(convo.resume ? { resume: convo.resume } : {}),
            ...(promptOverride ? { promptOverride } : {}),
          },
          {
            // streaming token-par-token vers le widget (typing).
            generateAnswer: (opts) =>
              generateAnswer({ ...opts, onChunk: (c) => send({ type: "delta", text: c }) }),
          },
        );

        if (result.text) send({ type: "message", text: result.text });
        if (result.cards.length > 0)
          send({ type: "cards", cards: result.cards, sendLinks: result.sendLinks });
        if (result.sources.length > 0) send({ type: "sources", sources: result.sources });
        if (result.rdvUrl) send({ type: "rdv", url: result.rdvUrl });
        if (result.escalate) send({ type: "escalate" });

        // Persistance (après streaming pour ne pas bloquer la latence perçue).
        const latenceMs = Date.now() - startedAt;
        await persistTurn({
          conversationId: convo.id,
          userMessage: message,
          result,
          latenceMs,
        });

        send({ type: "done" });

        // T-31 — résumé de contexte long APRÈS "done" : le client a déjà tout
        // reçu, donc ça n'allonge pas la latence perçue. Best-effort (jamais
        // d'erreur émise au client).
        try {
          await maybeSummarizeConversation(convo.id, tenant.settings);
        } catch (e) {
          console.warn("[chatbot:route] résumé contexte échoué:", e);
        }
      } catch (err) {
        console.error("[chatbot:route] erreur:", err);
        send({ type: "error", message: "server_error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { ...SSE_HEADERS, ...corsOut } });
}

/**
 * T-31 — recalcule le résumé de contexte au-delà d'un palier de messages, et le
 * persiste sur la conversation (réinjecté au system-prompt au tour suivant).
 * Best-effort : summarizeConversation renvoie null sur panne LLM.
 */
async function maybeSummarizeConversation(
  conversationId: string,
  settings: TenantSettings,
): Promise<void> {
  const count = await prisma.chatMessage.count({ where: { conversationId } });
  if (!shouldSummarize(count)) return;
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, contenu: true },
  });
  const resume = await summarizeConversation(
    messages,
    generateAnswer,
    settings.llmTier.reformulation,
  );
  if (resume) {
    await prisma.chatConversation.update({ where: { id: conversationId }, data: { resume } });
  }
}

async function persistTurn(args: {
  conversationId: string;
  userMessage: string;
  result: Awaited<ReturnType<typeof handleTurn>>;
  latenceMs: number;
}): Promise<void> {
  const { conversationId, userMessage, result, latenceMs } = args;
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { conversationId, role: "user", contenu: userMessage },
    }),
    prisma.chatMessage.create({
      data: {
        conversationId,
        role: "assistant",
        contenu: result.text,
        sources: result.sources as unknown as object,
        latenceMs,
        servedFromCache: result.servedFromCache ?? false,
        ...(result.model ? { modele: result.model } : {}),
        ...(result.costUsd !== undefined ? { coutEstime: result.costUsd } : {}),
      },
    }),
    prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        searchSlots: result.slots as unknown as object,
        proposedOffers: result.cards.map((c) => c.id) as unknown as object,
        linkState: result.linkFlow.linkState,
      },
    }),
  ]);
}
