/** Pièces jointes du site d'audit : un document interne par pièce (JPEG, PNG, PDF). */
import { NextResponse, type NextRequest } from "next/server";

import { ajouterFichier, ErreurDocument, MESSAGES_DOCUMENT } from "@/features/dossier-client/documents/ajouter";
import { TAILLE_MAX_FICHIER_OCTETS } from "@/features/dossier-client/documents/formats";
import { SANS_CACHE } from "@/features/site-audit/config";
import { gardeSiteAudit, refus } from "@/features/site-audit/garde";
import { TITRE_PIECE } from "@/features/site-audit/notes";
import { prisma } from "@/lib/prisma";
import { analyserOctets } from "@/server/careers/clamav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

function nomPropre(brut: string | null, ext: string): string {
  let nom = "piece";
  try {
    nom = decodeURIComponent(brut ?? "");
  } catch {
    nom = "piece";
  }
  nom = nom
    .replace(/\.[A-Za-z0-9]{1,10}$/, "")
    .replace(/[^\p{L}\p{N} _.-]/gu, "_")
    .trim()
    .slice(0, 100);
  return `${nom || "piece"}.${ext}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  const { clientId } = await params;
  const g = await gardeSiteAudit(req, clientId, { ecriture: true });
  if (g instanceof NextResponse) return g;

  const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const ext = EXTENSIONS[type];
  if (!ext) return refus(415, "Type de fichier non accepté.");
  const annonce = Number(req.headers.get("content-length") ?? "0");
  if (annonce > TAILLE_MAX_FICHIER_OCTETS) return refus(413, "Fichier trop volumineux.");
  const octets = new Uint8Array(await req.arrayBuffer());
  if (octets.length > TAILLE_MAX_FICHIER_OCTETS) return refus(413, "Fichier trop volumineux.");

  try {
    const r = await ajouterFichier(
      prisma,
      {
        clientId: g.clientId,
        projetId: g.projetId,
        cote: "interne",
        nature: "autre",
        titre: TITRE_PIECE,
        envoyeLe: null,
        parAdminId: g.userId,
        nom: nomPropre(req.headers.get("x-nom"), ext),
        octets,
      },
      (o) => analyserOctets(o, 30_000),
    );
    return new NextResponse(JSON.stringify({ id: r.id }), {
      status: 200,
      headers: { ...SANS_CACHE, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    if (e instanceof ErreurDocument) {
      return refus(e.message === MESSAGES_DOCUMENT.antivirusIndisponible ? 503 : 400, e.message);
    }
    throw e;
  }
}
