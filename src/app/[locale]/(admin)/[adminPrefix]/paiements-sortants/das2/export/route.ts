/**
 * Paiements sortants — l'export DAS 2 COMMUN de l'année (lot L12h, sur FAC-9) :
 * apporteurs, formateurs indépendants et organismes, en UN fichier, au seuil
 * unique des paiements sortants (décision 70).
 *
 *   /paiements-sortants/das2/export?annee=2027          → les bénéficiaires à déclarer
 *   /paiements-sortants/das2/export?annee=2027&tous=1   → tout le monde, colonne `a_declarer`
 *
 * Route Handler (un fichier à télécharger, rien n'est modifié hors le journal).
 * Gardée : session, rôle habilité à facturer ET à rémunérer un formateur, et
 * interrupteur `formateurs.das2_commun`. Coupé : 404, et l'export des apporteurs
 * (`/apporteurs/commissions/export`) reste en place, inchangé.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peutEngager } from "@/server/auth/habilitations";
import { journaliser } from "@/server/journal/journaliser";
import { exportDas2Commune } from "@/server/paiements-sortants/das2";
import { INTERRUPTEURS_SIGNATURE } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Non connecté.", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!peutEngager(role, "facturer") || !peutEngager(role, "remunerer_formateur")) {
    return new NextResponse("Accès refusé.", { status: 403 });
  }
  if (!(await interrupteurAllume("das2_commun"))) {
    return new NextResponse(
      `Export non disponible : allumez l'interrupteur « ${INTERRUPTEURS_SIGNATURE.das2_commun.libelle} » dans l'écran Interrupteurs (Formateurs).`,
      { status: 404 },
    );
  }

  const brut = req.nextUrl.searchParams.get("annee") ?? "";
  if (!/^\d{4}$/.test(brut)) return new NextResponse("Année requise.", { status: 400 });
  const annee = Number(brut);
  if (annee < 2026 || annee > 2100) return new NextResponse("Année invalide.", { status: 400 });
  const seulementADeclarer = req.nextUrl.searchParams.get("tous") !== "1";

  const csv = await exportDas2Commune(annee, { seulementADeclarer });
  // Le fichier porte des noms et des adresses : qui l'a tiré, et quand.
  await journaliser(prisma, {
    action: "paiements_sortants.das2_exporte",
    targetType: "Das2",
    targetId: null,
    changes: { annee, seulementADeclarer },
    session: { userId: session.user.id },
  });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="das2-${annee}${seulementADeclarer ? "" : "-tous"}.csv"`,
      "cache-control": "no-store",
    },
  });
}
