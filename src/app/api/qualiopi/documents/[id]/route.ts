/**
 * Téléchargement d'un document Qualiopi généré (DocumentGenere) — admin only.
 *
 * Le `pdfUrl` stocké sur DocumentGenere est une URL R2 signée 900 s qui EXPIRE.
 * Cette route re-signe l'URL À LA DEMANDE (durabilité) et redirige : le registre
 * documentaire reste téléchargeable indéfiniment, et le bouton « Télécharger le
 * PDF » de GenererFactureButton (qui pointe ici) fonctionne.
 *
 * Flow :
 *   1. Auth admin (auth() + role admin/super_admin).
 *   2. Charge DocumentGenere (type, numero, createdAt, pdfUrl).
 *   3. Si R2 configuré : reconstruit la clé `documents/{année}/{type}/{numero}.pdf`
 *      (identique à `generateDocument`), vérifie l'existence, re-signe, redirige.
 *   4. Fallback : `pdfUrl` stocké (peut être expiré) → redirect. Sinon 404.
 *
 * Stub-aware indirectement : route runtime only (auth), jamais appelée au build.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isR2Configured, existsInR2, getSignedUrlR2, documentPdfKey } from "@/lib/r2-storage";

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

  const doc = await prisma.documentGenere.findUnique({
    where: { id },
    select: { id: true, type: true, numero: true, pdfUrl: true, createdAt: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }

  // Re-signature R2 à la demande (clé identique à generateDocument).
  if (isR2Configured()) {
    const key = documentPdfKey(doc);
    try {
      if (await existsInR2(key).catch(() => false)) {
        const signed = await getSignedUrlR2(key, 900);
        return NextResponse.redirect(signed, 302);
      }
    } catch (err) {
      console.warn("[qualiopi-doc] re-signature R2 échouée (fail-soft)", err);
    }
  }

  // Fallback : URL signée stockée (potentiellement expirée).
  if (doc.pdfUrl) {
    return NextResponse.redirect(doc.pdfUrl, 302);
  }

  return NextResponse.json({ error: "pdf_unavailable" }, { status: 404 });
}
