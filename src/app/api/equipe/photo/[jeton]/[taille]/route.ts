// Sert une variante PUBLIQUE de la photo d'un collaborateur (jamais l'original).
// La base est relue à CHAQUE requête : la variante n'est servie que si la fiche est publiée,
// de type « reelle », avec consentement photo et sans demande d'effacement. Sinon 404.
// Le jeton aléatoire change à chaque remplacement : une ancienne URL ne sert plus rien.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import { photoAffichable } from "@/lib/equipe/photo-publique";
import { racinePublique } from "@/server/equipe/photo-collaborateur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NON_TROUVE = () =>
  new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jeton: string; taille: string }> },
): Promise<Response> {
  const { jeton, taille } = await params;
  if (!/^[a-f0-9]{32}$/.test(jeton) || (taille !== "256" && taille !== "1024")) return NON_TROUVE();
  const url = `/api/equipe/photo/${jeton}/${taille}`;
  const m = await prisma.teamMember.findFirst({
    where: taille === "256" ? { photoUrl256: url } : { photoUrl1024: url },
    select: {
      status: true,
      photoKind: true,
      photoConsentAt: true,
      erasureRequestedAt: true,
      photoUrl256: true,
      photoUrl1024: true,
    },
  });
  if (!m || !photoAffichable(m)) return NON_TROUVE();
  try {
    const octets = await readFile(join(racinePublique(), `${jeton}-${taille}.webp`));
    return new Response(new Uint8Array(octets), {
      headers: {
        "Content-Type": "image/webp",
        // Courte durée : un retrait doit se voir vite, y compris côté CDN.
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NON_TROUVE();
  }
}
