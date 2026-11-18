/**
 * Webhook ENTRANT du CRM — retour du dossier client (CRM → console), 25/10/2026.
 *
 * POST /api/internal/crm-dossier-webhook
 *
 * Même authentification que `crm-webhook` : `X-Crm-Timestamp` + `X-Crm-Signature`
 * (HMAC-SHA256 de `<horodatage>.<corps brut>`, `SITE_SYNC_HMAC_SECRET`).
 * Contrat et règles : `@/server/crm-sync/retour-dossier`.
 *
 * Réponses : 200 `{ ok, outcome }` (appliqué, inchangé ou ignoré — un rejeu
 * est un succès) · 401 signature · 422 contrat · 503 drapeau fermé (le CRM
 * réessaie sans consommer d'essai) · 500 secret absent ou panne.
 *
 * 🔴 ANTI-BOUCLE : aucune fonction `sync*ToCrm` n'est appelée ici.
 */

import { NextResponse } from "next/server";

import { isCrmInboundDossierEnabled } from "@/server/crm-sync/config";
import { verifyInboundRequest } from "@/server/crm-sync/inbound";
import { appliquerRetourDossier, parseRetourDossier } from "@/server/crm-sync/retour-dossier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();

  const failure = verifyInboundRequest({
    rawBody,
    timestamp: req.headers.get("x-crm-timestamp"),
    signature: req.headers.get("x-crm-signature"),
  });
  if (failure === "missing_secret") {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (failure !== null) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isCrmInboundDossierEnabled()) {
    return NextResponse.json({ error: "closed" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 422 });
  }
  const msg = parseRetourDossier(json);
  if (msg === null) return NextResponse.json({ error: "contract_violation" }, { status: 422 });

  try {
    const outcome = await appliquerRetourDossier(msg);
    return NextResponse.json({ ok: true, outcome }, { status: 200 });
  } catch (error) {
    console.error("[crm-sync][retour-dossier] traitement échoué :", (error as Error).name);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
