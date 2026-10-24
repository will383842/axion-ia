// Brouillon du questionnaire de pré-audit (2026-10-24) : reprendre après une fermeture d'onglet.
//
// Contrat complet : `_PLAN-QUESTIONNAIRE-PREAUDIT-2026-10-24/CONTRAT-BROUILLON.md`.
//   · POST   : enregistre `{ consent: true, horodatage, mode, membre?, brouillon }` (chiffré) ;
//   · GET    : `?mode=main|emp|it&m=<code>` rend le brouillon de cette personne ;
//   · DELETE : mêmes paramètres, supprime le brouillon (retrait de l'accord).
// Même jeton HMAC que la route des réponses (faux → 404 neutre), mêmes plafonds de débit (par IP
// et par lien, compteurs DISTINCTS pour qu'un enregistrement automatique ne consomme jamais le
// quota de l'envoi final), même plafond de 400 000 octets, même CORS `null`.
// Rien n'est journalisé ici : ni corps, ni brouillon.

import { NextResponse } from "next/server";

import {
  enregistrerBrouillon,
  lireBrouillon,
  personneDe,
  purgerBrouillonsInactifs,
  supprimerBrouillon,
  validerBrouillon,
} from "@/features/questionnaire-preaudit/brouillon";
import { refusReel } from "@/features/questionnaire-preaudit/config";
import { lireCorpsPlafonne } from "@/features/questionnaire-preaudit/corps";
import { CHARGE_MAX_OCTETS } from "@/features/questionnaire-preaudit/donnees";
import { ENTETES_CORS_BROUILLON } from "@/features/questionnaire-preaudit/entetes";
import { accepteDesReponses, lireParJeton } from "@/features/questionnaire-preaudit/serveur";
import { ipVisiteurOuNull } from "@/lib/client-ip-core";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";

import { LIMITE_PAR_IP, LIMITE_PAR_JETON } from "../route";

export const dynamic = "force-dynamic";

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

function empreinteIp(req: Request): string {
  try {
    return hashIp(ipVisiteurOuNull(req.headers)) ?? "sans-ip";
  } catch {
    return "sans-sel";
  }
}

/** Débit, puis jeton : rend le questionnaire, ou la réponse de refus (429 / 404 neutre). */
async function ouvrir(req: Request, ctx: Ctx): Promise<Questionnaire | Response> {
  const { id, jeton } = await ctx.params;
  const parIp = await checkRateLimit(
    `questionnaire-preaudit-brouillon:ip:${empreinteIp(req)}`,
    LIMITE_PAR_IP,
  );
  if (!parIp.allowed) return reponse(429, { ok: false });
  const q = await lireParJeton(id, jeton);
  if (q === null) return reponse(404, { ok: false });
  const parJeton = await checkRateLimit(
    `questionnaire-preaudit-brouillon:lien:${q.id}`,
    LIMITE_PAR_JETON,
  );
  if (!parJeton.allowed) return reponse(429, { ok: false });
  return q;
}

/** Le réel est permis et le lien reçoit encore des réponses ; sinon 404 neutre. */
const ouvert = (q: Questionnaire) => refusReel() === null && accepteDesReponses(q);

async function purger(): Promise<void> {
  try {
    await purgerBrouillonsInactifs();
  } catch {
    // purge reprise à la requête suivante ; la lecture ignore déjà tout brouillon inactif
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: ENTETES });
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const q = await ouvrir(req, ctx);
  if (q instanceof Response) return q;
  const essai = new URL(req.url).searchParams.get("essai") === "1";
  const corps = await lireCorpsPlafonne(req, CHARGE_MAX_OCTETS);
  if (corps === null) return reponse(413, { ok: false, motif: "trop_volumineux" });
  const v = validerBrouillon(corps);
  if (!v.ok) return reponse(400, { ok: false, motif: v.motif });
  if (essai) return reponse(200, { ok: true, essai: true });
  if (!ouvert(q)) return reponse(404, { ok: false });
  await purger();
  let r: Awaited<ReturnType<typeof enregistrerBrouillon>>;
  try {
    r = await enregistrerBrouillon(q.id, v.valeur);
  } catch {
    // ex. texte déjà préfixé « enc:v1: » (double chiffrement refusé) : jamais journalisé
    return reponse(400, { ok: false, motif: "illisible" });
  }
  if (r.statut === "ferme") return reponse(404, { ok: false });
  if (r.statut === "deja_envoye") return reponse(409, { ok: false, motif: "deja_envoye" });
  if (r.statut === "plus_ancien") {
    return reponse(409, {
      ok: false,
      motif: "plus_ancien",
      horodatage: r.horodatage.getTime(),
    });
  }
  return reponse(200, { ok: true, horodatage: r.horodatage.getTime() });
}

function personneDeLaRequete(req: Request) {
  const qs = new URL(req.url).searchParams;
  return personneDe(qs.get("mode"), qs.get("m") ?? "");
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const q = await ouvrir(req, ctx);
  if (q instanceof Response) return q;
  const p = personneDeLaRequete(req);
  if (!p.ok) return reponse(400, { ok: false, motif: p.motif });
  if (new URL(req.url).searchParams.get("essai") === "1") {
    return reponse(200, { ok: true, essai: true, brouillon: null, horodatage: null });
  }
  if (!ouvert(q)) return reponse(404, { ok: false });
  await purger();
  const b = await lireBrouillon(q.id, p.personne);
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
  const p = personneDeLaRequete(req);
  if (!p.ok) return reponse(400, { ok: false, motif: p.motif });
  await supprimerBrouillon(q.id, p.personne);
  return reponse(200, { ok: true });
}
