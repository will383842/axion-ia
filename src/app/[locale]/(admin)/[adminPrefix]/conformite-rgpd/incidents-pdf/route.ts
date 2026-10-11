/**
 * Conformité RGPD — « Journal des incidents (PDF) ». Administrateurs seulement : les
 * textes y sont déchiffrés. Rôle revérifié ici, la page ne fait que proposer le lien.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ENREGISTREMENT, enTeteContentDisposition } from "@/lib/content-disposition";
import { listerIncidents } from "@/features/conformite-rgpd/incidents-base";
import { rendreJournalIncidentsEnPdf } from "@/features/conformite-rgpd/incidents-pdf";
import { peutImporterRegistre } from "@/features/conformite-rgpd/regles";

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
  if (!peutImporterRegistre(role)) return refus(403, "Réservé aux administrateurs.");

  const incidents = await listerIncidents();
  if (incidents === null) return refus(503, "Base indisponible. Réessayez dans un instant.");

  const maintenant = new Date();
  const pdf = await rendreJournalIncidentsEnPdf(
    [...incidents].sort((a, b) => a.numero - b.numero),
    maintenant,
  );
  const jour = maintenant.toISOString().slice(0, 10);
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": enTeteContentDisposition(
        ENREGISTREMENT,
        `journal-incidents-${jour}.pdf`,
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
