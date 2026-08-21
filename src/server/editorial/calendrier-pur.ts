/**
 * Console éditoriale — la logique de calendrier qui ne touche PAS la base.
 *
 * Séparé de `queries.ts` pour une raison concrète : `queries.ts` porte
 * `import "server-only"`, ce qui le rend **inimportable** depuis un test
 * Vitest. Toute la logique qui décide de ce que l'écran affiche — bornage des
 * paramètres d'URL, mois voisin, regroupement par jour — vivait donc dans un
 * fichier que personne ne pouvait tester unitairement.
 *
 * Ici, aucun import serveur : ces fonctions se testent en une milliseconde,
 * et ce sont elles qui cassent, pas les `findMany`.
 */

/** Filtre du §7 : « le filtre identité = pro n'affiche que la page ». */
export type FiltreIdentite = "toutes" | "perso" | "pro";

/**
 * Lit le filtre d'identité d'une URL.
 *
 * Tout ce qui n'est pas exactement `perso` ou `pro` retombe sur `toutes` :
 * une valeur inventée ne doit pas vider l'écran sans explication.
 */
export function estFiltreIdentite(v: string | undefined): FiltreIdentite {
  return v === "perso" || v === "pro" ? v : "toutes";
}

/** Bornes du mois, en UTC — cohérentes avec une colonne `@db.Date`. */
export function bornesDuMois(annee: number, mois: number): { debut: Date; fin: Date } {
  return {
    debut: new Date(Date.UTC(annee, mois - 1, 1)),
    fin: new Date(Date.UTC(annee, mois, 1)),
  };
}

/** Mois précédent / suivant, sans dépendance ni piège de fin d'année. */
export function moisVoisin(
  annee: number,
  mois: number,
  pas: -1 | 1,
): { annee: number; mois: number } {
  const m = mois + pas;
  if (m < 1) return { annee: annee - 1, mois: 12 };
  if (m > 12) return { annee: annee + 1, mois: 1 };
  return { annee, mois: m };
}

/**
 * Borne un mois lu dans l'URL.
 *
 * 🔴 Sans ce bornage, `MOIS[mois - 1]` rend `undefined` sur `?month=99`, le
 * titre de la page devient « Calendrier — undefined 2026 », et une grille
 * construite sur un mois 99 part en vrille. Une URL n'est jamais de confiance.
 */
export function lireMois(v: string | undefined, defaut: number): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : defaut;
}

/** Borne une année lue dans l'URL, sur une fenêtre raisonnable. */
export function lireAnnee(v: string | undefined, defaut: number): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 2020 && n <= 2100 ? n : defaut;
}

/** Vrai si la chaîne est une clé de jour « AAAA-MM-JJ » plausible. */
export function estCleJour(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Ce dont la grille a besoin pour poser ses pastilles. */
export interface AvecCleJour {
  dayKey: string;
}

/** Compte par jour, pour les pastilles de la grille. */
export function compterParJour(publications: readonly AvecCleJour[]): Map<string, number> {
  const parJour = new Map<string, number>();
  for (const p of publications) {
    parJour.set(p.dayKey, (parJour.get(p.dayKey) ?? 0) + 1);
  }
  return parJour;
}
