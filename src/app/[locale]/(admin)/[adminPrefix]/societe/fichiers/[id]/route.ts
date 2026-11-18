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
import { CONSOLE_DOC_ALLOWED_MIME, readConsoleDoc } from "@/server/console-documents/storage";
import { getSocieteDocForDownload } from "@/server/societe-documents/queries";
import { refuserSiHorsConsole } from "@/server/auth/garde-route-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ locale: string; adminPrefix: string; id: string }> },
): Promise<NextResponse> {
  const horsConsole = await refuserSiHorsConsole(params);
  if (horsConsole) return horsConsole;
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
  // Ouverture en ligne seulement pour un type de la liste : une ligne déjà stockée
  // avec un autre type (ex. text/html) est servie en téléchargement, jamais rendue.
  const typeSur = (CONSOLE_DOC_ALLOWED_MIME as readonly string[]).includes(doc.mimeType);
  const inline = !doc.sensitive && !forceDownload && typeSur;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.sensitive || !typeSur ? "application/octet-stream" : doc.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
