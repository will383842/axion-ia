/**
 * 🔴 CHANTIER QNC, LOT L10 — CE QUE LE JOURNAL DIT D'UNE VEILLE (module PUR).
 *
 * Constat d'Acuria (NC10, ind. 23 ; NC11, ind. 25) : une veille faite par IA,
 * sans exploitation organisée. Cible : l'IA collecte et propose, une personne
 * DÉCIDE, et tout est tracé.
 *
 * Quand `qualiopi.veille.actif` vaut `actif`, la table `veilles` est en ajout
 * seul (trigger `veilles_ajout_seul`, socle L00) : une veille ne se modifie ni
 * ne se supprime plus. Trois gestes la remplacent, chacun écrit dans la MÊME
 * transaction que sa ligne `activity_logs` (`journaliser`, `exiger: true`) :
 *
 *   - DÉCIDER  : une nouvelle version porte la décision (`actionDecidee`) et son
 *     auteur réel (`creeParId`) ; l'ancienne est archivée ;
 *   - CORRIGER : une nouvelle version porte la correction, avec son motif ;
 *     type et date de l'information ne bougent jamais ; l'ancienne est archivée ;
 *   - ARCHIVER : la ligne reste, son archivage est inscrit au journal.
 *
 * ⚠️ « Besoin de schéma » : sans colonne `veilles.remplace_id` ni
 * `veilles.piece_modifiee` (aucune migration dans ce lot), le lien entre
 * versions, l'archivage et la pièce modifiée vivent dans le journal. Ce module
 * est le SEUL lecteur de cette convention.
 */

export const ACTION_JOURNAL_VEILLE = {
  creation: "qualiopi.veille.create",
  decision: "qualiopi.veille.decision",
  correction: "qualiopi.veille.correction",
  archivage: "qualiopi.veille.archivee",
} as const;

/** Les actions du journal qui portent le cycle de vie d'une veille. */
export const ACTIONS_CYCLE_VEILLE: ReadonlyArray<string> = [
  ACTION_JOURNAL_VEILLE.decision,
  ACTION_JOURNAL_VEILLE.correction,
  ACTION_JOURNAL_VEILLE.archivage,
];

export const TARGET_TYPE_VEILLE = "Veille" as const;

/** Une ligne `activity_logs` relue. */
export interface LigneJournalVeille {
  readonly action: string;
  readonly targetId: string | null;
  readonly adminUserId: string | null;
  readonly changes: unknown;
  readonly createdAt: Date;
}

export interface DecisionVeille {
  /** L'auteur RÉEL de la décision : une session d'administration, jamais le système. */
  readonly decideurId: string;
  readonly decision: string;
  readonly pieceModifiee: string;
  readonly decideLe: Date;
}

export interface ArchivageVeille {
  readonly motif: string;
  readonly remplaceePar: string | null;
  readonly parId: string | null;
  readonly le: Date;
}

export interface TraceVeille {
  /** Veille → décision humaine qui la porte (reprise telle quelle par une correction). */
  readonly decisions: ReadonlyMap<string, DecisionVeille>;
  /** Veille archivée → son archivage. */
  readonly archivees: ReadonlyMap<string, ArchivageVeille>;
  /** Nouvelle version → version qu'elle remplace. */
  readonly remplace: ReadonlyMap<string, string>;
}

function objet(x: unknown): Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
}

function texte(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

/**
 * Relit le journal d'une ou plusieurs veilles. L'ordre d'entrée est indifférent :
 * les lignes sont rejouées dans l'ordre de leur date.
 *
 * Une décision n'est retenue que si une personne l'a prise (`adminUserId`
 * renseigné) et qu'elle n'est pas vide : c'est tout l'objet du lot.
 */
export function lireTraceVeille(lignes: ReadonlyArray<LigneJournalVeille>): TraceVeille {
  const decisions = new Map<string, DecisionVeille>();
  const archivees = new Map<string, ArchivageVeille>();
  const remplace = new Map<string, string>();
  const ordonnees = [...lignes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const l of ordonnees) {
    if (l.targetId === null) continue;
    const c = objet(l.changes);
    if (l.action === ACTION_JOURNAL_VEILLE.archivage) {
      if (archivees.has(l.targetId)) continue; // le PREMIER archivage fait foi
      const par = texte(c["remplaceePar"]);
      archivees.set(l.targetId, {
        motif: texte(c["motif"]),
        remplaceePar: par === "" ? null : par,
        parId: l.adminUserId,
        le: l.createdAt,
      });
      continue;
    }
    const ancienne = texte(c["remplace"]);
    if (ancienne !== "") remplace.set(l.targetId, ancienne);

    if (l.action === ACTION_JOURNAL_VEILLE.decision) {
      const decision = texte(c["decision"]);
      if (l.adminUserId === null || decision === "") continue;
      decisions.set(l.targetId, {
        decideurId: l.adminUserId,
        decision,
        pieceModifiee: texte(c["pieceModifiee"]),
        decideLe: l.createdAt,
      });
    } else if (l.action === ACTION_JOURNAL_VEILLE.correction) {
      // Une correction ne refait pas la décision : elle la reprend, avec son
      // auteur et sa date d'origine.
      const reprise = ancienne === "" ? undefined : decisions.get(ancienne);
      if (reprise !== undefined) decisions.set(l.targetId, reprise);
    }
  }
  return { decisions, archivees, remplace };
}

/** Les veilles qui portent une décision humaine ET ne sont pas archivées. */
export function idsVeillesDecidees(trace: TraceVeille): string[] {
  return [...trace.decisions.keys()].filter((id) => !trace.archivees.has(id)).sort();
}

/** La première version d'une veille (celle dont la date de saisie fait foi). */
export function versionInitiale(trace: TraceVeille, id: string): string {
  let courant = id;
  const vus = new Set<string>([courant]);
  for (;;) {
    const precedente = trace.remplace.get(courant);
    if (precedente === undefined || vus.has(precedente)) return courant;
    vus.add(precedente);
    courant = precedente;
  }
}

/** Un motif (correction, archivage) : au moins 10 caractères utiles. */
export const MOTIF_MIN = 10;

export function motifValide(motif: string): boolean {
  return motif.trim().length >= MOTIF_MIN;
}
