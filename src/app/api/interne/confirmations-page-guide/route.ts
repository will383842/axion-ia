/**
 * `POST /api/interne/confirmations-page-guide` — le Studio RÉSERVE la liste des « merci » à envoyer
 * après validation de la page « Recevoir le guide » (lot S4a). ÉTEINT par défaut
 * (`CONFIRMATIONS_PAGE_GUIDE_ENABLED`).
 *
 * Signée comme `/api/interne/demandes-guide-reseau` (HMAC + horodatage + nonce) avec SON
 * interrupteur, SON secret (`GUIDES_RESEAU_HMAC_SECRET`, sans repli sur celui des vidéos) et SON
 * seau de débit. POST seulement (aucun GET : Next répond 405) ; toute chaîne de requête est refusée
 * (la signature ne couvre que le chemin).
 */
import type { NextRequest } from "next/server";
import { controlerEntree } from "@/server/videos/entree";
import { refus } from "@/server/videos/reponse";
import {
  CORPS_MAX_CONFIRMATIONS,
  PREFIXE_DEBIT_CONFIRMATIONS,
  confirmationsPageGuideActives,
  secretsConfirmationsPageGuide,
} from "@/server/guides-reseau/config";
import { recevoirDemandeConfirmations } from "@/server/guides-reseau/confirmations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHEMIN = "/api/interne/confirmations-page-guide";

export async function POST(req: NextRequest): Promise<Response> {
  // Interrupteur vérifié EN PREMIER : éteint = rien n'est lu ni écrit.
  if (!confirmationsPageGuideActives()) return refus(503, "reception_eteinte");
  if (req.nextUrl.search !== "") return refus(400, "chaine_de_requete_refusee");
  const entree = await controlerEntree(req, {
    methode: "POST",
    chemin: CHEMIN,
    drapeau: confirmationsPageGuideActives,
    secrets: () => secretsConfirmationsPageGuide(),
    prefixeDebit: PREFIXE_DEBIT_CONFIRMATIONS,
    corpsMaxOctets: CORPS_MAX_CONFIRMATIONS,
  });
  if (!entree.ok) return entree.reponse;
  return recevoirDemandeConfirmations(entree);
}
