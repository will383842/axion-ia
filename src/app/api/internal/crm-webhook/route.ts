/**
 * Webhook ENTRANT du CRM (lot L5) — consentements CRM → site.
 *
 * POST /api/internal/crm-webhook
 *
 * Auth : `X-Crm-Timestamp` + `X-Crm-Signature` = HMAC-SHA256 de
 * `<horodatage>.<corps brut>` avec `SITE_SYNC_HMAC_SECRET` — le MÊME secret
 * partagé que la synchro sortante, en miroir exact de `crm-sync/emit.ts`.
 * Fenêtre anti-rejeu 300 s, comparaison à temps constant.
 *
 * Réponses :
 * - 200 `{ ok: true, outcome }` : traité — Y COMPRIS pour un `event_id` déjà vu
 *   (`outcome: "duplicate"`). Un émetteur qui retente après un timeout doit
 *   obtenir un succès, sinon il retentera indéfiniment ce qui est déjà fait.
 * - 401 : signature absente, hors fenêtre, ou invalide.
 * - 422 : corps qui ne respecte pas le contrat.
 * - 500 : secret serveur absent (défaut de configuration, pas d'appelant).
 *
 * 🔴 ANTI-BOUCLE : ce handler n'appelle AUCUNE fonction `sync*ToCrm`. Un
 * événement d'origine `crm` appliqué ici ne repart jamais vers le CRM.
 *
 * INERTIE : sans `SITE_SYNC_HMAC_SECRET`, toute requête est refusée en 500 et
 * rien n'est écrit. La route existe donc sans rien activer.
 */

import { NextResponse } from "next/server";

// Import DIRECT du sous-module, et non du baril `@/server/crm-sync` : le baril
// tire `enqueue.ts`, donc les files BullMQ, dans le bundle d'une route dont
// c'est exactement le contraire du rôle. L'anti-boucle est d'abord une question
// de dépendances — ce qui n'est pas importé ne peut pas être appelé par mégarde.
import {
  parseInboundPayload,
  processInboundEvent,
  verifyInboundRequest,
} from "@/server/crm-sync/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  // Le corps est lu en TEXTE, une seule fois : c'est cette chaîne exacte qui
  // est signée. Re-sérialiser l'objet parsé changerait l'ordre des clés et
  // invaliderait toute signature légitime.
  const rawBody = await req.text();

  const failure = verifyInboundRequest({
    rawBody,
    timestamp: req.headers.get("x-crm-timestamp"),
    signature: req.headers.get("x-crm-signature"),
  });

  if (failure === "missing_secret") {
    return NextResponse.json(
      { error: "server_misconfigured", detail: "SITE_SYNC_HMAC_SECRET absent" },
      { status: 500 },
    );
  }
  if (failure !== null) {
    // Un seul code pour les trois causes restantes : distinguer « signature
    // fausse » de « horodatage périmé » renseignerait un attaquant sur l'état
    // de sa tentative.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 422 });
  }

  const payload = parseInboundPayload(json);
  if (!payload) {
    return NextResponse.json({ error: "contract_violation" }, { status: 422 });
  }

  try {
    const result = await processInboundEvent(payload);
    return NextResponse.json({ ok: true, outcome: result.outcome }, { status: 200 });
  } catch (error) {
    console.error("[crm-sync][entrant] traitement échoué:", error);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
