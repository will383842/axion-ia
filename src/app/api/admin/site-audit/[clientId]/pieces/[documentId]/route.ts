/** Relecture d'une pièce jointe du site d'audit (jamais d'autre document que les pièces). */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  entetesTelechargement,
  telechargerDocument,
} from "@/features/dossier-client/documents/telecharger";
import { gardeSiteAudit, refus } from "@/features/site-audit/garde";
import { TITRE_PIECE } from "@/features/site-audit/notes";
import { prisma } from "@/lib/prisma";
import { analyserOctets } from "@/server/careers/clamav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; documentId: string }> },
): Promise<NextResponse> {
  const { clientId, documentId } = await params;
  const g = await gardeSiteAudit(req, clientId, { ecriture: false });
  if (g instanceof NextResponse) return g;
  if (!z.string().uuid().safeParse(documentId).success) return refus(404, "Introuvable.");

  const doc = await prisma.documentProjet.findFirst({
    where: {
      id: documentId,
      projetId: g.projetId,
      clientId: g.clientId,
      archiveLe: null,
      titre: TITRE_PIECE,
      fichierFormat: { in: ["jpg", "png", "pdf"] },
    },
    select: { id: true },
  });
  if (doc === null) return refus(404, "Introuvable.");

  const r = await telechargerDocument(
    prisma,
    { id: doc.id, projetId: g.projetId, clientId: g.clientId, parAdminId: g.userId },
    (o) => analyserOctets(o, 30_000),
  );
  if (r.issue === "antivirus_indisponible") {
    return refus(503, "La vérification antivirus est momentanément indisponible. Réessayez.");
  }
  if (r.issue === "infecte") return refus(409, "Fichier refusé par l'antivirus.");
  if (r.issue !== "servi") return refus(404, "Introuvable.");
  return new NextResponse(r.octets as unknown as BodyInit, {
    status: 200,
    headers: entetesTelechargement(r.nom, r.octets.length),
  });
}
