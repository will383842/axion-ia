/**
 * Espace formateur — vérification du lien magique (2026-06-13).
 *
 * GET /fr/espace-formateur/connexion/<token> — V2-N-5 : NE CONSOMME RIEN.
 *   Les messageries ouvrent les liens pour les contrôler : une ouverture qui consommait
 *   le lien le brûlait avant la personne. GET affiche la page « Ouvrir mon espace »
 *   (lien encore utilisable) ou renvoie à la connexion avec erreur.
 *
 * POST (le bouton de cette page) :
 *   1. Consomme le lien (usage unique + signature + expiration).
 *   2. Vérifie que le formateur est toujours actif.
 *   3. Pose le cookie de session signé + horodate `lastFormateurLoginAt`.
 *   4. Redirige (303) vers le tableau de bord (ou la connexion avec erreur si KO).
 *
 * Route Handler (et non page) car seul un Route Handler / Server Action peut
 * poser un cookie. Node runtime (accès Prisma).
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consumeFormateurMagicLink,
  formateurMagicLinkUtilisable,
} from "@/server/formateur/magic-link";
import {
  ENTETES_PAGE_CONNEXION,
  pageConfirmerConnexion,
} from "@/server/formateur/page-confirmer-connexion";
import { signFormateurSession } from "@/lib/formateur-session";
import { setFormateurCookie } from "@/server/formateur/cookie";
import { FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";
import { destinationApresConnexion } from "@/server/formateur/suite-lien";
import {
  accesFormateur,
  empreinteSessionFormateur,
  versionSessionFormateur,
} from "@/server/formateur/acces-apres-fin";
import { FORMATEUR_LECTURE_SEULE_PATH } from "@/server/formateur/guard";
import { publicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

/** 303 : après un POST, le navigateur suit la redirection en GET (jamais un re-POST). */
const VOIR_AILLEURS = 303;

// 🔴 PAS `new URL(..., request.url)` : derrière le proxy, `request.url` porte
// l'adresse interne du conteneur et le navigateur recevait
// `https://0.0.0.0:3000/…` (ERR_ADDRESS_INVALID). Voir `@/lib/public-url`.
const urlEchec = () => publicUrl(`${FORMATEUR_CONNEXION_PATH}?erreur=lien_invalide`);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; locale: string }> },
): Promise<Response> {
  const { token } = await params;
  if (!(await formateurMagicLinkUtilisable(token))) return NextResponse.redirect(urlEchec());
  return new NextResponse(pageConfirmerConnexion(), {
    status: 200,
    headers: ENTETES_PAGE_CONNEXION,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; locale: string }> },
): Promise<Response> {
  const { token } = await params;
  const failureUrl = urlEchec();

  // Le bouton est sur la page elle-même : un envoi venu d'un AUTRE site (connexion
  // forcée sur un compte qui n'est pas le sien) ne consomme rien.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.redirect(failureUrl, VOIR_AILLEURS);
  }

  const trainerId = await consumeFormateurMagicLink(token);
  if (!trainerId) {
    return NextResponse.redirect(failureUrl, VOIR_AILLEURS);
  }

  // Le formateur peut avoir été désactivé entre l'envoi et le clic.
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { id: true, actif: true, statut: true, finCollaborationAt: true, email: true },
  });
  // Lot E (M14) — accès complet, ou lecture seule après une fin de collaboration.
  const acces = trainer ? await accesFormateur(trainer) : null;
  if (!trainer || acces === null) {
    return NextResponse.redirect(failureUrl, VOIR_AILLEURS);
  }

  // La session porte la version de session : une clôture de fin la fait tomber (pas
  // l'envoi du dossier, qui ne touche que `accesVersion`). Lot C4 : et l'empreinte de
  // l'adresse — un changement d'adresse d'un indépendant la fait tomber aussi.
  const sessionToken = await signFormateurSession(
    trainer.id,
    "formateur",
    undefined,
    versionSessionFormateur(trainer),
    (typeof trainer.email === "string" ? empreinteSessionFormateur(trainer.email) : null) ??
      undefined,
  );
  await setFormateurCookie(sessionToken);
  await prisma.trainer.update({
    where: { id: trainer.id },
    data: { lastFormateurLoginAt: new Date() },
  });

  // S6a (h) — `suite` n'est suivi que s'il figure sur la liste blanche des
  // chemins de l'espace : jamais de redirection ouverte.
  if (acces === "lecture") {
    return NextResponse.redirect(publicUrl(FORMATEUR_LECTURE_SEULE_PATH), VOIR_AILLEURS);
  }
  return NextResponse.redirect(
    publicUrl(destinationApresConnexion(request.nextUrl.searchParams.get("suite"))),
    VOIR_AILLEURS,
  );
}
