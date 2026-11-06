/**
 * `POST /api/interne/oppositions-reseau` — le Studio signale qu'une personne a écrit « stop »
 * en message privé d'un réseau. ÉTEINT par défaut (`OPPOSITIONS_RESEAU_ENABLED`).
 *
 * Signée comme `/api/interne/demandes-guide-reseau` (HMAC + horodatage + nonce) avec SON
 * interrupteur, SON secret (`GUIDES_RESEAU_HMAC_SECRET`, sans repli sur celui des vidéos) et
 * SON seau de débit. Aucune suppression : l'adresse est seulement mise à l'écart des envois.
 */
import type { NextRequest } from "next/server";
import { controlerEntree } from "@/server/videos/entree";
import { refus } from "@/server/videos/reponse";
import {
  CORPS_MAX_OPPOSITIONS,
  PREFIXE_DEBIT_OPPOSITIONS,
  oppositionsReseauActives,
  secretsOppositionsReseau,
} from "@/server/guides-reseau/config";
import { recevoirOpposition } from "@/server/guides-reseau/opposition-reseau";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHEMIN = "/api/interne/oppositions-reseau";

export async function POST(req: NextRequest): Promise<Response> {
  // Interrupteur vérifié EN PREMIER : éteint = rien n'est lu ni écrit.
  if (!oppositionsReseauActives()) return refus(503, "reception_eteinte");
  const entree = await controlerEntree(req, {
    methode: "POST",
    chemin: CHEMIN,
    drapeau: oppositionsReseauActives,
    secrets: () => secretsOppositionsReseau(),
    prefixeDebit: PREFIXE_DEBIT_OPPOSITIONS,
    corpsMaxOctets: CORPS_MAX_OPPOSITIONS,
  });
  if (!entree.ok) return entree.reponse;
  return recevoirOpposition(entree);
}
