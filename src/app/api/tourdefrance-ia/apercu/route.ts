// /api/tourdefrance-ia/apercu?jeton=… — ouvre l'aperçu de la landing du Tour de
// France IA tant qu'elle est fermée au public (2026-10-25).
//
// Jeton bon : pose le cookie `tdf_apercu` = EMPREINTE SHA-256 du jeton (jamais le
// jeton lui-même), limité à `/tourdefrance-ia`, 30 jours, puis 303 vers la landing.
// Jeton absent, faux, ou variable `TOUR_APERCU_JETON` non posée : 404, comme
// n'importe quelle adresse inconnue.
//
// 🔴 Le jeton n'est écrit NULLE PART : ni dans le dépôt, ni dans un journal (cette
// route ne journalise rien), ni dans le cookie. La comparaison porte sur les
// empreintes, en temps constant.
//
// Le 303 vise `/tourdefrance-ia` SANS barre finale : `trailingSlash` est faux sur
// tout le site, et Next redirige `/tourdefrance-ia/` vers `/tourdefrance-ia`
// avant même le proxy. Viser directement la forme finale évite un saut.
//
// `api/` est hors du `matcher` du proxy : la porte d'aperçu ne s'applique pas ici.

import {
  COOKIE_APERCU,
  DUREE_APERCU_SECONDES,
  egalEnTempsConstant,
  empreinte,
  jetonConfigure,
} from "@/features/tour-de-france/porte";
import { TOUR_PREFIX } from "@/features/tour-de-france/visibilite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Borne de longueur du jeton reçu : au-delà, ce n'est pas un jeton. */
const JETON_MAX = 256;

const ENTETES_COMMUNS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  // L'adresse porte le jeton : elle ne doit jamais partir en `Referer`.
  "Referrer-Policy": "no-referrer",
} as const;

function introuvable(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...ENTETES_COMMUNS },
  });
}

export async function GET(req: Request): Promise<Response> {
  const attendu = jetonConfigure(process.env.TOUR_APERCU_JETON);
  if (!attendu) return introuvable();

  const recu = new URL(req.url).searchParams.get("jeton") ?? "";
  if (!recu || recu.length > JETON_MAX) return introuvable();

  const empreinteAttendue = await empreinte(attendu);
  if (!egalEnTempsConstant(await empreinte(recu), empreinteAttendue)) return introuvable();

  const cookie = [
    `${COOKIE_APERCU}=${empreinteAttendue}`,
    `Path=${TOUR_PREFIX}`,
    `Max-Age=${DUREE_APERCU_SECONDES}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");

  return new Response(null, {
    status: 303,
    headers: { ...ENTETES_COMMUNS, Location: TOUR_PREFIX, "Set-Cookie": cookie },
  });
}
