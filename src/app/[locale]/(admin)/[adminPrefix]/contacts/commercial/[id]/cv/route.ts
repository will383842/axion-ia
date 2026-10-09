// Téléchargement du CV d'un candidat APPORTEUR — route admin authentifiée.
//
// Jumelle de `contacts/candidatures/[id]/cv` (candidatures à une offre), mais
// le CV d'un apporteur vit dans `Submission.details.cv.fichier` (2026-09-28 :
// CV reçus par l'annonce Indeed). Même volume hors web-root (/var/data/cv),
// mêmes rôles, même trace d'accès, jamais d'URL publique.

import { entetesCv } from "@/lib/careers/cv-en-ligne";
import { resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCvStorageBasePath, readCv } from "@/server/careers/cv-storage";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { getClientIp } from "@/lib/client-ip";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { lireCvCandidat } from "@/lib/commercial-application/cv-candidat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!peutOuvrirDossierCandidat(role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const s = await prisma.submission.findUnique({ where: { id }, select: { details: true } });
  if (!s || !estApporteur(s.details)) return new NextResponse("Not found", { status: 404 });
  const fichier = lireCvCandidat(s.details)?.fichier;
  if (!fichier) return new NextResponse("Not found", { status: 404 });

  // 🔴 Le chemin vient d'un JSON éditable, pas d'une colonne typée : on refuse
  //    tout ce qui sortirait du volume des CV (`..`, chemin absolu ailleurs).
  const base = resolve(getCvStorageBasePath());
  const chemin = resolve(fichier.storagePath);
  if (!chemin.startsWith(base + sep)) return new NextResponse("Not found", { status: 404 });

  try {
    const buf = await readCv(chemin);
    const safeName = fichier.nomOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
    // Trace d'ACCÈS — best-effort, comme la route des candidatures.
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: session.user.id,
          action: "apporteur.cv.telecharge",
          targetType: "Submission",
          targetId: id,
          ipAddress: await getClientIp(),
        },
      });
    } catch {
      // silence volontaire : un journal indisponible ne prive pas de la pièce
    }
    // L8d — « Lire ici » (`?lire=1`) : un VRAI PDF s'ouvre dans le navigateur,
    // tout autre fichier reste un téléchargement neutre (`cv-en-ligne.ts`).
    const octets = new Uint8Array(buf);
    const lire = new URL(req.url).searchParams.get("lire") === "1";
    return new NextResponse(octets, { headers: entetesCv(safeName, lire, octets) });
  } catch {
    return new NextResponse("File unavailable", { status: 404 });
  }
}
