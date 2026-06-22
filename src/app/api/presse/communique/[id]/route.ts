/**
 * Sert publiquement le PDF d'un communiqué de presse par son id.
 *
 * 2026-06-22 — BASCULE PDF : un communiqué est désormais un PDF uploadé. Ce PDF
 * vit sur le volume console-docs (hors web-root) ; cette route l'expose en
 * lecture seule pour les communiqués PUBLIÉS uniquement (status=published,
 * non supprimés) — destiné aux journalistes (accès public borné).
 *
 * Mirror exact du pattern `api/presse/media/[id]/route.ts`.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConsoleDoc } from "@/server/console-documents/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const release = await prisma.pressRelease.findFirst({
    where: { id, status: "published", deletedAt: null },
    select: { pdfStoragePath: true, pdfFileName: true },
  });
  if (!release || !release.pdfStoragePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readConsoleDoc(release.pdfStoragePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const fileName = release.pdfFileName ?? `communique-${id}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
