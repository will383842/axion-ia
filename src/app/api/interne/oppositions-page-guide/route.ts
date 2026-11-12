/**
 * `POST /api/interne/oppositions-page-guide` — le Studio signale qu'une personne qui avait reçu le lien de la
 * page « Recevoir le guide » a écrit « stop » APRÈS la page. Le Studio n'a pas son adresse : il envoie la
 * référence de conversation du lien (`conv`), jamais d'adresse.
 *
 * MÊME famille que `/api/interne/oppositions-reseau` : même interrupteur (`OPPOSITIONS_RESEAU_ENABLED`, qui ne
 * s'éteint jamais pendant que le Studio tourne), même secret (`GUIDES_RESEAU_HMAC_SECRET`, sans repli sur celui
 * des vidéos), HMAC + horodatage + nonce. SON seau de débit. Aucune suppression : mise à l'écart seulement.
 */
import type { NextRequest } from "next/server";
import { controlerEntree } from "@/server/videos/entree";
import { refus } from "@/server/videos/reponse";
import {
  CORPS_MAX_OPPOSITIONS,
  PREFIXE_DEBIT_OPPOSITIONS_PAGE,
  oppositionsReseauActives,
  secretsOppositionsReseau,
} from "@/server/guides-reseau/config";
import { recevoirOppositionPage } from "@/server/guides-reseau/opposition-page-guide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHEMIN = "/api/interne/oppositions-page-guide";

export async function POST(req: NextRequest): Promise<Response> {
  // Interrupteur vérifié EN PREMIER : éteint = rien n'est lu ni écrit.
  if (!oppositionsReseauActives()) return refus(503, "reception_eteinte");
  const entree = await controlerEntree(req, {
    methode: "POST",
    chemin: CHEMIN,
    drapeau: oppositionsReseauActives,
    secrets: () => secretsOppositionsReseau(),
    prefixeDebit: PREFIXE_DEBIT_OPPOSITIONS_PAGE,
    corpsMaxOctets: CORPS_MAX_OPPOSITIONS,
  });
  if (!entree.ok) return entree.reponse;
  return recevoirOppositionPage(entree);
}
