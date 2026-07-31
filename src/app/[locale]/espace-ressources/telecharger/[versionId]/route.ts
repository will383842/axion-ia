/**
 * Espace ressources — téléchargement d'un document (2026-06-13).
 *
 * GET /fr/espace-ressources/telecharger/<versionId>?kind=source|pdf
 *   1. exige une session destinataire (cookie) ;
 *   2. vérifie que la version fait partie des documents accessibles à la personne ;
 *   3. signe l'URL R2 (5 min), trace l'accusé de téléchargement ;
 *   4. redirige (302) vers l'URL signée.
 *
 * Route serveur (et non window.open côté client après await) → le téléchargement
 * passe par une navigation réelle, immunisée aux bloqueurs de pop-up.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedUrlR2, isR2Configured } from "@/lib/r2-storage";
import { getRecipientSession } from "@/server/ressources/guard";
import { listDocumentsForRecipientEmail } from "@/server/ressources/queries";
import { RESSOURCES_CONNEXION_PATH } from "@/server/ressources/routes";
import { publicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
): Promise<Response> {
  const session = await getRecipientSession();
  if (!session) {
    return NextResponse.redirect(publicUrl(RESSOURCES_CONNEXION_PATH));
  }

  const { versionId } = await params;
  const kind = request.nextUrl.searchParams.get("kind") === "source" ? "source" : "pdf";

  // Contrôle d'accès : la version doit appartenir au périmètre de la personne.
  const accessible = await listDocumentsForRecipientEmail(session.email);
  if (!accessible.some((d) => d.versionId === versionId)) {
    return new NextResponse("Accès refusé", { status: 403 });
  }

  const version = await prisma.interventionDocumentVersion.findUnique({
    where: { id: versionId },
    select: { sourceKey: true, pdfKey: true },
  });
  const key = kind === "source" ? version?.sourceKey : version?.pdfKey;
  if (!key || !isR2Configured()) {
    return new NextResponse("Fichier indisponible", { status: 404 });
  }

  let url: string;
  try {
    url = await getSignedUrlR2(key, 5 * 60);
  } catch {
    return new NextResponse("Lien indisponible, réessayez", { status: 502 });
  }

  // Accusé de téléchargement (fail-soft).
  try {
    await prisma.ressourceTelechargement.create({
      data: { recipientId: session.recipientId, versionId, kind },
    });
  } catch {
    /* trace best-effort */
  }

  return NextResponse.redirect(url);
}
