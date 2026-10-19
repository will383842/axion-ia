/**
 * Chantier QNC, NC6 — l'instant de début de la première demi-journée. Fonction PURE.
 *
 * `emettreJetonPresence` fait expirer le lien à cet instant : une confirmation après le début
 * de la formation n'a plus de sens. `TrainingSession.dateDebut` ne peut PAS le lui donner : il
 * est stocké à 00:00 UTC, donc le jeton expirerait vers 1 h ou 2 h de Paris le jour J, des
 * heures avant le début réel. L'instant vient des horaires RÉELS de la première journée
 * (`session_jours`), lus en heure de Paris par `fenetreSignature` puis convertis en UTC.
 */

import { fenetreSignature, instantParis } from "@/server/qualiopi/emargement/demi-journee/fenetre";
import { jourJ } from "./calendrier";

export interface JourSession {
  readonly date: Date;
  /** `HH:MM`, heure de Paris. */
  readonly heureDebut: string;
  readonly heureFin: string;
}

export function debutPremiereDemiJournee(session: {
  readonly dateDebut: Date;
  readonly jours: ReadonlyArray<JourSession>;
}): Date {
  const j = jourJ(session);
  const premier = session.jours.find(
    (x) => jourJ({ dateDebut: session.dateDebut, jours: [x] }) === j,
  );
  // Sans journée déclarée, on ne connaît pas l'heure : minuit de Paris du jour J, l'instant le
  // plus tôt — le lien ferme plus tôt plutôt que jamais.
  if (premier === undefined) return instantParis(j, 0);
  return fenetreSignature({
    creneauId: "",
    date: j,
    demiJournee: "journee",
    jourHeureDebut: premier.heureDebut,
    jourHeureFin: premier.heureFin,
  }).debut;
}
