/**
 * Lot 6 : ouvrir le RIB d'une DEMANDE de changement de compte (console).
 *
 * `super_admin` seul (l'acte de décision) ; fichier servi seulement avec un verdict antivirus « sain » ;
 * chaque ouverture est journalisée SANS l'IBAN ; jamais de cache. Modèle : la route des pièces d'apporteur.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { entetesPiece } from "@/features/apporteurs-reseau/entetes-piece";
import { lireRibDemande } from "@/features/apporteurs-reseau/requetes-changements-iban";
import { prisma } from "@/lib/prisma";
import { refuserSiHorsConsole } from "@/server/auth/garde-route-console";
import { analyserOctets } from "@/server/careers/clamav";
import { journaliser } from "@/server/journal/journaliser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SANS_CACHE = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};
const refus = (statut: number, t: string) => new NextResponse(t, { status: statut, headers: SANS_CACHE });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string; adminPrefix: string; demandeId: string }> },
): Promise<NextResponse> {
  const horsConsole = await refuserSiHorsConsole(params);
  if (horsConsole) return horsConsole;
  const session = await auth();
  if (!session?.user?.id) return refus(401, "Session expirée : reconnectez-vous.");
  if ((session.user as { role?: string }).role !== "super_admin") {
    return refus(403, "Réservé au super administrateur.");
  }
  const { demandeId } = await params;
  if (!UUID.test(demandeId)) return refus(404, "RIB introuvable.");
  const rib = await lireRibDemande(demandeId.toLowerCase());
  if (!rib || !rib.apporteurId) return refus(404, "RIB introuvable.");
  const verdict = await analyserOctets(rib.octets, 30_000);
  if (verdict.issue === "infecte") return refus(409, "L'antivirus a trouvé un risque dans ce fichier.");
  if (verdict.issue === "indisponible") {
    return refus(503, "La vérification antivirus est momentanément indisponible. Réessayez dans quelques minutes.");
  }
  // L'ouverture est tracée : qui, quand, quelle demande. Jamais l'IBAN.
  await journaliser(prisma, {
    action: "apporteur.changement_iban.rib_ouvert",
    targetType: "ApporteurReseau",
    targetId: rib.apporteurId,
    changes: { demandeId },
    session: { userId: session.user.id },
  });
  return new NextResponse(rib.octets as unknown as BodyInit, {
    status: 200,
    headers: entetesPiece(rib.typeMime, rib.nomFichier, rib.octets.length),
  });
}
