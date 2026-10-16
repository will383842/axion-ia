/**
 * Formateurs freelance — export du registre des sous-traitants indépendants (Qualiopi
 * ind. 27), en CSV ou en PDF, date d'export en pied.
 *
 *   /qualiopi/formateurs/registre-sous-traitants/export?format=csv
 *   /qualiopi/formateurs/registre-sous-traitants/export?format=pdf
 *
 * Route Handler (un fichier à télécharger, rien n'est modifié hors le journal). Gardée :
 * session, rôle qui consulte la console, et interrupteur `formateurs.registre_sous_traitants`.
 * Coupé : 404.
 */

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peutConsulter } from "@/server/auth/habilitations";
import { journaliser } from "@/server/journal/journaliser";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import {
  exportRegistreCsv,
  nomFichierCsv,
} from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/export";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Non connecté.", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!peutConsulter(role)) return new NextResponse("Accès refusé.", { status: 403 });
  if (!(await interrupteurAllume("registre_sous_traitants"))) {
    return new NextResponse("Export non disponible.", { status: 404 });
  }
  const format = req.nextUrl.searchParams.get("format");
  if (format !== "csv" && format !== "pdf") {
    return new NextResponse("Format requis (csv ou pdf).", { status: 400 });
  }

  const maintenant = new Date();
  // Le fichier porte des noms et des numéros d'entreprise : qui l'a tiré, et quand.
  await journaliser(prisma, {
    action: "qualiopi.registre_sous_traitants.exporte",
    targetType: "RegistreSousTraitants",
    targetId: null,
    changes: { format },
    session: { userId: session.user.id },
  });

  if (format === "csv") {
    const csv = await exportRegistreCsv(maintenant);
    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${nomFichierCsv(maintenant)}"`,
        "cache-control": "no-store",
      },
    });
  }
  // Import différé : le rendu PDF ne se charge que pour ce format.
  const { exportRegistrePdf } =
    await import("@/server/qualiopi/formateurs-independants/registre-sous-traitants/export-pdf");
  const { buffer, filename } = await exportRegistrePdf(maintenant);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
