// API /api/vivier-opposition — opposition à la conservation en vivier.
//
// UN CLIC, SANS LOGIN, depuis l'email d'information (lot L4, plan §2.3). Le
// jeton HMAC signé porte l'identifiant de la candidature ; il n'y a donc ni
// formulaire, ni mot de passe, ni compte à créer. C'est le motif du lien de
// désinscription de la lettre d'information (`/api/unsubscribe`), appliqué à
// l'univers vivier — deux oppositions DISTINCTES, jamais confondues.
//
// GET uniquement : c'est un lien cliqué dans un client mail.
//
// ⚠️ Le pré-chargement de liens par certains clients mail (Gmail, Outlook)
// peut déclencher ce GET sans action humaine. C'est acceptable ICI, et
// seulement ici, parce que l'effet est protecteur de la personne (retirer sa
// candidature d'un vivier) et réversible par une nouvelle candidature. Le
// même raisonnement ne vaudrait PAS pour une suppression de compte.
//
// 303 vers /fr/vivier-opposition?status=… (page de confirmation sobre).

import { NextResponse, type NextRequest } from "next/server";

import { recordVivierOpposition } from "@/server/vivier/opposition";
import { verifyVivierOppositionToken } from "@/server/vivier/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(query: string): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/fr/vivier-opposition?${query}`,
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    { status: 303 },
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get("token");

  // 🔴 La vérification du jeton précède TOUTE écriture. Un jeton absent,
  // malformé, expiré, mal signé ou d'une autre finalité ne pose RIEN en base.
  const verified = await verifyVivierOppositionToken(token);
  if (!verified.ok) {
    return redirectTo(`status=fail&reason=${encodeURIComponent(verified.reason)}`);
  }

  const result = await recordVivierOpposition(verified.applicationId, {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
  });

  if (!result.ok) {
    return redirectTo(`status=fail&reason=${encodeURIComponent(result.reason)}`);
  }

  return redirectTo(`status=ok&already=${result.alreadyOpposed ? "1" : "0"}`);
}
