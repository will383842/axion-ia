// Lecture plein écran d'un e-mail enregistré — route ADMIN authentifiée (lot I0b-3).
//
// `GET /<locale>/<prefixe>/emails/lecture/<source>/<id>` rend le HTML d'un e-mail
// (copie envoyée, exemple de gabarit) pour qu'on le lise en grand. Ordre imposé :
// préfixe d'administration exact (404) → session (401) → source connue (404) → rôle (403) → forme de l'identifiant (404)
// → SEULEMENT ALORS la base. Le corps sort masqué et inerte (voir le registre).
//
// `GET` seul. Jamais mis en cache : le contenu d'un e-mail est une donnée de personne.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prefixeAdminAttendu } from "@/lib/csp";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { enTetesLecturePleinEcran, sourceLecture } from "@/server/email/lecture-plein-ecran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ adminPrefix: string; source: string; id: string }> },
): Promise<NextResponse> {
  // 🔴 AVANT `auth()` et toute lecture (audit I0b-3, constat 1) : un layout n'enveloppe pas
  // un route handler, donc `[adminPrefix]` accepte n'importe quelle valeur. Sur un mauvais
  // préfixe le proxy ne voit pas une page de console ; on ne sert rien.
  const { adminPrefix, source, id } = await params;
  if (adminPrefix !== prefixeAdminAttendu()) return new NextResponse(null, { status: 404 });

  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const role = (session.user as { role?: string }).role;

  const lecture = sourceLecture(source);
  if (!lecture) return new NextResponse("Not found", { status: 404 });
  if (!lecture.habilite(role)) return new NextResponse("Forbidden", { status: 403 });
  if (!lecture.idValide(id)) return new NextResponse("Not found", { status: 404 });

  const variante = new URL(req.url).searchParams.get("variante") ?? undefined;
  const r = await lecture.charger(id, { variante });
  if (!r.ok) {
    return new NextResponse(r.phrase, {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  }
  // Trace d'ACCÈS — best-effort, sur le modèle des pièces jointes du contact. Aucune
  // donnée de personne : ni objet, ni corps, ni destinataire ; seulement la source et l'id.
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "email.lecture_plein_ecran",
        targetType: source === "envoye" ? "EmailLog" : "EmailGabarit",
        targetId: source === "envoye" ? id : null,
        changes: { source, ...(source === "gabarit" ? { gabarit: id } : {}) },
        ipAddress: await getClientIp(),
      },
    });
  } catch {
    // silence volontaire : un journal indisponible ne prive pas de la lecture
  }

  return new NextResponse(r.html, { status: 200, headers: enTetesLecturePleinEcran() });
}
