// Téléchargement / impression d'un document console — route ADMIN authentifiée.
// Le fichier est hors web-root (volume disque) ; jamais d'URL publique / CDN.
//
//   ?dl=1  → Content-Disposition: attachment (téléchargement)
//   défaut → inline (ouverture dans l'onglet → impression navigateur)
// Les documents `sensitive` (ex. casier judiciaire) sont TOUJOURS forcés en
// attachment + no-store (jamais rendus inline ni mis en cache).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConsoleDocForDownload } from "@/server/console-documents/queries";
import { readConsoleDoc } from "@/server/console-documents/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const role = (session?.user as { id?: string; role?: string } | undefined)?.role;
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const doc = await getConsoleDocForDownload(id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  let buf: Buffer;
  try {
    buf = await readConsoleDoc(doc.storagePath);
  } catch {
    return new NextResponse("File unavailable", { status: 404 });
  }

  const forceDownload = new URL(req.url).searchParams.get("dl") === "1";
  const safeName = doc.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const inline = !doc.sensitive && !forceDownload;
  const disposition = inline ? "inline" : "attachment";
  // Type réel pour permettre le rendu inline (impression) des PDF/images ;
  // octet-stream pour les docs sensibles (jamais rendus dans le navigateur).
  const contentType = doc.sensitive ? "application/octet-stream" : doc.mimeType;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
