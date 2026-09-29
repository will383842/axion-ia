// Dépôt de vidéos par le candidat (Will, 2026-09-28).
//   GET  → ses vidéos et leur état (la page les relit pendant l'analyse) ;
//   POST → annonce d'un dépôt { nom, taille } → { id, tailleMorceau }.
// Les morceaux arrivent ensuite par PUT /api/candidature/video/<id>?i=<n>,
// puis POST /api/candidature/video/<id>/fin.

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  extensionAutorisee,
  nomAffichable,
  VIDEO_MORCEAU_OCTETS,
  VIDEO_OCTETS_MAX,
  VIDEOS_MAX,
} from "@/lib/careers/videos";
import { relancerAnalysesEnAttente } from "@/server/careers/videos-candidat";

import { candidatureDuJeton } from "./_autorisation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const a = await candidatureDuJeton(req, { cle: "liste", nombre: 600, fenetreSec: 3600 });
  if (!a.ok) return a.reponse;
  await relancerAnalysesEnAttente(a.applicationId);
  const videos = await prisma.jobApplicationVideo.findMany({
    where: { applicationId: a.applicationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nomOriginal: true,
      taille: true,
      octetsRecus: true,
      statut: true,
      motifRejet: true,
    },
  });
  return NextResponse.json({ ok: true, videos });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const a = await candidatureDuJeton(req, { cle: "init", nombre: 20, fenetreSec: 3600 });
  if (!a.ok) return a.reponse;
  const corps = (await req.json().catch(() => null)) as { nom?: unknown; taille?: unknown } | null;
  const nom = typeof corps?.nom === "string" ? corps.nom : "";
  const taille = typeof corps?.taille === "number" ? corps.taille : Number.NaN;
  if (!nom || !extensionAutorisee(nom)) {
    return NextResponse.json(
      { ok: false, error: "Formats acceptés : MP4, MOV ou WebM." },
      { status: 422 },
    );
  }
  if (!Number.isInteger(taille) || taille <= 0 || taille > VIDEO_OCTETS_MAX) {
    return NextResponse.json({ ok: false, error: "200 Mo au maximum par vidéo." }, { status: 422 });
  }
  // Un envoi abandonné (onglet fermé) ne doit pas occuper une place : ménage
  // des envois de plus d'une heure avant d'en ouvrir un nouveau.
  await prisma.jobApplicationVideo.deleteMany({
    where: {
      applicationId: a.applicationId,
      statut: "envoi",
      createdAt: { lt: new Date(Date.now() - 3_600_000) },
    },
  });
  // Les vidéos refusées ne comptent pas ; celles en cours d'envoi, si.
  const occupees = await prisma.jobApplicationVideo.count({
    where: { applicationId: a.applicationId, statut: { in: ["envoi", "analyse", "disponible"] } },
  });
  if (occupees >= VIDEOS_MAX) {
    return NextResponse.json(
      { ok: false, error: `${VIDEOS_MAX} vidéos au maximum.` },
      { status: 422 },
    );
  }
  const v = await prisma.jobApplicationVideo.create({
    data: {
      applicationId: a.applicationId,
      nomOriginal: nomAffichable(nom),
      taille,
      mime: "inconnu",
      statut: "envoi",
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: v.id, tailleMorceau: VIDEO_MORCEAU_OCTETS });
}
