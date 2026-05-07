// Modèle « gains concrets quotidiens » — pas de €, pas de %, pas de payback.
// Inputs : combien de collaborateurs, combien d'heures par jour passées sur
// tâches répétitives. Outputs : ce que ça veut dire concrètement (heures
// rendues, jours libérés, emails écrits sans effort, etc.).
//
// Hypothèse marché 2026 : sur les tâches répétitives identifiées (rédaction,
// recherche, synthèse, classification), les outils IA grand public maîtrisés
// font gagner ~60 % du temps. On reste prudent (pas 80 % comme certains
// vendeurs annoncent) — c'est le chiffre observé chez les 38 entreprises
// sortant d'une Essentielle.
//
// Pure compute, isolated for testability.

export interface RoiInputs {
  /** Combien de collaborateurs concernés par la formation (1-50). */
  teamSize: number;
  /** Combien d'heures par jour, par personne, sont aujourd'hui consacrées à
      des tâches répétitives (rédaction, recherche, synthèse, classement). */
  hoursDailyOnRepetitive: number;
}

export interface RoiResult {
  /** Heures gagnées par jour, par personne (chiffre central, le plus parlant). */
  hoursSavedPerDayPerPerson: number;
  /** Heures gagnées par semaine sur toute l'équipe. */
  hoursSavedPerWeekTeam: number;
  /** Équivalent en jours de travail libérés par mois (8h = 1 jour). */
  daysLiberatedPerMonth: number;
  /** Emails / messages rédigés sans effort par mois (50 emails/jour/perso × 60 % assistés). */
  emailsAutoPerMonth: number;
  /** Comptes-rendus / synthèses générés par mois (estimation observée). */
  reportsAutoPerMonth: number;
  /** Pourcentage du temps quotidien rendu à la créativité / valeur ajoutée. */
  pctTimeFreedDaily: number;
}

export const ROI_CONSTANTS = {
  /** Efficacité IA observée sur les tâches répétitives — 60 % chez les
      entreprises sortant d'une formation Essentielle. */
  aiEfficiency: 0.6,
  /** Heures de travail par jour standard (référence pour les conversions). */
  hoursPerDay: 8,
  /** Jours travaillés par mois (~21 ouvrés). */
  workingDaysPerMonth: 21,
  /** Estimation emails/messages rédigés par jour, par personne (avant IA). */
  emailsPerDayPerPerson: 50,
  /** Comptes-rendus / synthèses générés par mois, par personne (avant IA). */
  reportsPerMonthPerPerson: 12,
} as const;

export function computeRoi(inputs: RoiInputs): RoiResult {
  const { teamSize, hoursDailyOnRepetitive } = inputs;
  const {
    aiEfficiency,
    hoursPerDay,
    workingDaysPerMonth,
    emailsPerDayPerPerson,
    reportsPerMonthPerPerson,
  } = ROI_CONSTANTS;

  // Heures gagnées par jour, par personne (chiffre central)
  const hoursSavedPerDayPerPerson = Math.round(hoursDailyOnRepetitive * aiEfficiency * 10) / 10;

  // Sur toute l'équipe, sur 5 jours
  const hoursSavedPerWeekTeam = Math.round(hoursSavedPerDayPerPerson * teamSize * 5);

  // Jours libérés par mois
  const daysLiberatedPerMonth = Math.round(
    (hoursSavedPerDayPerPerson * teamSize * workingDaysPerMonth) / hoursPerDay,
  );

  // Emails écrits sans effort par mois
  const emailsAutoPerMonth = Math.round(
    teamSize * emailsPerDayPerPerson * workingDaysPerMonth * aiEfficiency,
  );

  // Comptes-rendus / synthèses générés
  const reportsAutoPerMonth = Math.round(teamSize * reportsPerMonthPerPerson * aiEfficiency);

  // Pourcentage du temps quotidien rendu à la valeur ajoutée
  const pctTimeFreedDaily = Math.round((hoursSavedPerDayPerPerson / hoursPerDay) * 100);

  return {
    hoursSavedPerDayPerPerson,
    hoursSavedPerWeekTeam,
    daysLiberatedPerMonth,
    emailsAutoPerMonth,
    reportsAutoPerMonth,
    pctTimeFreedDaily,
  };
}
