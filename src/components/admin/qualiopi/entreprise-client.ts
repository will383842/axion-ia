/**
 * F1 — l'entreprise d'un stagiaire DÉRIVE d'un client, elle ne se retape pas.
 *
 * ## Le défaut fermé
 *
 * `clients/new` crée « SCI Invest Sun » (raison sociale, structurée, portée par
 * une ligne `clients`). `stagiaires/new` redemandait ensuite « Entreprise » en
 * **texte libre**, sans le moindre lien avec le client qui venait d'être créé.
 *
 * Deux saisies libres du même fait divergent toujours : « SCI invest sun »,
 * « Invest Sun » et « SCI INVEST SUN » sont trois entreprises différentes aux
 * yeux d'un lecteur — et d'un auditeur. Personne ne voit l'erreur, parce
 * qu'aucun écran ne rapproche les deux saisies. Et c'est la CONVENTION qui
 * porte l'écart : elle nomme le client d'un côté, le stagiaire de l'autre.
 *
 * ## Ce que ce module décide, et pourquoi il est à part
 *
 * Module SANS "use client", sans JSX et **sans aucun import de Server Action** :
 * `TraineeForm` importe `createTraineeAction`, qui tire `next-auth` et toute la
 * pile serveur. Un test qui importerait le composant pour éprouver ces deux
 * fonctions pures échouerait au CHARGEMENT du module, avant le moindre `it` —
 * et il échouerait en annonçant « no tests », ce qui se lit comme « rien à
 * signaler ». Même raison d'être que `lieu-values.ts` et `montant-euros.ts`.
 *
 * ⚠️ La colonne `trainees.entreprise` reste une CHAÎNE, et ce module ne la
 * change pas. Rattacher le stagiaire au client par une clé étrangère serait la
 * bonne structure, mais c'est une migration : ici on se contente de garantir
 * que la chaîne écrite est **exactement** la raison sociale d'un client
 * existant, ou une valeur assumée comme hors registre.
 */

/**
 * Valeur de l'option « autre entreprise » du sélecteur.
 *
 * Une chaîne impossible en raison sociale : c'est la porte de sortie pour un
 * stagiaire dont l'employeur n'est pas (encore) un client — refuser ce cas
 * bloquerait l'inscription d'un particulier ou d'un salarié d'une entreprise
 * tierce, et pousserait à créer un faux client pour contourner l'écran.
 */
export const OPTION_ENTREPRISE_LIBRE = "__saisie_libre__";

/** Valeur de l'option « aucune entreprise ». */
export const OPTION_ENTREPRISE_AUCUNE = "";

/**
 * Forme comparable d'une raison sociale : sans casse, sans accent, espaces
 * réduits.
 *
 * Sert UNIQUEMENT à reconnaître qu'une valeur déjà en base désigne un client
 * existant, pour pré-sélectionner ce client au lieu d'ouvrir la saisie libre.
 * Ce n'est pas une clé : deux entreprises réellement distinctes peuvent se
 * normaliser pareil, et c'est sans conséquence ici — le pire cas est une
 * pré-sélection que l'utilisateur corrige d'un clic.
 */
export function normaliserRaisonSociale(valeur: string): string {
  return (
    valeur
      .normalize("NFD")
      // Marques diacritiques combinantes (U+0300-U+036F), notees en \u : le
      // fichier reste lisible quel que soit l'encodage de l'editeur.
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}

/**
 * Quelle option du sélecteur ouvrir au chargement du formulaire ?
 *
 * - rien en base → « aucune entreprise » ;
 * - une valeur qui DÉSIGNE un client existant (à la casse et aux accents près)
 *   → ce client, pour que l'enregistrement suivant recolle la forme canonique
 *   et fasse converger les variantes déjà écrites ;
 * - une valeur qui ne désigne personne → saisie libre, pré-remplie. On ne
 *   l'efface JAMAIS : une entreprise saisie hors registre est une information,
 *   pas une faute, et la perdre en ouvrant la fiche serait pire que l'écart
 *   qu'on corrige.
 */
export function optionInitialeEntreprise(
  entreprise: string | null | undefined,
  raisonsSociales: readonly string[],
): string {
  const brut = (entreprise ?? "").trim();
  if (brut === "") return OPTION_ENTREPRISE_AUCUNE;
  const cible = normaliserRaisonSociale(brut);
  const trouve = raisonsSociales.find((r) => normaliserRaisonSociale(r) === cible);
  return trouve ?? OPTION_ENTREPRISE_LIBRE;
}

/**
 * La valeur RÉELLEMENT envoyée à l'action, depuis l'état du sélecteur.
 *
 * Une option de client rend sa raison sociale TELLE QU'ELLE EST EN BASE — c'est
 * tout l'intérêt : la chaîne du stagiaire devient une copie exacte de celle du
 * client, jamais une deuxième frappe.
 */
export function entrepriseRetenue(option: string, saisieLibre: string): string {
  if (option === OPTION_ENTREPRISE_AUCUNE) return "";
  if (option === OPTION_ENTREPRISE_LIBRE) return saisieLibre.trim();
  return option;
}
