// Ouverture d'une PIÈCE JOINTE depuis l'aperçu d'un e-mail — route ADMIN authentifiée.
//
// `GET /<locale>/<prefixe>/emails/piece-jointe/<référence>` sert, dans un nouvel onglet, le
// fichier exact que l'envoi joindra. La référence est SIGNÉE par le serveur au moment de
// l'aperçu (`pieces-jointes-apercu.ts`) : on ne peut pas demander une clé de stockage au choix.
// Le fichier est relu par `resoudrePiecesJointes`, la fonction même du worker.
//
// Ordre : garde console (préfixe, locale : 404) → session (401) → rôle (403) → référence (404)
// → SEULEMENT ALORS le stockage. `GET` seul, jamais de cache. N'envoie rien, ne marque rien.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CONSULTATION, ENREGISTREMENT, enTeteContentDisposition } from "@/lib/content-disposition";
import { getClientIp } from "@/lib/client-ip";
import { refuserSiHorsConsole } from "@/server/auth/garde-route-console";
import { peutConsulter } from "@/server/auth/habilitations";
import { resoudrePiecesJointes } from "@/server/email/pieces-jointes";
import { pieceDeLaReference } from "@/server/email/pieces-jointes-apercu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ce que le navigateur peut afficher sans risque dans l'onglet : PDF et images raster. */
const AFFICHABLE = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/i;

const EST_PDF = /^application\/pdf$/i;

function enTetes(contentType: string, nom: string): Record<string, string> {
  const affichable = AFFICHABLE.test(contentType);
  return {
    "Content-Type": affichable ? contentType : "application/octet-stream",
    // SSOT `lib/content-disposition` : consultation pour PDF/images, enregistrement sinon.
    "Content-Disposition": enTeteContentDisposition(
      affichable ? CONSULTATION : ENREGISTREMENT,
      nom,
    ),
    // `sandbox` empêche la visionneuse PDF de Chromium de se charger : on le garde pour les
    // images et les téléchargements, et on le retire pour le PDF (`nosniff`, `object-src 'none'`).
    "Content-Security-Policy": EST_PDF.test(contentType)
      ? "default-src 'none'; object-src 'none'"
      : "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex",
  };
}

const texte = (phrase: string, status: number): NextResponse =>
  new NextResponse(phrase, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string; adminPrefix: string; ref: string }> },
): Promise<NextResponse> {
  const horsConsole = await refuserSiHorsConsole(params);
  if (horsConsole) return horsConsole;

  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!peutConsulter(role)) return new NextResponse("Forbidden", { status: 403 });

  const { ref } = await params;
  const piece = pieceDeLaReference(ref);
  if (!piece) {
    return texte("Ce lien a expiré ou n'est pas valable : rouvrez l'aperçu de l'e-mail.", 404);
  }

  let fichier;
  try {
    [fichier] = (await resoudrePiecesJointes([piece], { silencieux: true })).pieces;
  } catch (e) {
    if (e instanceof Error && /trop lourdes/.test(e.message)) {
      return texte("Ce fichier est trop lourd pour être joint à l'envoi.", 413);
    }
    return texte("Ce fichier est introuvable.", 404);
  }
  if (!fichier) return texte("Ce fichier n'est pas joint à l'envoi : il est introuvable.", 404);

  // Trace d'accès, best-effort : aucune donnée de personne (ni nom de fichier, ni clé).
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "email.apercu_piece_jointe",
        targetType: "EmailApercu",
        targetId: null,
        changes: {},
        ipAddress: await getClientIp(),
      },
    });
  } catch {
    // un journal indisponible ne prive pas de la lecture
  }

  return new NextResponse(new Uint8Array(Buffer.from(fichier.content)), {
    status: 200,
    headers: enTetes(fichier.contentType ?? "application/pdf", fichier.filename),
  });
}
