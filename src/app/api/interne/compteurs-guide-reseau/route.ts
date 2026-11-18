/**
 * `POST /api/interne/compteurs-guide-reseau` — LECTURE : compteurs d'origines de demandes de guide, par mot,
 * par réseau et par jour (L5-27). Même interrupteur que la réception (`GUIDES_RESEAU_ENABLED`, vérifié EN
 * PREMIER), même secret que les routes d'oppositions (sans repli), SON seau de débit. Aucune écriture, des
 * nombres seulement : aucune adresse, aucun nom, aucun identifiant de personne. Contrat v1 : corps { v: 1 },
 * interrupteur éteint = 404, signature absente ou fausse = 401, pas de masquage des petits effectifs.
 */
import type { NextRequest } from "next/server";
import { controlerEntree } from "@/server/videos/entree";
import { refus } from "@/server/videos/reponse";
import { guidesReseauActifs, secretsOppositionsReseau } from "@/server/guides-reseau/config";
import {
  CORPS_MAX_COMPTEURS,
  PREFIXE_DEBIT_COMPTEURS,
  repondreCompteurs,
} from "@/server/guides-reseau/compteurs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHEMIN = "/api/interne/compteurs-guide-reseau";

export async function POST(req: NextRequest): Promise<Response> {
  // Interrupteur vérifié EN PREMIER : éteint = 404, rien n'est lu.
  if (!guidesReseauActifs()) return refus(404, "introuvable");
  if (req.nextUrl.search !== "") return refus(400, "chaine_de_requete_refusee");
  const entree = await controlerEntree(req, {
    methode: "POST",
    chemin: CHEMIN,
    drapeau: guidesReseauActifs,
    secrets: () => secretsOppositionsReseau(),
    prefixeDebit: PREFIXE_DEBIT_COMPTEURS,
    corpsMaxOctets: CORPS_MAX_COMPTEURS,
  });
  if (!entree.ok) {
    // Pas de signature utilisable (absente, mal formée) = pas de signature valide : 401, pas 400.
    const corps = (await entree.reponse
      .clone()
      .json()
      .catch(() => null)) as { erreur?: string } | null;
    return corps?.erreur === "entetes_invalides"
      ? refus(401, "signature_invalide")
      : entree.reponse;
  }
  return repondreCompteurs(entree);
}
