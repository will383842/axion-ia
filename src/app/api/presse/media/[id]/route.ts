/**
 * Sert publiquement un fichier de kit média (logo, charte, brand book…) par son id.
 *
 * Les fichiers vivent sur le volume console-docs (hors web-root) ; cette route les
 * expose en lecture seule pour les assets PUBLIÉS uniquement. Contrairement aux
 * documents console (route admin authentifiée), le kit presse est destiné aux
 * journalistes → accès public, mais borné aux assets `status=published` non supprimés.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConsoleDoc } from "@/server/console-documents/storage";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const asset = await prisma.pressMediaAsset.findFirst({
    where: { id, status: "published", deletedAt: null },
    select: { storagePath: true, fileName: true, fileFormat: true },
  });
  if (!asset || !asset.storagePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readConsoleDoc(asset.storagePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = (asset.fileFormat ?? "").toLowerCase().replace(/^\./, "");
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const fileName = asset.fileName ?? `media-${id}`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
