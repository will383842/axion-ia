/**
 * Réseau d'apporteurs — export CSV des commissions VERSÉES dans l'année, par apporteur,
 * pour la déclaration DAS2.
 *
 *   /apporteurs/commissions/export?annee=2026
 *
 * Route Handler (un fichier à télécharger, rien n'est modifié). Gardée : session ET rôle
 * de facturation (`peutEngager(role, "facturer")`), comme les actions sur les commissions.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { exportDas2 } from "@/features/apporteurs-reseau/commissions";
import { peutEngager } from "@/server/auth/habilitations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Non connecté.", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer")) return new NextResponse("Accès refusé.", { status: 403 });

  const brut = req.nextUrl.searchParams.get("annee") ?? "";
  const annee = /^\d{4}$/.test(brut) ? Number(brut) : new Date().getUTCFullYear();
  if (annee < 2026 || annee > 2100) return new NextResponse("Année invalide.", { status: 400 });

  const csv = await exportDas2(annee);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="commissions-apporteurs-versees-${annee}.csv"`,
      "cache-control": "no-store",
    },
  });
}
