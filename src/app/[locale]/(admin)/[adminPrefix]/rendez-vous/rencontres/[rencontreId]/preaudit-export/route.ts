// Droit d'accès (art. 15) d'un SALARIÉ au questionnaire de pré-audit — route ADMIN authentifiée
// (audit des données du 24/10/2026, point 12). Will télécharge les réponses de CE salarié (par
// la référence du questionnaire et le code de son lien) pour les lui transmettre. Jamais celles
// du dirigeant ni d'un autre salarié. Chaque export est journalisé (sans contenu).

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { peutVoirLesEchanges } from "@/features/dossier-client/roles-echanges";
import { prisma } from "@/lib/prisma";
import { exporterReponsesPreauditMembre } from "@/lib/rgpd-dossier-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string | null } | undefined;
  if (!user?.id) return new NextResponse("Unauthorized", { status: 401 });
  if (!peutVoirLesEchanges(user.role)) return new NextResponse("Forbidden", { status: 403 });

  const qs = new URL(req.url).searchParams;
  const ref = (qs.get("ref") ?? "").trim().slice(0, 40);
  const membre = (qs.get("membre") ?? "").trim().slice(0, 60);
  if (ref === "" || membre === "") return new NextResponse("Bad request", { status: 400 });

  const ex = await exporterReponsesPreauditMembre(ref, membre);
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: user.id,
        action: "questionnaire-preaudit.membre.export",
        targetType: "QuestionnaireAvantAuditEnvoi",
        changes: { ref, nombre: ex.reponses.length },
      },
    });
  } catch {
    // un journal indisponible n'empêche pas l'export
  }
  const nom = `reponses-${ref}-${membre}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(JSON.stringify(ex, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${nom}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
