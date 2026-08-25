// Download du CV d'une candidature — route ADMIN authentifiée uniquement.
// Le fichier est hors web-root (/var/data/cv) ; jamais d'URL publique.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readCv } from "@/server/careers/cv-storage";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { getClientIp } from "@/lib/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  // candidatures et la photo.
  if (!peutOuvrirDossierCandidat(role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const a = await prisma.jobApplication.findUnique({
    where: { id },
    select: { cvStoragePath: true, cvOriginalName: true, cvMimeType: true },
  });
  if (!a?.cvStoragePath) return new NextResponse("Not found", { status: 404 });

  try {
    const buf = await readCv(a.cvStoragePath);
    const safeName = (a.cvOriginalName || "cv").replace(/[^a-zA-Z0-9._-]/g, "_");
    // 🔑 La TRACE, pas la liste de rôles, est ce qui rend cet accès défendable
    // devant la CNIL. Aucun accès au CV d'un candidat n'était journalisé :
    // personne ne savait qui avait téléchargé quel dossier.
    //
    // ⚠️ Écrit DIRECTEMENT sur `prisma.activityLog`, et non via le helper
    // partagé du générateur éditorial : ce module vit dans une zone dont
    // l'isolation est vérifiée en CI (§ 4.1bis), et rien du dossier d'un
    // candidat n'y appartient. L'écriture directe est d'ailleurs l'idiome réel
    // du dépôt partout ailleurs — `admin-blog`, `admin-faq`, `gdpr-erase`,
    // `auth.ts`.
    //
    // Best-effort : un journal indisponible ne doit pas priver le recruteur de
    // la pièce.
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: session.user.id,
          action: "careers.candidature.cv.telecharge",
          targetType: "JobApplication",
          targetId: id,
          ipAddress: await getClientIp(),
        },
      });
    } catch {
      // silence volontaire : cf. ci-dessus
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        // Type forcé neutre + nosniff : on ne fait pas confiance au MIME déclaré
        // par le client à l'upload (anti rendu HTML/inline).
        "Content-Type": "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("File unavailable", { status: 404 });
  }
}
