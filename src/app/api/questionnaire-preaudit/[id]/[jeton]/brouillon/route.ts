// Brouillon du questionnaire de pré-audit (2026-10-24) : reprendre après une fermeture d'onglet.
//
// Contrat complet : `_PLAN-QUESTIONNAIRE-PREAUDIT-2026-10-24/CONTRAT-BROUILLON.md`.
//   · POST   : enregistre `{ consent: true, horodatage, mode, membre, brouillon }` (chiffré) ;
//   · GET    : `?mode=main|emp|it&m=<code>` rend le brouillon de cette personne ;
//   · DELETE : mêmes paramètres, supprime le brouillon (retrait de l'accord).
// Même jeton HMAC que la route des réponses (faux → 404 neutre), même plafond de 400 000 octets,
// même CORS `null`. Débit : compteurs PROPRES au brouillon (un enregistrement automatique ne
// consomme jamais le quota de l'envoi final) — 120/h par personne, plafonds plus larges par lien
// et par IP pour qu'un bureau entier qui remplit en même temps ne soit jamais bloqué.
// ⛔ Aucune purge ici : un brouillon inactif depuis 30 jours n'est plus rendu ; sa suppression
// définitive attend la purge planifiée (`purgerBrouillonsInactifs`, non branchée).
// Rien n'est journalisé ici : ni corps, ni brouillon.

import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  enregistrerBrouillon,
  lireBrouillon,
  personneDe,
  supprimerBrouillon,
  validerBrouillon,
  type Personne,
} from "@/features/questionnaire-preaudit/brouillon";
import { refusReel } from "@/features/questionnaire-preaudit/config";
import { lireCorpsPlafonne } from "@/features/questionnaire-preaudit/corps";
import { CHARGE_MAX_OCTETS } from "@/features/questionnaire-preaudit/donnees";
import { ENTETES_CORS_BROUILLON } from "@/features/questionnaire-preaudit/entetes";
import { accepteDesReponses, lireParJeton } from "@/features/questionnaire-preaudit/serveur";
import { ipVisiteurOuNull } from "@/lib/client-ip-core";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";

export const dynamic = "force-dynamic";

/** Par personne (lien, parcours, code) : un enregistrement toutes les 30 s en moyenne. */
export const LIMITE_BROUILLON_PAR_PERSONNE: RateLimitConfig = {
  limit: 120,
  windowSec: 3600,
  surPanne: "laisser-passer",
};
/** Par lien : 30 personnes (le plafond de brouillons) au rythme maximal. */
export const LIMITE_BROUILLON_PAR_LIEN: RateLimitConfig = {
  limit: 3600,
  windowSec: 3600,
  surPanne: "laisser-passer",
};
/** Par IP : un bureau entier derrière la même adresse. */
export const LIMITE_BROUILLON_PAR_IP: RateLimitConfig = {
  limit: 900,
  windowSec: 900,
  surPanne: "laisser-passer",
};

const ENTETES = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  ...ENTETES_CORS_BROUILLON,
} as const;

type Ctx = { params: Promise<{ id: string; jeton: string }> };
type Questionnaire = NonNullable<Awaited<ReturnType<typeof lireParJeton>>>;

function reponse(status: number, corps: Record<string, unknown>): Response {
  return NextResponse.json(corps, { status, headers: ENTETES });
}

const LIMITE_ATTEINTE = () => reponse(429, { ok: false });

function empreinteIp(req: Request): string {
  try {
    return hashIp(ipVisiteurOuNull(req.headers)) ?? "sans-ip";
  } catch {
    return "sans-sel";
  }
}

/** Débit (IP, puis lien), puis jeton : le questionnaire, ou le refus (429 / 404 neutre). */
async function ouvrir(req: Request, ctx: Ctx): Promise<Questionnaire | Response> {
  const { id, jeton } = await ctx.params;
  const parIp = await checkRateLimit(
    `questionnaire-preaudit-brouillon:ip:${empreinteIp(req)}`,
    LIMITE_BROUILLON_PAR_IP,
  );
  if (!parIp.allowed) return LIMITE_ATTEINTE();
  const q = await lireParJeton(id, jeton);
  if (q === null) return reponse(404, { ok: false });
  const parLien = await checkRateLimit(
    `questionnaire-preaudit-brouillon:lien:${q.id}`,
    LIMITE_BROUILLON_PAR_LIEN,
  );
  if (!parLien.allowed) return LIMITE_ATTEINTE();
  return q;
}

/** Jamais un code de lien en clair dans une clé Redis : son empreinte. */
function empreinteMembre(membre: string): string {
  return createHash("sha256").update(`brouillon-membre|${membre}`).digest("hex").slice(0, 16);
}

async function debitPersonneOk(q: Questionnaire, p: Personne): Promise<boolean> {
  const r = await checkRateLimit(
    `questionnaire-preaudit-brouillon:personne:${q.id}:${p.mode}:${empreinteMembre(p.membre)}`,
    LIMITE_BROUILLON_PAR_PERSONNE,
  );
  return r.allowed;
}

/** Le réel est permis et le lien reçoit encore des réponses ; sinon 404 neutre. */
const ouvert = (q: Questionnaire) => refusReel() === null && accepteDesReponses(q);
const enEssai = (req: Request) => new URL(req.url).searchParams.get("essai") === "1";

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: ENTETES });
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const q = await ouvrir(req, ctx);
  if (q instanceof Response) return q;
  const corps = await lireCorpsPlafonne(req, CHARGE_MAX_OCTETS);
  if (corps === null) return reponse(413, { ok: false, motif: "trop_volumineux" });
  const v = validerBrouillon(corps, q.id);
  if (!v.ok) return reponse(400, { ok: false, motif: v.motif });
  if (!(await debitPersonneOk(q, v.valeur.personne))) return LIMITE_ATTEINTE();
  if (enEssai(req)) return reponse(200, { ok: true, essai: true });
  if (!ouvert(q)) return reponse(404, { ok: false });
  let r: Awaited<ReturnType<typeof enregistrerBrouillon>>;
  try {
    r = await enregistrerBrouillon(q.id, v.valeur);
  } catch {
    // ex. texte déjà préfixé « enc:v1: » (double chiffrement refusé) : jamais journalisé
    return reponse(400, { ok: false, motif: "illisible" });
  }
  if (r.statut === "ferme") return reponse(404, { ok: false });
  if (r.statut === "trop_de_brouillons") {
    return reponse(413, { ok: false, motif: "trop_de_brouillons" });
  }
  if (r.statut === "deja_envoye") return reponse(409, { ok: false, motif: "deja_envoye" });
  if (r.statut === "plus_ancien") {
    return reponse(409, { ok: false, motif: "plus_ancien", horodatage: r.horodatage.getTime() });
  }
  return reponse(200, { ok: true, horodatage: r.horodatage.getTime() });
}

/** La personne de la requête (GET, DELETE), débit compris : la personne, ou le refus. */
async function personneDeLaRequete(req: Request, q: Questionnaire): Promise<Personne | Response> {
  const qs = new URL(req.url).searchParams;
  const p = personneDe(q.id, qs.get("mode"), qs.get("m") ?? "");
  if (!p.ok) return reponse(400, { ok: false, motif: p.motif });
  if (!(await debitPersonneOk(q, p.personne))) return LIMITE_ATTEINTE();
  return p.personne;
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const q = await ouvrir(req, ctx);
  if (q instanceof Response) return q;
  const p = await personneDeLaRequete(req, q);
  if (p instanceof Response) return p;
  if (enEssai(req)) {
    return reponse(200, { ok: true, essai: true, brouillon: null, horodatage: null });
  }
  if (!ouvert(q)) return reponse(404, { ok: false });
  const b = await lireBrouillon(q.id, p);
  return reponse(200, {
    ok: true,
    brouillon: b?.brouillon ?? null,
    horodatage: b?.horodatage.getTime() ?? null,
  });
}

/** Retrait de l'accord : permis même lien clos ou expiré (on ne garde jamais contre la personne). */
export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  const q = await ouvrir(req, ctx);
  if (q instanceof Response) return q;
  const p = await personneDeLaRequete(req, q);
  if (p instanceof Response) return p;
  if (enEssai(req)) return reponse(200, { ok: true, essai: true });
  await supprimerBrouillon(q.id, p);
  return reponse(200, { ok: true });
}
