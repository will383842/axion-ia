// Téléchargement d'une pièce jointe du formulaire de contact — route ADMIN
// authentifiée uniquement (2026-10-15). Jumelle de `contacts/candidatures/[id]/cv`.
//
// Le fichier vit dans le compartiment R2 PRIVÉ : aucune URL publique, aucune URL
// pré-signée qui circulerait hors session. Le serveur lit l'objet après le
// contrôle de session et de rôle, puis le sert en téléchargement neutre.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBufferR2 } from "@/lib/r2-storage";
import { peutConsulter } from "@/server/auth/habilitations";
import { getClientIp } from "@/lib/client-ip";
import { dispositionPieceJointe } from "@/features/dossier-client/documents/formats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; pieceId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const role = (session.user as { role?: string }).role;
  // Mêmes rôles que la fiche du message (`gardePage("consultation")`).
  if (!peutConsulter(role)) return new NextResponse("Forbidden", { status: 403 });

  const { id, pieceId } = await params;
  if (!UUID.test(id) || !UUID.test(pieceId)) return new NextResponse("Not found", { status: 404 });

  // La pièce doit appartenir à CETTE demande : un identifiant de pièce seul ne suffit pas.
  const piece = await prisma.submissionAttachment.findFirst({
    where: { id: pieceId, submissionId: id },
    select: { nomFichier: true, cleStockage: true },
  });
  if (!piece) return new NextResponse("Not found", { status: 404 });

  const buf = await getObjectBufferR2(piece.cleStockage);
  if (!buf) return new NextResponse("File unavailable", { status: 404 });

  // Trace d'ACCÈS — best-effort, comme la route des CV.
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "contact.piece_jointe.telechargee",
        targetType: "Submission",
        targetId: id,
        ipAddress: await getClientIp(),
      },
    });
  } catch {
    // silence volontaire : un journal indisponible ne prive pas de la pièce
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      // Type forcé neutre + nosniff : le contenu n'est jamais rendu par le navigateur.
      "Content-Type": "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": dispositionPieceJointe(piece.nomFichier),
      "Cache-Control": "private, no-store",
    },
  });
}
