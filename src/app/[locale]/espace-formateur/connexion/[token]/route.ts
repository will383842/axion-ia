/**
 * Espace formateur — vérification du lien magique (2026-06-13).
 *
 * GET /fr/espace-formateur/connexion/<token>
 *   1. Consomme le lien (usage unique + signature + expiration).
 *   2. Vérifie que le formateur est toujours actif.
 *   3. Pose le cookie de session signé + horodate `lastFormateurLoginAt`.
 *   4. Redirige vers le tableau de bord (ou la connexion avec erreur si KO).
 *
 * Route Handler (et non page) car seul un Route Handler / Server Action peut
 * poser un cookie. Node runtime (accès Prisma).
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeFormateurMagicLink } from "@/server/formateur/magic-link";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; locale: string }> },
): Promise<Response> {
  const { token } = await params;

  // 🔴 PAS `new URL(..., request.url)` : derrière le proxy, `request.url` porte
  // l'adresse interne du conteneur et le navigateur recevait
  // `https://0.0.0.0:3000/…` (ERR_ADDRESS_INVALID). Voir `@/lib/public-url`.
  const failureUrl = publicUrl(`${FORMATEUR_CONNEXION_PATH}?erreur=lien_invalide`);

  const trainerId = await consumeFormateurMagicLink(token);
  if (!trainerId) {
    return NextResponse.redirect(failureUrl);
  }

  // Le formateur peut avoir été désactivé entre l'envoi et le clic.
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { id: true, actif: true, statut: true, finCollaborationAt: true, email: true },
  });
  // Lot E (M14) — accès complet, ou lecture seule après une fin de collaboration.
  const acces = trainer ? await accesFormateur(trainer) : null;
  if (!trainer || acces === null) {
    return NextResponse.redirect(failureUrl);
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
  if (acces === "lecture") return NextResponse.redirect(publicUrl(FORMATEUR_LECTURE_SEULE_PATH));
  return NextResponse.redirect(
    publicUrl(destinationApresConnexion(request.nextUrl.searchParams.get("suite"))),
  );
}
