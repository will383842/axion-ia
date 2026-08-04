/**
 * Qualiopi — Indisponibilités des formateurs : logique PURE (aucune I/O).
 *
 * Une indisponibilité est une fenêtre de JOURS pendant laquelle un formateur ne
 * peut pas être mobilisé : congés, maladie, formation interne.
 *
 * ── Bornes inclusives, et pourquoi ───────────────────────────────────────────
 * `dateDebut` ET `dateFin` sont inclus : un congé « du 3 au 7 » couvre cinq
 * jours, pas quatre. C'est la convention qu'un humain a en tête quand il pose des
 * congés, et la seule qui rende la saisie « du 3 au 3 » (un jour) exprimable.
 * L'erreur classique serait de traiter `dateFin` comme exclue, comme le fait le
 * barème versionné (`effectiveTo`) : les deux conventions coexistent dans ce
 * domaine, il faut les distinguer explicitement.
 *
 * ── On raisonne en clés jour, jamais en instants ─────────────────────────────
 * Comparer des `Date` reviendrait à comparer des instants, donc à dépendre du
 * fuseau et de l'heure d'été. On compare des clés `YYYY-MM-DD` — mêmes clés que
 * `expandEventDayKeys` (Europe/Paris), donc directement intersectables avec le
 * planning.
 */

export type TrainerAvailabilityTypeValue =
  "conge" | "maladie" | "formation_interne" | "indisponible";

/** Miroir des libellés, pour l'affichage. */
export const LIBELLE_INDISPO: Record<TrainerAvailabilityTypeValue, string> = {
  conge: "Congés",
  maladie: "Maladie",
  formation_interne: "Formation interne",
  indisponible: "Indisponible",
};

/** Une fenêtre d'indisponibilité, bornes de jour INCLUSES. */
export interface Indisponibilite {
  trainerId: string;
  type: TrainerAvailabilityTypeValue;
  /** `YYYY-MM-DD`, premier jour indisponible. */
  debut: string;
  /** `YYYY-MM-DD`, dernier jour indisponible (INCLUS). */
  fin: string;
}

/** Clé jour d'une `Date` stockée en colonne `DATE` (donc à minuit UTC). */
export function dayKeyOfDateColumn(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const j = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}

/**
 * Le formateur est-il indisponible ce jour-là ?
 *
 * Comparaison lexicographique de clés `YYYY-MM-DD` : elle coïncide avec l'ordre
 * chronologique tant que le format est zéro-paddé, et évite tout aller-retour
 * par `Date` (donc tout piège de fuseau).
 */
export function estIndisponibleLeJour(indispo: Indisponibilite, dayKey: string): boolean {
  return dayKey >= indispo.debut && dayKey <= indispo.fin;
}

/**
 * Les clés jour couvertes par une fenêtre. Bornée à `MAX_JOURS_FENETRE` pour
 * qu'une saisie aberrante (« du 1er janvier 2026 au 1er janvier 2100 ») ne fasse
 * pas exploser la mémoire de la page qui l'affiche.
 */
export const MAX_JOURS_FENETRE = 400;

export function joursDeLIndispo(indispo: Indisponibilite): string[] {
  const jours: string[] = [];
  const curseur = new Date(`${indispo.debut}T00:00:00Z`);
  const fin = new Date(`${indispo.fin}T00:00:00Z`);
  if (Number.isNaN(curseur.getTime()) || Number.isNaN(fin.getTime())) return [];

  while (curseur.getTime() <= fin.getTime() && jours.length < MAX_JOURS_FENETRE) {
    jours.push(dayKeyOfDateColumn(curseur));
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return jours;
}

/**
 * Ensemble des jours indisponibles d'un formateur, tous types confondus.
 * Le type ne change pas le verdict : un formateur en formation interne est aussi
 * indisponible qu'un formateur en congés. Le type sert au reporting.
 */
export function joursIndisponibles(indispos: readonly Indisponibilite[]): Set<string> {
  const jours = new Set<string>();
  for (const i of indispos) for (const j of joursDeLIndispo(i)) jours.add(j);
  return jours;
}

/**
 * Capacité résiduelle d'un formateur sur un mois : les jours ouvrés du mois
 * moins ceux qu'il passe indisponible.
 *
 * Ne descend jamais sous 0 : une capacité négative n'a pas de sens, et un taux
 * d'occupation calculé dessus serait absurde. Un formateur indisponible tout le
 * mois a une capacité de 0 — la vue charge affichera alors 0 %, ce qui est
 * exact : il n'était pas censé travailler.
 */
export function capaciteResiduelle(
  joursOuvres: readonly string[],
  indisponibles: ReadonlySet<string>,
): number {
  let n = 0;
  for (const j of joursOuvres) if (!indisponibles.has(j)) n += 1;
  return n;
}

/**
 * Une prestation planifiée tombe-t-elle sur une indisponibilité ? C'est le
 * conflit le plus embarrassant du cockpit : le formateur est en congés, et une
 * formation est vendue sur ses dates.
 */
export function joursEnConflit(
  joursPrestation: readonly string[],
  indisponibles: ReadonlySet<string>,
): string[] {
  return joursPrestation.filter((j) => indisponibles.has(j));
}
