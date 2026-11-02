/**
 * `POST /api/interne/demandes-guide-reseau` — demande de guide venue d'un message privé
 * d'un réseau, transmise par le Studio (lot PV-1). ÉTEINT par défaut (`GUIDES_RESEAU_ENABLED`).
 *
 * Signée comme `/api/interne/videos` (K12 : HMAC + horodatage + nonce) : `controlerEntree`
 * est réutilisée avec SON drapeau, SON secret (repli documenté sur celui des vidéos) et
 * SON seau de débit. Jamais statique : le drapeau est lu au runtime.
 */
import type { NextRequest } from "next/server";
import { controlerEntree } from "@/server/videos/entree";
import { refus } from "@/server/videos/reponse";
import {
  PREFIXE_DEBIT_GUIDES,
  guidesReseauActifs,
  secretsGuidesReseau,
} from "@/server/guides-reseau/config";
import { recevoirDemande } from "@/server/guides-reseau/reception";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHEMIN = "/api/interne/demandes-guide-reseau";

export async function POST(req: NextRequest): Promise<Response> {
  // Interrupteur propre au parcours, vérifié EN PREMIER : éteint = rien n'est lu ni écrit.
  if (!guidesReseauActifs()) return refus(503, "reception_eteinte");
  const entree = await controlerEntree(req, {
    methode: "POST",
    chemin: CHEMIN,
    drapeau: guidesReseauActifs,
    secrets: () => secretsGuidesReseau(),
    prefixeDebit: PREFIXE_DEBIT_GUIDES,
  });
  if (!entree.ok) return entree.reponse;
  return recevoirDemande(entree);
}
