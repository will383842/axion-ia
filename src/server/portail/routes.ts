/**
 * Portail stagiaire — constantes et motifs de routes (audit certif X3, 2026-07-26).
 *
 * Module PUR, Edge-safe : il est importé par `src/proxy.ts`, qui tourne en Edge
 * runtime. AUCUN import Node ici — ni `next/headers`, ni Prisma, ni rien qui en
 * dépende — sinon le build de la proxy casse.
 *
 * ⚠️ EMPLACEMENT VOLONTAIRE. Ce fichier est sous `src/server/portail/` et NON sous
 * `src/server/qualiopi/portail/`, alors même que le reste du portail y vit. Raison :
 * `scripts/qualiopi/isolation-check.ts` interdit aux fichiers hors zone qualiopi de
 * référencer les symboles du domaine. En plaçant le module ici, la proxy l'importe
 * sans faire apparaître le moindre marqueur — le cloisonnement reste vérifié sur
 * `src/proxy.ts`, au lieu d'être désactivé par une exception. C'est aussi
 * exactement l'emplacement de ses deux frères, `src/server/formateur/routes.ts` et
 * `src/server/ressources/routes.ts`, qui jouent le même rôle pour les deux autres
 * espaces privés.
 */

/**
 * Nom du cookie de session portail stagiaire.
 *
 * Déclaré ICI et non dans `server/qualiopi/portail/cookie.ts` : ce dernier importe
 * `next/headers`, donc l'importer depuis la proxy tirerait du code Node dans le
 * bundle Edge. `cookie.ts` consomme cette constante — il n'existe qu'une chaîne.
 *
 * ⚠️ Le jeton stocké dans ce cookie est OPAQUE : il est validé par une lecture en
 * base, PAS par une signature HMAC comme le cookie formateur. Conséquence directe
 * sur la garde Edge : elle ne peut vérifier que la PRÉSENCE du cookie, jamais sa
 * validité. Le cas « présent mais périmé » reste traité dans la page.
 */
export const PORTAIL_COOKIE_NAME = "portail_session";

/**
 * Chemins du portail qui exigent une session.
 *
 * `mon-espace` UNIQUEMENT — c'est un arbitrage, pas un oubli :
 *  - `demander-acces` et `acces-invalide` sont publics par nature : c'est là qu'on
 *    redirige, les inclure ferait une boucle ;
 *  - `acces/[token]` est la route qui POSE le cookie : exiger le cookie qu'elle est
 *    en train de délivrer rendrait toute connexion impossible ;
 *  - `emarger/[token]` s'authentifie par un jeton dans le CHEMIN, envoyé par e-mail
 *    à un stagiaire qui n'a jamais ouvert le portail et n'a donc AUCUN cookie.
 *    L'inclure casserait l'émargement en entier — et l'émargement est une pièce
 *    probante Qualiopi (indicateurs 9 et 11).
 *
 * Le sous-arbre `(?:\/.*)?` est prévisionnel : `mon-espace` n'a pas d'enfant
 * aujourd'hui, mais une future sous-page hériterait de la garde sans qu'on y pense.
 */
const CHEMIN_PROTEGE = /^\/(fr|en)\/portail\/mon-espace(?:\/.*)?$/;

/**
 * Retourne la locale si le chemin exige une session portail, sinon `null`.
 *
 * Exposé plutôt qu'écrit en regex inline dans la proxy pour UNE raison : la proxy
 * elle-même n'est pas montable en Vitest (NextAuth, next-intl, Edge). Sortir la
 * décision ici est ce qui rend le périmètre de la garde testable — cf. `routes.spec.ts`.
 */
export function localeSiPortailProtege(pathname: string): string | null {
  return CHEMIN_PROTEGE.exec(pathname)?.[1] ?? null;
}
