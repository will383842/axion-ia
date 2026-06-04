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
import { getDefaultTenant, resolveTenantByKey } from "@/server/chatbot/tenant";
import { handleTurn } from "@/server/chatbot/orchestrator";
import { generateAnswer } from "@/server/chatbot/generation/generate-stream";
import type { SearchSlots } from "@/server/chatbot/catalog/slot-filling";
import type { LinkFlowState } from "@/server/chatbot/catalog/link-flow";

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

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
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
  const { message, tenantKey, pageContext } = parsed.data;

  const tenant = tenantKey ? await resolveTenantByKey(tenantKey) : await getDefaultTenant();
  if (!tenant) return jsonError("tenant_not_found", 404);

  const sessionUuid = parsed.data.sessionUuid ?? randomUUID();
  const ipHash = hashIp(clientIp(req));

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
      } catch (err) {
        console.error("[chatbot:route] erreur:", err);
        send({ type: "error", message: "server_error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
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
