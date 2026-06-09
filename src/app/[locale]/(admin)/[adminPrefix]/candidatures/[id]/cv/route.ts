// Download du CV d'une candidature — route ADMIN authentifiée uniquement.
// Le fichier est hors web-root (/var/data/cv) ; jamais d'URL publique.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readCv } from "@/server/careers/cv-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const a = await prisma.jobApplication.findUnique({
    where: { id },
    select: { cvStoragePath: true, cvOriginalName: true, cvMimeType: true },
  });
  if (!a?.cvStoragePath) return new NextResponse("Not found", { status: 404 });

  try {
    const buf = await readCv(a.cvStoragePath);
    const safeName = (a.cvOriginalName || "cv").replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": a.cvMimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("File unavailable", { status: 404 });
  }
}
