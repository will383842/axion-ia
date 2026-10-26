// Ouverture du questionnaire avant audit (2026-10-27) : la page se signale APRÈS son chargement
// réel (balise `features/questionnaire-preaudit/balise-ouverture.ts`), jamais au rendu serveur.
//
//   · POST `{ m, s, etape, t }` en `text/plain` (requête simple, sans prévol), même jeton HMAC que
//     les réponses (faux → 404 neutre), même CORS `null` ;
//   · rien n'est noté si : l'interrupteur `QUESTIONNAIRE_SUIVI_ENABLED` est éteint,
//     le réel est refusé ou le lien n'accepte plus de réponses, c'est un ESSAI, le navigateur se
//     déclare robot, la page se signale avant 3 s, ou le code du lien est mal formé ;
//   · aucune IP, aucun cookie, aucun navigateur n'est gardé ni journalisé. Le débit est compté
//     PAR LIEN seulement (aucune empreinte d'IP, même passagère).
// Le corps de la réponse ne sert qu'aux tests : la page ne le lit pas.

import { NextResponse } from "next/server";

import { refusReel } from "@/features/questionnaire-preaudit/config";
import { lireCorpsPlafonne } from "@/features/questionnaire-preaudit/corps";
import { ENTETES_CORS_PREAUDIT } from "@/features/questionnaire-preaudit/entetes";
import {
  CORPS_OUVERTURE_MAX_OCTETS,
  estRobot,
  suiviActif,
  validerSignal,
} from "@/features/questionnaire-preaudit/ouvertures";
import { accepteDesReponses, lireParJeton } from "@/features/questionnaire-preaudit/serveur";
import { noterOuverture } from "@/features/questionnaire-preaudit/suivi-ouvertures";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Par lien : 200 ouvertures par heure et par lien suffisent largement à 62 personnes. */
export const LIMITE_OUVERTURES_PAR_LIEN: RateLimitConfig = {
  limit: 200,
  windowSec: 3600,
  surPanne: "refuser",
};

const ENTETES = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  ...ENTETES_CORS_PREAUDIT,
} as const;

type Ctx = { params: Promise<{ id: string; jeton: string }> };

function reponse(status: number, corps: Record<string, unknown>): Response {
  return NextResponse.json(corps, { status, headers: ENTETES });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: ENTETES });
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  if (!suiviActif()) return reponse(404, { ok: false });
  const { id, jeton } = await ctx.params;
  const q = await lireParJeton(id, jeton);
  if (q === null) return reponse(404, { ok: false });
  if (new URL(req.url).searchParams.get("essai") === "1") {
    return reponse(200, { ok: true, note: false, motif: "essai" });
  }
  if (refusReel() !== null || !accepteDesReponses(q)) return reponse(404, { ok: false });
  if (estRobot(req.headers.get("user-agent"))) {
    return reponse(200, { ok: true, note: false, motif: "robot" });
  }
  const parLien = await checkRateLimit(
    `questionnaire-preaudit-ouverture:lien:${q.id}`,
    LIMITE_OUVERTURES_PAR_LIEN,
  );
  if (!parLien.allowed) return reponse(429, { ok: false });
  const corps = await lireCorpsPlafonne(req, CORPS_OUVERTURE_MAX_OCTETS);
  if (corps === null) return reponse(413, { ok: false });
  const v = validerSignal(corps, q.id);
  if (!v.ok) return reponse(200, { ok: true, note: false, motif: v.motif });
  try {
    const r = await noterOuverture(q.id, v.valeur.personne, v.valeur.etape);
    if (r === "plafond") return reponse(200, { ok: true, note: false, motif: "plafond" });
    return reponse(200, { ok: true, note: r !== "conflit", nouvelle: r === "nouvelle" });
  } catch {
    // Table pas encore migrée, questionnaire supprimé entre-temps : la page n'en sait rien.
    return reponse(200, { ok: true, note: false });
  }
}
