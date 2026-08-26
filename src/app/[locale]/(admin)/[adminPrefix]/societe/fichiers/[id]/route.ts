// Téléchargement / ouverture d'une pièce du dossier société — route ADMIN
// authentifiée. Le fichier vit hors web-root ; il n'a jamais d'URL publique.
//
//   ?dl=1  → Content-Disposition: attachment
//   défaut → inline (ouverture dans l'onglet, impression navigateur)
//
// Une pièce marquée confidentielle est TOUJOURS servie en attachment, en
// octet-stream et sans cache — et réservée aux rôles admin. La route voisine
// des documents console porte la même règle, et pour la même raison : elle
// avait un jour été plus permissive que la page qui y menait.

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { readConsoleDoc } from "@/server/console-documents/storage";
import { getSocieteDocForDownload } from "@/server/societe-documents/queries";

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
  const doc = await getSocieteDocForDownload(id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  if (doc.sensitive && role !== "super_admin" && role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let buf: Buffer;
  try {
    buf = await readConsoleDoc(doc.storagePath);
  } catch {
    return new NextResponse("File unavailable", { status: 404 });
  }

  const forceDownload = new URL(req.url).searchParams.get("dl") === "1";
  const safeName = doc.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const inline = !doc.sensitive && !forceDownload;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.sensitive
        ? "application/octet-stream"
        : doc.mimeType || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
