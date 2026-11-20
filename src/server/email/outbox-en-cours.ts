/**
 * OUT-1 — un envoi depuis la corbeille ne produit jamais deux tâches.
 *
 * Module LÉGER : aucun import de `health.ts` ni de `queues.ts` (il est lu par l'enveloppe du lien
 * de signature, par la liste des devis et par la file elle-même).
 *
 * Le seul identifiant de tâche d'un envoi approuvé est `outbox-<id de la ligne>` : deux
 * approbations de la même ligne (pendant une coupure de Redis, après la remise « à valider » du
 * balayage) visent donc LA MÊME tâche, et BullMQ ignore la seconde.
 */

/** Une ligne « approuvé » plus vieille que ce délai (minutes) est examinée par le balayage. */
export const AGE_APPROUVE_ABANDONNE_MIN = 15;

/** Budget total (ms) de la mise en file d'un envoi de la corbeille, avant « issue inconnue ». */
export const DELAI_MISE_EN_FILE_OUTBOX_MS = 20_000;

/** Attente maximale (ms) de la connexion à la file avant de renoncer, sans rien avoir envoyé. */
export const DELAI_CONNEXION_FILE_MS = 5_000;

/** Identifiant de tâche BullMQ d'un envoi approuvé depuis la corbeille. */
export function cleTacheOutbox(id: string): string {
  return `outbox-${id}`;
}

/** La file n'a pas répondu à temps : AUCUNE commande n'a été émise, rien n'est en vol. */
export class FileInjoignable extends Error {
  constructor() {
    super("file d'envoi injoignable");
    this.name = "FileInjoignable";
  }
}

/** L'ajout a été émis et n'a pas répondu à temps : on ne sait pas si l'e-mail est parti. */
export class MiseEnFileIncertaine extends Error {
  constructor() {
    super("mise en file incertaine");
    this.name = "MiseEnFileIncertaine";
  }
}

/** Lecture de l'état d'une tâche dans la file (hors ajout) : borne de la lecture (ms). */
export const DELAI_LECTURE_FILE_MS = 5_000;

/** Un journal `pending` sans tâche n'est tranché qu'à partir de cet âge (minutes). */
export const AGE_JOURNAL_ORPHELIN_MIN = 60;

/** Repère posé au premier constat « tâche introuvable » (champ `error` du journal). */
export const MOTIF_CONSTAT_TACHE_ABSENTE =
  "Balayage : tâche introuvable dans la file (premier constat).";

/** Motif de clôture du journal quand la tâche est introuvable à deux passages. */
export const MOTIF_ORPHELIN_CLOS =
  "Balayage : tâche introuvable à deux passages, rien n'est parti.";

/** État d'une tâche `outbox-<id>` : présente (attente, différée, active, terminée…), échouée ou absente. */
export type EtatTacheOutbox = "absente" | "echouee" | "presente";

export type DecisionApprouveAncien = "parti" | "rien_parti" | "constat_1" | "orphelin" | "attendre";

/** Dernière ligne du journal d'une tâche (statut et repère d'erreur seulement). */
export interface JournalResume {
  status: string;
  error: string | null;
}

/**
 * Règle UNIQUE du balayage pour une ligne « approuvé » ancienne : état réel de la tâche, puis
 * dernière ligne du journal. Fonction pure.
 */
export function trancherApprouveAncien(a: {
  tache: EtatTacheOutbox;
  journal: JournalResume | null;
  approuveAt: Date;
  maintenant: Date;
}): DecisionApprouveAncien {
  if (a.tache === "presente") return "parti";
  if (a.tache === "echouee") return "rien_parti";
  const statut = a.journal?.status;
  if (statut === "sent" || statut === "bounced") return "parti";
  if (statut !== "pending") return "rien_parti";
  const ageMin = (a.maintenant.getTime() - a.approuveAt.getTime()) / 60_000;
  if (ageMin < AGE_JOURNAL_ORPHELIN_MIN) return "attendre";
  return a.journal?.error === MOTIF_CONSTAT_TACHE_ABSENTE ? "orphelin" : "constat_1";
}

/**
 * L'envoi est-il déjà fait ? Tâche présente non échouée, ou tâche absente (purgée) avec un
 * journal le plus récent `sent` / `bounced`.
 */
export function estDejaFait(tache: EtatTacheOutbox, journal: JournalResume | null): boolean {
  return (
    tache === "presente" ||
    (tache === "absente" && (journal?.status === "sent" || journal?.status === "bounced"))
  );
}
