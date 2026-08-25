// Affichage de la photo (OPTIONNELLE) d'une candidature — route ADMIN authentifiée.
// Fichier hors web-root (/var/data/cv) ; jamais d'URL publique. Inline (image),
// MIME restreint aux types validés à l'upload (anti rendu HTML).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readCv } from "@/server/careers/cv-storage";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { logActivity } from "@/server/content-gen/shared/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_IMG = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const role = (session.user as { role?: string }).role;
  // 🔴 La liste etait ecrite ICI, et elle admettait `editor` tout en refusant
  // `responsable_qualite` et `secretaire` — c'est-a-dire le role purement
  // redactionnel admis, et les deux roles qui TRAITENT le dossier refuses. Ce
  // n'etait pas un arbitrage : la liste a ete ecrite avant que ces deux roles
  // existent (15/08). Elle vit desormais au SSOT, partagee avec la liste des
  // candidatures et la piece jointe.
  if (!peutOuvrirDossierCandidat(role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const a = await prisma.jobApplication.findUnique({
    where: { id },
    select: { photoStoragePath: true, photoMimeType: true },
  });
  if (!a?.photoStoragePath) return new NextResponse("Not found", { status: 404 });

  try {
    const buf = await readCv(a.photoStoragePath);
    // 🔑 Meme raison que pour le CV : la trace est ce qui rend l'acces
    // defendable. Best-effort — un journal indisponible ne prive personne de la
    // piece.
    await logActivity({
      session: {
        userId: session.user.id,
        email: session.user.email ?? "",
        role: role ?? "reader",
      },
      action: "careers.candidature.photo.consultee",
      targetType: "JobApplication",
      targetId: id,
    });
    // MIME restreint : on ne sert que des types image validés, sinon octet-stream.
    const mime =
      a.photoMimeType && ALLOWED_IMG.has(a.photoMimeType)
        ? a.photoMimeType
        : "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("File unavailable", { status: 404 });
  }
}
