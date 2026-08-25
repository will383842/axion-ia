/**
 * Les lettres de mission d'UN formateur : lesquelles retenir, sous quel DOSSIER (PUR).
 *
 * Employé par les DEUX surfaces qui présentent ces mêmes pièces — l'accueil de
 * l'espace formateur et la fiche formateur de la console. Une seule règle, parce
 * que l'organisme doit contresigner exactement ce que le formateur a sous les
 * yeux : deux sélections parallèles finiraient par se contredire sur la même
 * pièce.
 *
 * ## Le défaut constaté
 *
 * L'accueil du formateur ne garde qu'UNE lettre par session — la plus récente
 * fait foi en cas de réémission. Mais il posait la clé du dossier AVANT de
 * vérifier que la lettre nommait bien le lecteur. Une session réémise au nom
 * d'un autre formateur — remplacement du principal, le remplacé restant
 * co-animateur, donc toujours membre de la session — consommait donc la clé :
 * la lettre du lecteur, plus ancienne, était ensuite écartée comme un doublon.
 *
 * Conséquence : le formateur ne voyait plus le mandat qu'il devait signer, donc
 * ne le signait pas, donc n'était pas payé — pendant que la console, dont la
 * lecture jumelle filtrait AVANT de dédupliquer, continuait de la compter en
 * attente de sa signature. Les deux écrans se contredisaient sur la même pièce,
 * ce que la lecture jumelle s'interdit explicitement.
 *
 * ## La règle
 *
 * ON FILTRE PAR MANDATAIRE, PUIS ON DÉDUPLIQUE PAR DOSSIER — jamais l'inverse.
 * Un dossier ne se referme que sur les pièces du lecteur : ce que porte un
 * dossier voisin, ou le dossier d'un autre client, ne peut pas masquer la sienne.
 *
 * C'est la même règle que celle posée le 2026-08-16 sur le portail stagiaire :
 * UN ESPACE S'ORGANISE PAR DOSSIER, PAS PAR TYPE DE PIÈCE — et le tri par
 * dossier n'a de sens qu'une fois le lecteur reconnu.
 *
 * Aucun accès DB, aucune horloge : entrée = pièces déjà lues, sortie = celles à
 * afficher. C'est ce qui rend la règle testable sans base, et ce qui empêche les
 * deux lectures (espace formateur, console) de diverger.
 */

/** Ce qu'il faut savoir d'une lettre pour décider si on la retient. */
export interface LettreCandidate {
  /**
   * Dossier de rattachement — une session, ou la période d'une lettre-cadre.
   * Construit par `dossierDeLaLettre`, jamais à la main.
   */
  readonly dossier: string;
  /**
   * Formateur que la lettre NOMME, tel que le générateur l'a imprimé.
   * `null` = personne d'identifiable : la pièce est à régénérer, pas à signer.
   */
  readonly mandataireId: string | null;
}

/** Les faits d'où se déduit le dossier d'une lettre. */
export interface AncrageLettre {
  /** Session mandatée, `null` pour une lettre-cadre. */
  readonly sessionId: string | null;
  /** Période de la lettre-cadre, `null` si absente ou illisible. */
  readonly clePeriodeCadre: string | null;
  /** Repli d'unicité : une lettre-cadre sans période reste seule dans son dossier. */
  readonly pieceId: string;
}

/**
 * Le dossier sous lequel une lettre se range.
 *
 * 🔴 Les deux familles de clés sont PRÉFIXÉES et ne peuvent donc pas se
 * confondre. Une période de lettre-cadre qui vaudrait par accident l'identifiant
 * d'une session ferait disparaître l'une des deux — un mandat effacé de l'écran
 * par une collision de chaînes, sans trace ni message.
 */
export function dossierDeLaLettre(ancrage: AncrageLettre): string {
  if (ancrage.sessionId !== null) return `session:${ancrage.sessionId}`;
  return `cadre:${ancrage.clePeriodeCadre ?? ancrage.pieceId}`;
}

/**
 * Les lettres à afficher à `trainerId` : les siennes, une par dossier.
 *
 * `candidates` est supposée triée de la plus RÉCENTE à la plus ancienne : c'est
 * la première rencontrée qui est retenue pour un dossier donné. Les précédentes
 * restent en base avec leurs signatures — une preuve ne disparaît pas parce
 * qu'une pièce a été réémise — mais les afficher côte à côte ferait signer la
 * périmée aussi souvent que la bonne.
 *
 * ⚠️ Ne mute pas l'entrée et ne la réordonne pas.
 */
export function retenirUneLettreParDossier<T extends LettreCandidate>(
  candidates: readonly T[],
  trainerId: string,
): T[] {
  const dossiersServis = new Set<string>();
  const retenues: T[] = [];

  for (const candidate of candidates) {
    // 🔴 LE MANDAT D'ABORD. Une lettre qui nomme quelqu'un d'autre — ou
    // personne d'identifiable, `null`, auquel cas elle est à régénérer et non à
    // signer — n'est pas un doublon de la mienne : elle n'entre pas dans mon
    // espace, donc elle ne consomme pas mon dossier.
    if (candidate.mandataireId !== trainerId) continue;

    if (dossiersServis.has(candidate.dossier)) continue;
    dossiersServis.add(candidate.dossier);
    retenues.push(candidate);
  }

  return retenues;
}
