/**
 * Quelle partie relancer par e-mail sur une pièce en attente de signature.
 *
 * Alimente le bouton « Relancer par e-mail » de la page À traiter, qui réutilise
 * `envoyerLienSignatureParEmailAction` telle quelle. Ce module ne décide donc
 * pas qui PEUT signer — c'est le SSOT des circuits (`parties-requises.ts`) —
 * mais qui est JOIGNABLE par ce chemin-là, maintenant.
 *
 * ## Deux contraintes, aucune des deux négociable ici
 *
 * 1. **Le circuit.** `emettreLienSignatureAction` refuse toute partie hors
 *    circuit (« la convention n'appelle pas de signature de cette partie »).
 *    La partie à relancer est donc TOUJOURS la prochaine du circuit, dans
 *    l'ordre de signature — jamais une partie déduite du type « de tête ».
 *    C'est ce qui donne `beneficiaire` (et non `client`) pour le contrat de
 *    formation : un contrat L.6353-3 se conclut avec un PARTICULIER.
 *
 * 2. **Le canal.** `resoudreIdentite` ne sait émettre un lien PUBLIC que pour
 *    `client`, `beneficiaire`, `sous_traitant` et `financeur`. Les parties
 *    internes signent authentifiées : `axionia` contresigne depuis la console
 *    (c'est Will, pas un e-mail), `formateur` et `responsable_pedagogique`
 *    depuis l'espace formateur. Proposer « Relancer par e-mail » sur une
 *    lettre de mission afficherait un bouton qui échoue à CHAQUE clic avec
 *    « cette partie signe depuis un espace authentifié ». Le mapping rend
 *    `null` : pas de bouton vaut mieux qu'un bouton menteur.
 *
 * Conséquence : `protocole_afest` en `en_attente` n'a pas de bouton (l'organisme
 * signe EN PREMIER), mais en retrouve un dès que la signature de l'organisme est
 * posée — la prochaine partie devient le client, puis le bénéficiaire.
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import type { PartieSignataire } from "./document-signature-hash";
import { circuitPour } from "./parties-requises";

/**
 * Parties pour lesquelles `resoudreIdentite` sait émettre un lien public et
 * envoyer l'e-mail. ⚠️ Miroir volontairement RESTRICTIF de
 * `piece-lien-signature.ts` : en ajouter une ici sans que l'action la résolve
 * ferait réapparaître le bouton qui échoue au clic.
 */
const PARTIES_JOIGNABLES_PAR_EMAIL: ReadonlySet<PartieSignataire> = new Set([
  "client",
  "beneficiaire",
  "sous_traitant",
  "financeur",
] satisfies PartieSignataire[]);

/**
 * Partie à relancer par e-mail, ou `null` si aucune relance e-mail n'a de sens.
 *
 * @param documentType    Valeur de l'enum `DocumentType` de la pièce.
 * @param statutSignature Valeur de `DocumentGenere.statutSignature`.
 * @param partiesSignees  Parties dont une signature NON RÉVOQUÉE existe
 *                        (`DocumentSignature.partie` où `revokedAt IS NULL`).
 *                        Vide pour `en_attente` par définition.
 */
export function partieARelancer(
  documentType: string,
  statutSignature: string,
  partiesSignees: readonly string[] = [],
): PartieSignataire | null {
  // `signee` n'a personne à relancer ; `refusee`/`expiree`/`non_requise` ne se
  // règlent pas par un e-mail de relance.
  if (statutSignature !== "en_attente" && statutSignature !== "partielle") return null;

  const circuit = circuitPour(documentType);
  if (circuit === null) return null;

  // Prochaine partie DANS L'ORDRE du circuit — l'ordre est contractuel
  // (l'organisme conclut en dernier), pas décoratif.
  const signees = new Set(partiesSignees);
  const prochaine = circuit.parties.find((p) => !signees.has(p));
  if (prochaine === undefined) return null;

  return PARTIES_JOIGNABLES_PAR_EMAIL.has(prochaine) ? prochaine : null;
}
