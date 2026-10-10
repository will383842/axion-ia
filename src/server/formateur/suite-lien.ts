/**
 * Paramètre `suite` du lien magique de l'espace formateur (lot S6a, h).
 *
 * Le courriel qui invite un formateur à signer doit le déposer sur la page
 * de la pièce, pas sur le tableau de bord. D'où un paramètre `suite` porté
 * par le lien de connexion.
 *
 * 🔴 Un paramètre de redirection est le cas d'école de la REDIRECTION
 * OUVERTE : un lien légitime de notre domaine qui renvoie, après connexion,
 * vers un site tiers imitant le nôtre. La parade n'est pas de filtrer ce qui
 * est dangereux — on oublie toujours un encodage — mais de n'admettre QUE des
 * chemins de l'espace, connus d'avance, par une expression ANCRÉE des deux
 * côtés. Tout le reste retombe sur le tableau de bord, sans erreur.
 *
 * Module pur (aucune dépendance Node) : utilisable côté route comme côté
 * construction du courriel.
 */

import { FORMATEUR_BASE_PATH } from "./routes";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Les SEULS chemins admis. Ajouter une section est une décision : chaque
 * entrée est un chemin interne, littéral ou suivi d'un identifiant.
 */
const LISTE_BLANCHE: ReadonlyArray<RegExp> = [
  new RegExp(`^${FORMATEUR_BASE_PATH}$`),
  new RegExp(`^${FORMATEUR_BASE_PATH}/(remuneration|sessions|seances)$`),
  new RegExp(`^${FORMATEUR_BASE_PATH}/(sessions|seances)/${UUID}$`),
];

/** `true` si `suite` est un chemin de l'espace admis tel quel. */
export function suiteAdmise(suite: string | null | undefined): suite is string {
  if (typeof suite !== "string" || suite.length === 0 || suite.length > 200) return false;
  return LISTE_BLANCHE.some((re) => re.test(suite));
}

/** Destination après connexion : `suite` si admise, sinon le tableau de bord. */
export function destinationApresConnexion(suite: string | null | undefined): string {
  return suiteAdmise(suite) ? suite : FORMATEUR_BASE_PATH;
}
