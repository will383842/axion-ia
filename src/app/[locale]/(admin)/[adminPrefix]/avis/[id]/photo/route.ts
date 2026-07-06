// Sert la photo PRIVÉE (dépôt) d'un avis pour prévisualisation admin (avant
// publication). Auth role-gated, jamais caché, jamais public.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readCv } from "@/server/careers/cv-storage";
import { detectMimeFromMagicBytes } from "@/lib/image-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !(role === "super_admin" || role === "admin" || role === "editor")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const review = await prisma.customerReview.findUnique({
    where: { id },
    select: { photoStoragePath: true },
  });
  if (!review?.photoStoragePath) return new Response("Not found", { status: 404 });
  try {
    const buf = await readCv(review.photoStoragePath);
    const mime = detectMimeFromMagicBytes(buf) ?? "image/jpeg";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
