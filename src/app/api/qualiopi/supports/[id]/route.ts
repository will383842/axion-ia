/**
 * Téléchargement d'un support pédagogique (SupportFormation) — admin only.
 *
 * Même défaut — même remède — que `/api/qualiopi/documents/[id]` : le `pdfUrl`
 * stocké sur SupportFormation est une URL R2 signée 900 s qui EXPIRE. Quinze
 * minutes après la génération, la page Supports listait des liens morts.
 * Cette route re-signe À LA DEMANDE depuis la clé R2 persistée (`pdfKey`,
 * posée par `storeAndSignPdf`) et redirige.
 *
 * Flow :
 *   1. Auth admin (auth() + role admin/super_admin) — même gate que la page
 *      Supports qui pointe ici.
 *   2. Charge SupportFormation (pdfKey, pdfUrl, type, version, formation.slug).
 *   3. Si R2 configuré et `pdfKey` présent : vérifie l'existence, re-signe,
 *      redirige avec un nom de fichier lisible.
 *   4. Fallback : `pdfUrl` stocké (peut être expiré) → redirect. Sinon 404.
 *
 * Stub-aware indirectement : route runtime only (auth), jamais appelée au build.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isR2Configured, existsInR2, getSignedUrlR2 } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Un id non-UUID levait une P2023 Prisma → 500 au lieu d'un 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "support_not_found" }, { status: 404 });
  }

  const support = await prisma.supportFormation.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      version: true,
      pdfKey: true,
      pdfUrl: true,
      formation: { select: { slug: true } },
    },
  });
  if (!support) {
    return NextResponse.json({ error: "support_not_found" }, { status: 404 });
  }

  // Nom de fichier lisible : « slug-de-la-formation-guide_animation-v2.pdf »
  // plutôt qu'un hash R2 — c'est ce que Will range dans un dossier d'audit.
  const nomFichier = `${support.formation.slug}-${support.type}-v${support.version}.pdf`;

  if (isR2Configured() && support.pdfKey) {
    try {
      if (await existsInR2(support.pdfKey).catch(() => false)) {
        const signed = await getSignedUrlR2(support.pdfKey, 900, {
          downloadFilename: nomFichier,
        });
        return NextResponse.redirect(signed, 302);
      }
    } catch (err) {
      console.warn("[qualiopi-support] re-signature R2 échouée (fail-soft)", err);
    }
  }

  // Fallback : URL signée stockée (potentiellement expirée).
  if (support.pdfUrl) {
    return NextResponse.redirect(support.pdfUrl, 302);
  }

  return NextResponse.json({ error: "pdf_unavailable" }, { status: 404 });
}
