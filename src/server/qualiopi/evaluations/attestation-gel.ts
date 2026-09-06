/**
 * Qualiopi — Une attestation GELÉE, et la seule condition pour la relâcher.
 *
 * Module PUR : aucun I/O, aucun Prisma. C'est ce qui le rend éprouvable — le
 * script de reprise (`scripts/qualiopi/attestations-gelees.ts`) ouvre la base,
 * et un témoin qui l'importerait tirerait toute la pile serveur.
 *
 * ## Ce qu'est un gel
 *
 * `attestationGenereeAt` est renseignée, et `attestationDocumentId` est nulle :
 * la ligne se déclare « attestée » sans qu'aucune pièce existe. Le cron
 * `attestations-auto` sélectionne sur `attestationGenereeAt: null` — il ne la
 * reprendra donc **jamais**, et l'attestation de fin de formation est **due au
 * stagiaire** par l'article L.6353-1.
 *
 * Deux chemins y menaient, tous deux fermés depuis le 2026-09-05 :
 * le claim atomique posé avant le rendu du PDF, et surtout la branche
 * « aucune » — `tauxPresencePct ?? 0` transformait un taux INCONNU en présence
 * de 0 %, et la ligne sortait sans pièce, verrouillée.
 *
 * ## Pourquoi relâcher n'est pas toujours la bonne réponse
 *
 * ⚠️ Relâcher une ligne que le cron ne pourra pas traiter remplace un gel
 * silencieux par une boucle d'échecs — c'est-à-dire un défaut plus bruyant, pas
 * un défaut réparé. La condition ci-dessous reprend donc EXACTEMENT les gardes
 * du service : taux mesuré (refus dur) ET au moins une trace d'assiduité.
 *
 * Les lignes non relâchables ne sont pas perdues : elles demandent une SAISIE DE
 * PRÉSENCE, geste humain, et le script les liste à part pour qu'on ne les
 * confonde pas avec « rien à faire ».
 */

/** L'état d'une inscription, du point de vue du gel. */
export interface EtatGelAttestation {
  /** `attestationGenereeAt` est-elle renseignée ? */
  readonly marqueeAttestee: boolean;
  /** Une pièce existe-t-elle réellement ? */
  readonly documentPresent: boolean;
  /** `null` = jamais calculé. Un taux INCONNU n'est pas un taux de 0 %. */
  readonly tauxPresencePct: number | null;
  /** Signatures d'émargement non révoquées. */
  readonly signaturesNonRevoquees: number;
  /** Créneaux issus d'un relevé de connexion importé, rattachés à leur fichier. */
  readonly creneauxImportes: number;
}

/**
 * La ligne est-elle GELÉE ? « Attestée » sans pièce, et rien d'autre.
 *
 * ⚠️ Ne dépend d'AUCUNE date : le gel n'a pas de fenêtre, et un critère daté
 * laisserait dehors précisément les plus anciens — ceux qui attendent depuis le
 * plus longtemps.
 */
export function estGelee(e: EtatGelAttestation): boolean {
  return e.marqueeAttestee && !e.documentPresent;
}

/**
 * Peut-on RELÂCHER le verrou, c'est-à-dire rendre la ligne au cron ?
 *
 * Reprend les gardes du service, et pas une version affaiblie : sans taux
 * mesuré, le cron lèvera `AttestationTauxNonMesureError` ; sans trace, il
 * refusera faute de preuves. Relâcher dans ces cas produirait un échec à chaque
 * passage.
 */
export function peutRelacher(e: EtatGelAttestation): boolean {
  if (!estGelee(e)) return false;
  if (e.tauxPresencePct === null) return false;
  return e.signaturesNonRevoquees > 0 || e.creneauxImportes > 0;
}

/** Pourquoi une ligne gelée ne peut pas être relâchée — phrase pour l'écran. */
export function motifNonRelachable(e: EtatGelAttestation): string | null {
  if (!estGelee(e)) return null;
  if (peutRelacher(e)) return null;
  if (e.tauxPresencePct === null) {
    return "taux de présence NON MESURÉ — saisir la présence avant de relâcher";
  }
  return "aucune trace d'assiduité — ni signature au registre, ni relevé importé";
}
