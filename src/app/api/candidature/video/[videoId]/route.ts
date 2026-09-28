// Un morceau d'une vidéo (PUT ?i=<n>, corps = octets bruts) ou son retrait (DELETE).

import { NextResponse, type NextRequest } from "next/server";

import { VIDEO_MORCEAU_OCTETS } from "@/lib/careers/videos";
import { ecrireMorceau, supprimerVideo } from "@/server/careers/videos-candidat";

import { candidatureDuJeton, videoDuCandidat } from "../_autorisation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexte = { params: Promise<{ videoId: string }> };

export async function PUT(req: NextRequest, { params }: Contexte): Promise<NextResponse> {
  const a = await candidatureDuJeton(req, { cle: "morceau", nombre: 400, fenetreSec: 3600 });
  if (!a.ok) return a.reponse;
  const { videoId } = await params;
  const v = await videoDuCandidat(a.applicationId, videoId);
  if (!v || v.statut !== "envoi") {
    return NextResponse.json(
      { ok: false, error: "Envoi introuvable ou terminé." },
      { status: 404 },
    );
  }
  const i = Number(new URL(req.url).searchParams.get("i"));
  const octets = Buffer.from(await req.arrayBuffer());
  if (octets.length === 0 || octets.length > VIDEO_MORCEAU_OCTETS) {
    return NextResponse.json({ ok: false, error: "Morceau invalide." }, { status: 422 });
  }
  const r = await ecrireMorceau(v, i, octets);
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: `Morceau refusé (${r.raison}).` },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, octetsRecus: r.octetsRecus });
}

export async function DELETE(req: NextRequest, { params }: Contexte): Promise<NextResponse> {
  const a = await candidatureDuJeton(req, { cle: "retrait", nombre: 30, fenetreSec: 3600 });
  if (!a.ok) return a.reponse;
  const { videoId } = await params;
  const v = await videoDuCandidat(a.applicationId, videoId);
  if (!v) return NextResponse.json({ ok: false, error: "Vidéo introuvable." }, { status: 404 });
  await supprimerVideo(v);
  return NextResponse.json({ ok: true });
}
