/**
 * Ouvrir une pièce d'apporteur depuis la console (réseau d'apporteurs, démarrage manuel).
 *
 * Administrateurs seulement : ce sont des pièces d'identité et des RIB. Hors couple
 * (pièce, apporteur) : 404. Un fichier ne sort qu'avec un verdict antivirus « sain »
 * (409 infecté, 503 antivirus indisponible), comme les documents de projet. Servi
 * en ligne pour être lu dans le navigateur (PDF, JPG, PNG seulement, contrôlés au
 * dépôt), sous une politique de sécurité qui interdit tout script.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { lireOctetsPiece } from "@/features/apporteurs-reseau/requetes-console";
import { analyserOctets } from "@/server/careers/clamav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const SANS_CACHE = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

function refus(statut: number, texte: string): NextResponse {
  return new NextResponse(texte, { status: statut, headers: SANS_CACHE });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; pieceId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return refus(401, "Session expirée : reconnectez-vous.");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "super_admin" && role !== "admin") return refus(403, "Réservé aux administrateurs.");
  const { id, pieceId } = await params;
  if (!UUID.test(id) || !UUID.test(pieceId)) return refus(404, "Pièce introuvable.");
  const p = await lireOctetsPiece(id.toLowerCase(), pieceId.toLowerCase());
  if (!p || !TYPES.has(p.typeMime)) return refus(404, "Pièce introuvable.");
  const verdict = await analyserOctets(p.octets, 30_000);
  if (verdict.issue === "infecte") return refus(409, "L'antivirus a trouvé un risque dans ce fichier.");
  if (verdict.issue === "indisponible") {
    return refus(503, "La vérification antivirus est momentanément indisponible. Réessayez dans quelques minutes.");
  }
  const nom = p.nomFichier.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(p.octets as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": p.typeMime,
      "Content-Length": String(p.octets.length),
      "Content-Disposition": `inline; filename="${nom}"`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
