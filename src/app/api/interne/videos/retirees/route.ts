/**
 * `GET /api/interne/videos/retirees` — slugs des vidéos retirées, un par ligne, lu par le
 * proxy pour répondre 410 (lot W2, décision D6).
 *
 * PUBLIQUE en lecture : un slug retiré était une adresse publique, rien de secret. Vide
 * (200) si l'interrupteur est éteint. Mise en cache 5 min par Cloudflare ; le proxy garde
 * sa propre copie 5 min. Jamais indexée (`robots.ts` interdit `/api/`).
 */
import { slugsRetires } from "@/server/videos/lecture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const slugs = await slugsRetires();
  return new Response(slugs.length > 0 ? `${slugs.join("\n")}\n` : "", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=300, max-age=60",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
