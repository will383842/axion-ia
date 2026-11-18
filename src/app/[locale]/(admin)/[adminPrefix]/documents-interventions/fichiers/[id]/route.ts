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
import { CONSOLE_DOC_ALLOWED_MIME, readConsoleDoc } from "@/server/console-documents/storage";
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
  const doc = await getConsoleDocForDownload(id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  // 🔴 Constaté le 2026-07-26 en versant le CV du dirigeant. Cette route
  // acceptait `editor` — un rôle éditorial — pour TOUS les documents, y compris
  // ceux marqués `sensitive`, qui sont précisément les données personnelles :
  // CV, diplômes, pièces d'identité des formateurs. La fiche formateur qui
  // publie ces liens exige, elle, `admin` ou `super_admin` : la route était donc
  // PLUS permissive que la page qui y mène.
  //
  // Aucun compte `editor` n'existe aujourd'hui (un seul admin en base), mais
  // c'est exactement le genre de porte qu'on ouvre sans y penser en créant un
  // rôle de rédaction. Un document sensible reste donc réservé à l'admin.
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
  const disposition = inline ? "inline" : "attachment";
  // Type réel pour permettre le rendu inline (impression) des PDF/images ;
  // octet-stream pour les docs sensibles (jamais rendus dans le navigateur).
  const contentType = doc.sensitive || !typeSur ? "application/octet-stream" : doc.mimeType;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
