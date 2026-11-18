/**
 * Garde commune des routes du site d'audit (notes, pièces).
 * Ordre : session → rôle super_admin → client → liste blanche → (écriture)
 * contrôles d'origine et en-tête `x-site-audit`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { AccesRefuse, exigerAccesEchanges } from "@/features/dossier-client/acces";
import { SANS_CACHE, siteAuditDuClient } from "./config";

const uuid = z.string().uuid();

export function refus(statut: number, texte: string): NextResponse {
  return new NextResponse(texte, { status: statut, headers: SANS_CACHE });
}

function origineAcceptee(req: NextRequest): boolean {
  if (req.headers.get("sec-fetch-site") !== "same-origin") return false;
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") {
    try {
      const h = (req.headers.get("host") ?? "").toLowerCase();
      if (h === "" || new URL(origin).host.toLowerCase() !== h) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export async function gardeSiteAudit(
  req: NextRequest,
  clientId: string,
  opts: { ecriture: boolean },
): Promise<{ userId: string; projetId: string; clientId: string } | NextResponse> {
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
  if (!uuid.safeParse(clientId).success) return refus(404, "Introuvable.");
  const cfg = siteAuditDuClient(clientId);
  if (cfg === null) return refus(404, "Introuvable.");
  if (opts.ecriture) {
    if (!origineAcceptee(req)) return refus(403, "Accès refusé.");
    if (req.headers.get("x-site-audit") !== "1") return refus(403, "Accès refusé.");
  }
  return { userId, projetId: cfg.projetId, clientId: clientId.toLowerCase() };
}
