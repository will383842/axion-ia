// Lecture d'une pièce DÉPOSÉE par un formateur indépendant (lot L5b, ADR 0066) —
// route ADMIN authentifiée uniquement. Les octets vivent chiffrés en base
// (`TrainerDocumentContenu`) : jamais d'URL publique. Droit, IDOR, interrupteur
// et journal de lecture : `lecture-piece.ts`.

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { lirePieceDeposee } from "@/server/qualiopi/formateurs-independants/lecture-piece";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EN_TETES_NEUTRES = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401, headers: EN_TETES_NEUTRES });
  }
  const role = (session.user as { role?: string }).role;
  const { id, docId } = await params;

  const r = await lirePieceDeposee({
    trainerId: id,
    documentId: docId,
    session: { userId: session.user.id, role },
  });
  if (!r.ok) {
    return new NextResponse(r.statut === 403 ? "Forbidden" : "Not found", {
      status: r.statut,
      headers: EN_TETES_NEUTRES,
    });
  }

  const nom = r.nom.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(r.octets), {
    headers: {
      ...EN_TETES_NEUTRES,
      // Type forcé neutre + nosniff : jamais de rendu dans la page de la console.
      "Content-Type": "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${nom}"`,
    },
  });
}
