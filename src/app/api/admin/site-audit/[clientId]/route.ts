/**
 * Site d'audit (maquette HTML) servi au super_admin seul.
 *
 * ⚠️ EXCEPTION à l'ADR 0063 (« un HTML déposé ne s'affiche jamais dans la
 * console »), bornée par quatre verrous :
 *   1. LISTE BLANCHE posée par Will : variable `SITE_AUDIT_DOCUMENTS`
 *      (triplet client/projet/document), aucun autre identifiant pris dans l'URL ;
 *   2. rôle `super_admin` uniquement (401 sans session, 403 sinon) ;
 *   3. CSP sans réseau (connect-src/form-action fermés), lecture par
 *      `telechargerDocument` (triplet, antivirus, journal) ;
 *   4. ARCHIVER le document = coupure immédiate (404).
 * Route sous `api/` : hors proxy (pas de CSP à nonce), 401 en texte, jamais de
 * redirection (ne pas livrer le préfixe secret de la console).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { AccesRefuse, exigerAccesEchanges } from "@/features/dossier-client/acces";
import { ENTETES_SITE_AUDIT } from "@/features/site-audit/config";
import { lireSiteAudit } from "@/features/site-audit/lire";
import { prisma } from "@/lib/prisma";
import { analyserOctets } from "@/server/careers/clamav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS_CACHE = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

function refus(statut: number, texte: string): NextResponse {
  return new NextResponse(texte, { status: statut, headers: SANS_CACHE });
}

const uuid = z.string().uuid();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  // Préchargement de <Link> : ni lecture ni journal.
  if (req.headers.has("rsc") || req.headers.has("next-router-prefetch")) {
    return new NextResponse(null, { status: 204 });
  }
  const acces = await exigerAccesEchanges().catch((e: unknown) => e);
  if (acces instanceof AccesRefuse) {
    return acces.message.startsWith("Session expirée")
      ? refus(401, "Session expirée : reconnectez-vous.")
      : refus(403, "Accès refusé.");
  }
  if (acces instanceof Error || acces === null || typeof acces !== "object") {
    return refus(403, "Accès refusé.");
  }
  const { userId, role } = acces as { userId: string; role: string };
  if (role !== "super_admin") return refus(403, "Accès refusé.");

  const { clientId } = await params;
  if (!uuid.safeParse(clientId).success) return refus(404, "Introuvable.");

  const r = await lireSiteAudit(prisma, { clientId, parAdminId: userId }, (o) =>
    analyserOctets(o, 30_000),
  );
  if (r === null || r.issue === "introuvable") return refus(404, "Introuvable.");
  if (r.issue === "infecte") {
    return refus(
      409,
      "L'antivirus a trouvé un risque dans ce fichier : il ne peut pas être servi.",
    );
  }
  if (r.issue === "antivirus_indisponible") {
    return refus(503, "La vérification antivirus est momentanément indisponible. Réessayez.");
  }
  return new NextResponse(r.octets as unknown as BodyInit, {
    status: 200,
    headers: { ...ENTETES_SITE_AUDIT, "Content-Length": String(r.octets.length) },
  });
}
