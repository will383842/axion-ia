/**
 * Lot I3, étape 5 — consultation du scan d'un devis signé sur papier (admin uniquement).
 *
 * Trouve la signature « client » `papier_scanne` de la pièce du devis et redirige vers une URL R2
 * signée de 120 s. Rien n'est servi directement : le scan est une donnée du client.
 *
 * Runtime uniquement (auth), jamais appelée au build.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrlR2 } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const devis = await prisma.devis.findUnique({
    where: { id },
    select: { documentGenereId: true },
  });
  if (devis === null || devis.documentGenereId === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ligne = await prisma.documentSignature.findFirst({
    where: {
      documentGenereId: devis.documentGenereId,
      partie: "client",
      methode: "papier_scanne",
      revokedAt: null,
      imagePurgeeAt: null,
      mimeType: "application/pdf",
    },
    select: { signatureKey: true },
  });
  if (ligne === null || ligne.signatureKey === null || ligne.signatureKey === "") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const url = await getSignedUrlR2(ligne.signatureKey, 120);
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.json({ error: "scan_unavailable" }, { status: 404 });
  }
}
