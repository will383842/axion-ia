/**
 * GET /api/qualiopi/devis/[id]/apercu
 *
 * Aperçu PDF d'un devis BROUILLON, avant « Envoyer ». Rend le même `DevisPdf`
 * que l'envoi (mêmes données : `donneesPdfDevis`), avec un filigrane « APERÇU ».
 *
 * 🔴 Aucun effet de bord, par construction : pas de numéro de pièce alloué, pas
 * d'écriture R2, pas de `DocumentGenere`, pas de changement de statut. On
 * n'appelle donc PAS `generateDocument` — seulement `renderPdfToBuffer`.
 *
 * Logée sous `api/qualiopi/` (et non `api/admin/qualiopi/`) pour la même raison
 * que `pieces/[id]/exemplaire-signe` : `qualiopi:isolation-check`.
 *
 * Auth : admin / super_admin uniquement (le devis porte l'identité du client).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import {
  SELECT_DEVIS_POUR_PDF,
  OffreDevisInvalideError,
  donneesPdfDevis,
  lireContextePdfDevis,
} from "@/server/qualiopi/documents/donnees-pdf-devis";
import { DevisPdf } from "@/server/qualiopi/documents/templates/devis";
import { avecFiligraneApercu } from "@/server/qualiopi/documents/apercu-filigrane";
import { enTeteContentDisposition, CONSULTATION } from "@/lib/content-disposition";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 404 });
  }

  const devis = await prisma.devis.findUnique({
    where: { id: idParsed.data },
    select: SELECT_DEVIS_POUR_PDF,
  });
  if (!devis) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }
  // Un devis déjà émis a sa pièce numérotée : l'aperçu n'a de sens que pour un brouillon.
  if (devis.statut !== "brouillon") {
    return NextResponse.json(
      { error: "L'aperçu est réservé aux devis en brouillon." },
      { status: 409 },
    );
  }

  const contexte = await lireContextePdfDevis();
  let data: ReturnType<typeof donneesPdfDevis>;
  try {
    data = donneesPdfDevis(devis, contexte, new Date());
  } catch (err) {
    // Offre stockée illisible : message clair, jamais un 500 ni un devis à 0 €.
    if (err instanceof OffreDevisInvalideError) {
      return NextResponse.json(
        { error: `${err.message}. Corrigez l'offre du devis avant de l'afficher.` },
        { status: 422 },
      );
    }
    throw err;
  }
  const element = avecFiligraneApercu(DevisPdf({ data }));
  const { buffer } = await renderPdfToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": enTeteContentDisposition(
        CONSULTATION,
        `apercu-devis-${devis.numero}.pdf`,
      ),
      "Cache-Control": "private, no-store",
    },
  });
}
