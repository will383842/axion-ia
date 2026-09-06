/**
 * Qualiopi — Les DEUX refus d'attestation, et ce qui les distingue.
 *
 * Module PUR : aucun I/O, aucun import de Prisma, aucun `server-only`. C'est ce
 * qui permet à la CONSOLE de l'importer — les composants client ne peuvent pas
 * tirer `attestation-service.ts`, qui ouvre la base.
 *
 * ## Le défaut que ce module ferme AVANT qu'il arrive
 *
 * L'écran doit savoir, en lisant le refus, s'il doit proposer un champ de motif
 * ou non. Les deux refus n'ont pas la même issue :
 *
 * | Refus | Ce que l'écran doit faire |
 * |---|---|
 * | preuves manquantes (trace, évaluation) | proposer d'écrire POURQUOI, et réémettre |
 * | taux non mesuré | **ne rien proposer** — renvoyer à la saisie de la présence |
 *
 * La manière évidente serait de tester le texte du message dans le composant.
 * C'est exactement la faute qui a rendu `outbox-policy.spec.ts` rouge pendant
 * vingt-quatre heures sans que personne le voie : **une chaîne recopiée d'un
 * fichier à l'autre finit toujours par diverger**, et la divergence ne se
 * signale pas — l'écran cesse simplement de reconnaître le refus, et le champ
 * de motif n'apparaît plus jamais.
 *
 * Le message est donc CONSTRUIT ici, et le prédicat qui le reconnaît vit ICI
 * AUSSI, à côté de sa source. Le service et la console importent le même
 * module : ils ne peuvent pas diverger, parce qu'il n'y a rien à recopier.
 *
 * ⚠️ Proposer un champ de motif sur un refus que le motif ne lève pas serait
 * pire qu'un cul-de-sac : un motif qu'on saisit sans effet fait croire qu'on a
 * agi. D'où deux refus distincts, et non un seul avec un drapeau.
 */

/** Longueur minimale du motif. Alignée sur `MOTIF_RECTIFICATION_MIN`. */
export const MOTIF_PREUVES_MIN = 10;

/**
 * La phrase qui SIGNE un refus rattrapable par un motif.
 *
 * ⚠️ C'est le seul point d'accord entre le service et l'écran. La changer sans
 * changer les deux est impossible : elle n'est écrite qu'ici, et
 * `refus-attestation.spec.ts` exige que le message construit la contienne et
 * que celui du taux ne la contienne PAS.
 */
export const MARQUEUR_REFUS_RATTRAPABLE = "en écrivant pourquoi";

/** Refus RATTRAPABLE : la pièce peut sortir si un humain écrit pourquoi. */
export function messageRefusPreuvesManquantes(manquantes: ReadonlyArray<string>): string {
  return (
    "Attestation refusée — " +
    manquantes.join(" ; ") +
    ". L'attestation de fin de formation est due au stagiaire (L.6353-1) : " +
    "elle peut être émise malgré ces manques, mais seulement " +
    `${MARQUEUR_REFUS_RATTRAPABLE} (${MOTIF_PREUVES_MIN} caractères minimum). ` +
    "Ce motif est porté au registre et lu par l'auditeur."
  );
}

/**
 * Refus DUR : aucune mesure d'assiduité, donc rien à attester.
 *
 * ⚠️ Ne contient PAS `MARQUEUR_REFUS_RATTRAPABLE`, et c'est tout l'intérêt : il
 * dit quoi faire (renseigner la présence) sans laisser croire qu'un motif y
 * suppléerait. Un refus qui ne dit pas comment continuer est un cul-de-sac ;
 * un refus qui propose une sortie inopérante est un piège.
 */
export const MESSAGE_REFUS_TAUX_NON_MESURE =
  "Attestation refusée : le taux de présence n'a pas été calculé. Un taux " +
  "inconnu n'est pas un taux de 0 % — sans aucune mesure d'assiduité, il n'y a " +
  "rien à attester, et aucun motif ne peut y suppléer. Renseignez la présence " +
  "(grille d'émargement, ou import du relevé de connexion pour une session à " +
  "distance), puis relancez la génération.";

/**
 * Ce refus se lève-t-il en ÉCRIVANT un motif ?
 *
 * Appelé par la console sur le message d'erreur rendu par la Server Action, qui
 * ne transporte qu'une chaîne. `true` ⇒ révéler le champ de motif.
 */
export function refusEstRattrapableParMotif(message: string): boolean {
  return message.includes(MARQUEUR_REFUS_RATTRAPABLE);
}
