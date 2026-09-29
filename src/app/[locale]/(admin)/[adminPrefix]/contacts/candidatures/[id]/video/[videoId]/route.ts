// Lecture d'une vidéo déposée par un candidat — route ADMIN authentifiée
// uniquement (2026-09-28). Fichier hors web-root, jamais d'URL publique.
//
// Même garde que le CV (`peutOuvrirDossierCandidat`, SSOT des habilitations) et
// même trace : qui a regardé quelle pièce. Réponses PARTIELLES (`Range`) : le
// lecteur vidéo du navigateur avance dans le fichier sans télécharger 200 Mo.
// 🔴 Seule une vidéo `disponible` — donc passée par l'antivirus — est servie.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { cheminVideo } from "@/server/careers/videos-candidat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; videoId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  if (!peutOuvrirDossierCandidat((session.user as { role?: string }).role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id, videoId } = await params;
  const v = await prisma.jobApplicationVideo
    .findUnique({ where: { id: videoId } })
    .catch(() => null);
  if (!v || v.applicationId !== id || v.statut !== "disponible") {
    return new NextResponse("Not found", { status: 404 });
  }

  let chemin: string;
  let taille: number;
  try {
    chemin = cheminVideo(v.applicationId, v.id);
    taille = (await stat(chemin)).size;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  // Trace d'accès, une fois par ouverture (pas à chaque morceau lu par le lecteur).
  const range = req.headers.get("range");
  if (!range || /^bytes=0-/.test(range)) {
    await prisma.activityLog
      .create({
        data: {
          adminUserId: session.user.id,
          action: "careers.candidature.video.vue",
          targetType: "JobApplication",
          targetId: id,
          changes: { videoId: v.id },
        },
      })
      .catch(() => {});
  }

  const entetes: Record<string, string> = {
    "Content-Type": v.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m) {
    const debut = m[1] ? Number(m[1]) : 0;
    const fin = m[2] ? Math.min(Number(m[2]), taille - 1) : taille - 1;
    if (debut >= taille || debut > fin) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${taille}` },
      });
    }
    const flux = Readable.toWeb(
      createReadStream(chemin, { start: debut, end: fin }),
    ) as ReadableStream;
    return new Response(flux, {
      status: 206,
      headers: {
        ...entetes,
        "Content-Range": `bytes ${debut}-${fin}/${taille}`,
        "Content-Length": String(fin - debut + 1),
      },
    });
  }
  const flux = Readable.toWeb(createReadStream(chemin)) as ReadableStream;
  return new Response(flux, {
    status: 200,
    headers: { ...entetes, "Content-Length": String(taille) },
  });
}
