// Fin d'envoi : taille exacte, format RÉEL vérifié, puis antivirus.

import { NextResponse, type NextRequest } from "next/server";

import { finaliserVideo } from "@/server/careers/videos-candidat";

import { candidatureDuJeton, videoDuCandidat } from "../../_autorisation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
): Promise<NextResponse> {
  const a = await candidatureDuJeton(req, { cle: "fin", nombre: 30, fenetreSec: 3600 });
  if (!a.ok) return a.reponse;
  const { videoId } = await params;
  const v = await videoDuCandidat(a.applicationId, videoId);
  if (!v || v.statut !== "envoi") {
    return NextResponse.json(
      { ok: false, error: "Envoi introuvable ou terminé." },
      { status: 404 },
    );
  }
  const r = await finaliserVideo(v);
  if (!r.ok) {
    const message =
      r.raison === "format"
        ? "Ce fichier n'est pas une vidéo MP4, MOV ou WebM."
        : "La vidéo n'est pas arrivée en entier, réessayez.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
