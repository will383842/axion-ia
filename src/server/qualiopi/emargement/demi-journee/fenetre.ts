/**
 * Chantier QNC, lot L06 — LA FENÊTRE D'UNE DEMI-JOURNÉE. Module PUR.
 *
 * Décision de Will : le stagiaire signe PENDANT la demi-journée. Son lien est
 * fermé avant le début du créneau et après sa fin ; il n'existe plus de
 * réouverture de 48 h (D13) quand l'interrupteur `qualiopi.emargement.actif`
 * agit sur la session.
 *
 * La fenêtre d'un créneau vient de `fenetreDemiJournee` (presence) appliquée
 * aux horaires RÉELS de la journée (`session_jours`, D14), en heure de Paris :
 *   - `matin`      : début de journée → min(fin, 13:00) ;
 *   - `apres_midi` : max(début, 13:00) → fin de journée ;
 *   - `journee`    : la journée entière.
 *
 * ⚠️ Le pivot de 13:00 est la convention déjà appliquée au relevé distanciel :
 * `session_jours` ne déclare pas l'heure de la pause. Voir « Besoin de schéma »
 * de la PR L06.
 *
 * Aucun import Prisma, aucune horloge implicite : l'instant est un paramètre.
 */

import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import { parisMinutesDuJour } from "@/server/qualiopi/presence/time";
import { fenetreDemiJournee } from "@/server/qualiopi/presence/repartition-distanciel";

/** Une demi-journée prévue pour un stagiaire : son créneau et les horaires de sa journée. */
export interface DemiJourneePrevue {
  readonly creneauId: string;
  /** Jour civil `YYYY-MM-DD`, heure de Paris. */
  readonly date: string;
  readonly demiJournee: DemiJourneeLabel;
  /** Horaires réels de la JOURNÉE, `HH:MM`. */
  readonly jourHeureDebut: string;
  readonly jourHeureFin: string;
}

export interface FenetreSignature {
  /** Instant d'ouverture (UTC). */
  readonly debut: Date;
  /** Instant de fermeture (UTC), exclu : à cet instant le lien est fermé. */
  readonly fin: Date;
  /** Horaires de la demi-journée, `HH:MM`, heure de Paris. */
  readonly heureDebut: string;
  readonly heureFin: string;
}

export type PositionFenetre = "a_venir" | "ouverte" | "close";

/**
 * Avance du rappel automatique sur le début de la demi-journée.
 *
 * Le cron passe à `:05` chaque heure : une heure d'avance garantit que chaque
 * demi-journée reçoit son lien avant son début, ou au plus tard cinq minutes
 * après, quelle que soit l'heure de début.
 */
export const AVANCE_RAPPEL_MS = 60 * 60 * 1000;

function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * L'instant UTC qui s'affiche `minutes` après minuit, le jour `iso`, à Paris.
 *
 * Deux corrections suffisent : la première applique le décalage de l'instant
 * naïf, la seconde rattrape un changement d'heure survenu entre les deux.
 */
export function instantParis(iso: string, minutes: number): Date {
  let t = Date.parse(`${iso}T00:00:00.000Z`) + minutes * 60_000;
  for (let i = 0; i < 2; i++) {
    const ecart = (parisMinutesDuJour(new Date(t)) - minutes + 1440) % 1440;
    if (ecart === 0) break;
    // L'écart vaut le décalage de Paris (60 ou 120 min) : Paris est EN AVANCE.
    t -= (ecart > 720 ? ecart - 1440 : ecart) * 60_000;
  }
  return new Date(t);
}

/** La fenêtre de signature d'une demi-journée. */
export function fenetreSignature(dj: DemiJourneePrevue): FenetreSignature {
  const { debutMin, finMin } = fenetreDemiJournee(
    dj.jourHeureDebut,
    dj.jourHeureFin,
    dj.demiJournee,
  );
  return {
    debut: instantParis(dj.date, debutMin),
    fin: instantParis(dj.date, finMin),
    heureDebut: hhmm(debutMin),
    heureFin: hhmm(finMin),
  };
}

/** Où en est la demi-journée, à cet instant. Ouverte = début ≤ maintenant < fin. */
export function positionFenetre(dj: DemiJourneePrevue, maintenant: Date): PositionFenetre {
  const f = fenetreSignature(dj);
  const t = maintenant.getTime();
  if (t < f.debut.getTime()) return "a_venir";
  if (t < f.fin.getTime()) return "ouverte";
  return "close";
}

function parDebut(djs: ReadonlyArray<DemiJourneePrevue>): DemiJourneePrevue[] {
  return [...djs].sort(
    (a, b) => fenetreSignature(a).debut.getTime() - fenetreSignature(b).debut.getTime(),
  );
}

/**
 * La demi-journée que sert un jeton émis MAINTENANT : celle en cours, sinon la
 * prochaine. `null` quand toutes sont closes — et c'est là que la réouverture
 * de 48 h disparaît : après la dernière demi-journée, aucun lien ne s'émet ;
 * un oubli se traite par un rattrapage de l'organisme.
 */
export function demiJourneeCible(
  djs: ReadonlyArray<DemiJourneePrevue>,
  maintenant: Date,
): DemiJourneePrevue | null {
  return parDebut(djs).find((dj) => positionFenetre(dj, maintenant) !== "close") ?? null;
}

/**
 * La demi-journée dont le rappel est DÛ à ce passage.
 *
 * Une demi-journée ouverte passe d'abord : on n'envoie jamais le lien de
 * l'après-midi pendant que le matin est encore signable — l'envoi révoque le
 * lien précédent. Sinon, la prochaine qui commence dans l'heure.
 */
export function demiJourneeDuRappel(
  djs: ReadonlyArray<DemiJourneePrevue>,
  maintenant: Date,
  avanceMs: number = AVANCE_RAPPEL_MS,
): DemiJourneePrevue | null {
  const tries = parDebut(djs);
  const ouverte = tries.find((dj) => positionFenetre(dj, maintenant) === "ouverte");
  if (ouverte !== undefined) return ouverte;
  const t = maintenant.getTime();
  return (
    tries.find((dj) => {
      const f = fenetreSignature(dj);
      return f.debut.getTime() - avanceMs <= t && t < f.debut.getTime();
    }) ?? null
  );
}

/** Code stable d'une demi-journée, `YYYY-MM-DD:matin`. */
export function cleDemiJournee(dj: Pick<DemiJourneePrevue, "date" | "demiJournee">): string {
  return `${dj.date}:${dj.demiJournee}`;
}

const LIBELLE_DEMI: Record<DemiJourneeLabel, string> = {
  matin: "matin",
  apres_midi: "après-midi",
  journee: "journée",
};

/** « jeudi 15 octobre 2026, matin, de 09:00 à 13:00 ». */
export function libelleDemiJournee(dj: DemiJourneePrevue): string {
  const f = fenetreSignature(dj);
  const jour = new Date(`${dj.date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${jour}, ${LIBELLE_DEMI[dj.demiJournee]}, de ${f.heureDebut} à ${f.heureFin}`;
}
