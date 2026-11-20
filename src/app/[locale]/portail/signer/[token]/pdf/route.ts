/**
 * Lecture du PDF d'une pièce à signer, gardée par le jeton de signature.
 *
 * L'URL de stockage est signée AU CLIC (courte durée) puis 302 : un lecteur qui reste plus de
 * 15 minutes sur la page ne tombe plus sur une erreur du stockage. Mêmes contrôles que la page :
 * jeton valide (signature, non expiré, non révoqué), pièce existante, non annulée, avec un PDF.
 *
 * Tout refus rend le MÊME 404, au même corps vide : rien ne révèle ni l'existence d'une pièce,
 * ni le motif, ni une clé de stockage. Aucun identifiant n'est renvoyé.
 */

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { signedDocumentPdfUrl } from "@/lib/r2-storage";
import { refuserSiLocaleInconnue } from "@/server/auth/garde-route-console";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { lireDevisASigner } from "@/server/qualiopi/documents/signature/devis-signature-queries";
import { verifierTokenDocument } from "@/server/qualiopi/documents/signature/token-document";

export const dynamic = "force-dynamic";

/** Court : l'URL est consommée par la redirection qui suit immédiatement. */
const TTL_LECTURE_S = 5 * 60;

const EN_TETES = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
} as const;

const introuvable = (): NextResponse => new NextResponse(null, { status: 404, headers: EN_TETES });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ locale: string; token: string }> },
): Promise<NextResponse> {
  const { locale, token } = await params;
  // Locale inconnue : 404 avant toute lecture du jeton (garde SEC-1b des routes publiques).
  if (refuserSiLocaleInconnue(locale) !== null) return introuvable();

  // Contrat du build SSG (ADR 0026).
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return introuvable();

  const verif = await verifierTokenDocument(token);
  if (!verif.ok) return introuvable();

  const piece = await prisma.documentGenere.findUnique({
    where: { id: verif.documentGenereId },
    select: { type: true, numero: true, pdfUrl: true, createdAt: true, annuleeAt: true },
  });
  if (piece === null || piece.annuleeAt !== null) return introuvable();
  if (circuitPour(piece.type) === null) return introuvable();
  if (piece.pdfUrl == null || piece.pdfUrl === "") return introuvable();

  // Même garde que la page : un devis brouillon, refusé ou expiré ne se relit plus par un jeton
  // encore vivant. Lecture via `lireDevisASigner` (statut seul utilisé ici). Non reprise :
  // la cohérence `formulesActives`/`offreSha256`, qui bloque la SIGNATURE mais pas la relecture
  // d'un PDF déjà émis.
  if (piece.type === "devis") {
    const devis = await lireDevisASigner(verif.documentGenereId);
    if (devis === null) return introuvable();
    const bloquant = devis.statutBloquant;
    if (bloquant === "brouillon" || bloquant === "refuse" || bloquant === "expire") {
      return introuvable();
    }
  }

  let url: string | null = null;
  try {
    url = await signedDocumentPdfUrl(piece, TTL_LECTURE_S);
  } catch {
    url = null;
  }
  if (url === null) return introuvable();

  const reponse = NextResponse.redirect(url, 302);
  for (const [nom, valeur] of Object.entries(EN_TETES)) reponse.headers.set(nom, valeur);
  return reponse;
}
