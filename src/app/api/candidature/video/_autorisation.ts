// Autorisation des routes de dépôt de vidéos : le jeton personnel du lien
// « compléter ma candidature », passé dans l'en-tête `x-jeton` (jamais dans
// l'URL : une URL finit dans les journaux d'accès). Aucune session.

import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifierJetonComplement } from "@/server/recrutement/jeton-complement";

export async function candidatureDuJeton(
  req: Request,
  limite: { cle: string; nombre: number; fenetreSec: number },
): Promise<{ ok: true; applicationId: string } | { ok: false; reponse: NextResponse }> {
  const v = await verifierJetonComplement(req.headers.get("x-jeton"));
  if (!v.ok) {
    return {
      ok: false,
      reponse: NextResponse.json({ ok: false, error: "Lien invalide ou expiré." }, { status: 401 }),
    };
  }
  const existe = await prisma.jobApplication.findUnique({
    where: { id: v.applicationId },
    select: { id: true },
  });
  if (!existe) {
    return {
      ok: false,
      reponse: NextResponse.json({ ok: false, error: "Candidature introuvable." }, { status: 404 }),
    };
  }
  const essais = await checkRateLimit(`video:${limite.cle}:${v.applicationId}`, {
    limit: limite.nombre,
    windowSec: limite.fenetreSec,
  });
  if (!essais.allowed) {
    return {
      ok: false,
      reponse: NextResponse.json(
        { ok: false, error: "Trop d'essais, réessaie plus tard." },
        { status: 429 },
      ),
    };
  }
  return { ok: true, applicationId: v.applicationId };
}

/** La vidéo doit appartenir à la candidature du JETON — sinon un jeton valide écrirait chez un autre. */
export async function videoDuCandidat(applicationId: string, videoId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)) return null;
  const v = await prisma.jobApplicationVideo.findUnique({ where: { id: videoId } });
  return v && v.applicationId === applicationId ? v : null;
}
