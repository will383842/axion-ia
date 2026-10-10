/**
 * Conformité RGPD — « Télécharger le registre (PDF) ». Art. 30, SANS les écarts.
 * Même garde que les pages de la console : session, puis rôle de consultation.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ENREGISTREMENT, enTeteContentDisposition } from "@/lib/content-disposition";
import { rendreRegistreEnPdf } from "@/features/conformite-rgpd/registre-pdf";
import { lireRegistre } from "@/features/conformite-rgpd/stockage";
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

  const lecture = await lireRegistre();
  if (lecture.etat === "non_configure") return refus(503, "Stockage privé non configuré.");
  if (lecture.etat === "absent") return refus(404, "Aucun registre importé.");
  if (lecture.etat === "illisible") return refus(422, lecture.erreur);

  const maintenant = new Date();
  const pdf = await rendreRegistreEnPdf(lecture.registre, maintenant);
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
