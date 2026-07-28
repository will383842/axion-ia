/**
 * Espace ressources — vérification du lien magique (2026-06-13).
 * GET /fr/espace-ressources/connexion/<token> : consomme → cookie → redirect.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeRessourcesMagicLink } from "@/server/ressources/magic-link";
import { signFormateurSession } from "@/lib/formateur-session";
import { setRessourcesCookie } from "@/server/ressources/cookie";
import { RESSOURCES_BASE_PATH, RESSOURCES_CONNEXION_PATH } from "@/server/ressources/routes";
import { publicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; locale: string }> },
): Promise<Response> {
  const { token } = await params;
  // 🔴 Même défaut que l'espace formateur : `request.url` porte l'adresse
  // interne du conteneur derrière le proxy. Voir `@/lib/public-url`.
  const failureUrl = publicUrl(`${RESSOURCES_CONNEXION_PATH}?erreur=lien_invalide`);

  const recipientId = await consumeRessourcesMagicLink(token);
  if (!recipientId) return NextResponse.redirect(failureUrl);

  const recipient = await prisma.documentRecipient.findUnique({
    where: { id: recipientId },
    select: { id: true, actif: true },
  });
  if (!recipient || !recipient.actif) return NextResponse.redirect(failureUrl);

  const sessionToken = await signFormateurSession(recipient.id, "ressources");
  await setRessourcesCookie(sessionToken);
  await prisma.documentRecipient.update({
    where: { id: recipient.id },
    data: { lastRessourcesLoginAt: new Date() },
  });

  return NextResponse.redirect(publicUrl(RESSOURCES_BASE_PATH));
}
