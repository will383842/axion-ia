// Sert la photo publique optimisée d'un avis client.
// Route sous /api/* → exclue du proxy next-intl. Autorisée au crawl dans robots.ts
// (`/api/avis/photo/`) pour l'indexation Google Images. Cache immuable 1 an.

import { readReviewPhotoPublic } from "@/server/reviews/photo-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const clean = id.replace(/\.webp$/i, "").replace(/[^a-z0-9-]/gi, "");
  const buf = await readReviewPhotoPublic(clean);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
