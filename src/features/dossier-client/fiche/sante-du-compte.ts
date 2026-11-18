/**
 * « Santé du compte » de la fiche (lot B1). PUR : reçoit des lectures déjà faites.
 * Règle de Will : bonne = un échange il y a moins de 14 jours, aucun paiement en retard,
 * aucune tâche en retard. Sinon « à surveiller », avec la raison.
 * Réutilisé par la synchro (lot C1) : ne pas y mettre d'affichage.
 */

export const SEUIL_ECHANGE_JOURS = 14;

export interface EntreeSante {
  readonly maintenant: Date;
  /** Dernier rendez-vous tenu OU dernier e-mail PARTI ; `null` : aucun échange connu. */
  readonly dernierEchangeLe: Date | null;
  readonly nbFacturesEnRetard: number;
  readonly nbTachesEnRetard: number;
}

export interface SanteDuCompte {
  readonly niveau: "bonne" | "a_surveiller";
  readonly raisons: string[];
}

const jourDeParis = (d: Date): number => {
  const [a, m, j] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .split("-")
    .map(Number);
  return Date.UTC(a!, m! - 1, j!) / 86_400_000;
};

/** Nombre de jours civils (heure de Paris) entre deux instants : minuit à Paris change de jour. */
export const joursEntre = (depuis: Date, jusqua: Date): number =>
  Math.round(jourDeParis(jusqua) - jourDeParis(depuis));

const pluriel = (n: number, un: string, plusieurs: string): string =>
  `${n} ${n > 1 ? plusieurs : un}`;

export function santeDuCompte(e: EntreeSante): SanteDuCompte {
  const raisons: string[] = [];
  if (e.dernierEchangeLe === null) {
    raisons.push("aucun échange");
  } else {
    const jours = joursEntre(e.dernierEchangeLe, e.maintenant);
    if (jours >= SEUIL_ECHANGE_JOURS) raisons.push(`aucun échange depuis ${jours} jours`);
  }
  if (e.nbFacturesEnRetard > 0) {
    raisons.push(pluriel(e.nbFacturesEnRetard, "facture en retard", "factures en retard"));
  }
  if (e.nbTachesEnRetard > 0) {
    raisons.push(pluriel(e.nbTachesEnRetard, "tâche en retard", "tâches en retard"));
  }
  return { niveau: raisons.length === 0 ? "bonne" : "a_surveiller", raisons };
}
