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
import { FORMATEUR_BASE_PATH, FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";
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
    select: { id: true, actif: true },
  });
  if (!trainer || !trainer.actif) {
    return NextResponse.redirect(failureUrl);
  }

  const sessionToken = await signFormateurSession(trainer.id, "formateur");
  await setFormateurCookie(sessionToken);
  await prisma.trainer.update({
    where: { id: trainer.id },
    data: { lastFormateurLoginAt: new Date() },
  });

  return NextResponse.redirect(publicUrl(FORMATEUR_BASE_PATH));
}
