// Réception des réponses du questionnaire de pré-audit (2026-10-24).
//
// POST JSON « schéma 3 » ou « 4 », une personne à la fois, gardé tel quel. Jeton faux → 404 neutre.
//   · débit limité par IP ET par jeton (`checkRateLimit`) ; corps lu avec un plafond ;
//   · `?essai=1` : on valide la forme et on répond 200 SANS RIEN ÉCRIRE ni notifier ;
//   · réel : interrupteur + notice RGPD + purge, lien envoyé, ni clos ni expiré ; réponse chiffrée ;
//   · 413 `charge_trop_grosse` (taille, plafond, message), 422 `trop_de_reponses`, 409 `deja_recu`
//     pour un renvoi identique (idempotence, aucune seconde ligne).
// Appelée depuis un document en bac à sable (origine opaque) : CORS limité à `null` et au POST.
// Aucune notification par e-mail : la console affiche « à traiter » (`lu_le` vide).

import { NextResponse } from "next/server";

import { refusReel } from "@/features/questionnaire-preaudit/config";
import { lireCorpsPlafonne, refusTropGros } from "@/features/questionnaire-preaudit/corps";
import {
  CHARGE_MAX_OCTETS,
  ENVOIS_MAX_PAR_QUESTIONNAIRE,
  validerCharge,
} from "@/features/questionnaire-preaudit/donnees";
import { ENTETES_CORS_PREAUDIT } from "@/features/questionnaire-preaudit/entetes";
import { enregistrerReponse, lireParJeton } from "@/features/questionnaire-preaudit/serveur";
import { ipVisiteurOuNull } from "@/lib/client-ip-core";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";

export const dynamic = "force-dynamic";

const ENTETES = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  ...ENTETES_CORS_PREAUDIT,
} as const;

/** Par IP : un bureau entier peut répondre derrière la même adresse. */
export const LIMITE_PAR_IP: RateLimitConfig = {
  limit: 60,
  windowSec: 900,
  surPanne: "laisser-passer",
};
/** Par lien : au plus ~3 réponses par minute en moyenne, tous appareils confondus. */
export const LIMITE_PAR_JETON: RateLimitConfig = {
  limit: 120,
  windowSec: 3600,
  surPanne: "laisser-passer",
};

function reponse(status: number, corps: Record<string, unknown>): Response {
  return NextResponse.json(corps, { status, headers: ENTETES });
}

function empreinteIp(req: Request): string {
  try {
    return hashIp(ipVisiteurOuNull(req.headers)) ?? "sans-ip";
  } catch {
    return "sans-sel";
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: ENTETES });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; jeton: string }> },
): Promise<Response> {
  const { id, jeton } = await ctx.params;

  // Débit AVANT toute lecture de base : un jeton inventé coûte aussi.
  const parIp = await checkRateLimit(
    `questionnaire-preaudit:ip:${empreinteIp(req)}`,
    LIMITE_PAR_IP,
  );
  if (!parIp.allowed) return reponse(429, { ok: false });

  const q = await lireParJeton(id, jeton);
  if (q === null) return reponse(404, { ok: false });
  const parJeton = await checkRateLimit(`questionnaire-preaudit:lien:${q.id}`, LIMITE_PAR_JETON);
  if (!parJeton.allowed) return reponse(429, { ok: false });

  const essai = new URL(req.url).searchParams.get("essai") === "1";
  const corps = await lireCorpsPlafonne(req, CHARGE_MAX_OCTETS);
  if (corps === null) return reponse(413, refusTropGros(req, CHARGE_MAX_OCTETS));
  const v = validerCharge(corps);
  if (!v.ok) return reponse(400, { ok: false, motif: v.motif });

  if (essai) return reponse(200, { ok: true, essai: true });

  if (refusReel() !== null) return reponse(404, { ok: false });
  const r = await enregistrerReponse(q, v.charge);
  if (r === "ferme") return reponse(404, { ok: false });
  // 4xx dédié, jamais 429 : la page ne relance pas et ne parle pas de « connexion coupée ».
  if (r === "trop") {
    return reponse(422, {
      ok: false,
      motif: "trop_de_reponses",
      plafond: ENVOIS_MAX_PAR_QUESTIONNAIRE,
      message:
        "Ce questionnaire a atteint le nombre maximal de réponses. Gardez cette page ouverte, " +
        "téléchargez le PDF de vos réponses et transmettez-le à votre interlocuteur Axion IA.",
    });
  }
  // Renvoi identique d'une réponse déjà reçue : succès pour la page (409 « déjà reçu »).
  if (r === "doublon") return reponse(409, { ok: true, motif: "deja_recu" });
  return reponse(200, { ok: true });
}
