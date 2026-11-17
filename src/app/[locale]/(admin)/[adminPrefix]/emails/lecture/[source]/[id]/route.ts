// Lecture plein écran d'un e-mail enregistré — route ADMIN authentifiée (lot I0b-3).
//
// `GET /<locale>/<prefixe>/emails/lecture/<source>/<id>` rend le HTML d'un e-mail
// (copie envoyée, exemple de gabarit) pour qu'on le lise en grand. Ordre imposé :
// session (401) → source connue (404) → rôle (403) → forme de l'identifiant (404)
// → SEULEMENT ALORS la base. Le corps sort masqué et inerte (voir le registre).
//
// `GET` seul. Jamais mis en cache : le contenu d'un e-mail est une donnée de personne.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enTetesLecturePleinEcran, sourceLecture } from "@/server/email/lecture-plein-ecran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ source: string; id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const role = (session.user as { role?: string }).role;

  const { source, id } = await params;
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
  return new NextResponse(r.html, { status: 200, headers: enTetesLecturePleinEcran() });
}
