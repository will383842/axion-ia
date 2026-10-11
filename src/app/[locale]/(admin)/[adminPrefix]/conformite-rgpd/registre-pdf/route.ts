/**
 * Conformité RGPD — « Télécharger le registre (PDF) ». Art. 30, SANS les écarts.
 * Même garde que les pages de la console : session, puis rôle de consultation.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ENREGISTREMENT, enTeteContentDisposition } from "@/lib/content-disposition";
import { rendreRegistreEnPdf } from "@/features/conformite-rgpd/registre-pdf";
import { enRegistre, lireRegistreBase } from "@/features/conformite-rgpd/base";
import { peutConsulter } from "@/server/auth/habilitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function refus(statut: number, texte: string): NextResponse {
  return new NextResponse(texte, {
    status: statut,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return refus(401, "Session expirée : reconnectez-vous.");
  const role = (session.user as { role?: string }).role ?? null;
  if (!peutConsulter(role)) return refus(403, "Accès refusé.");

  const lecture = await lireRegistreBase();
  if (lecture.etat !== "ok") return refus(503, "Base indisponible. Réessayez dans un instant.");
  if (lecture.traitements.length === 0) return refus(404, "Aucun registre importé.");

  const maintenant = new Date();
  // Les activités ACTIVES seulement ; le gabarit ne reçoit aucun écart.
  const pdf = await rendreRegistreEnPdf(enRegistre(lecture.traitements), maintenant);
  const jour = maintenant.toISOString().slice(0, 10);
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": enTeteContentDisposition(
        ENREGISTREMENT,
        `registre-traitements-${jour}.pdf`,
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
