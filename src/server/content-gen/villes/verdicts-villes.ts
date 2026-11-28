/**
 * Verdict de la porte de qualité pour TOUTES les villes du dépôt (lecture seule).
 * Importe le barrel des villes (lourd) : réservé aux scripts et aux tests, jamais au runtime
 * (le runtime lit la liste générée `src/generated/villes-publiables.ts`).
 */
import { VILLES } from "@/content/villes";
import { ficheLocale } from "@/content/villes/fiches-locales";
import { contenuDepuisEntree } from "./contenu-ville";
import { evaluerToutesLesVilles, type VerdictVille } from "./porte-qualite-ville";

export interface LigneRapport extends VerdictVille {
  readonly nom: string;
  readonly population: number;
}

/** Une ligne par ville, triée par population décroissante puis slug (aucune mise en avant). */
export function rapportVilles(): ReadonlyArray<LigneRapport> {
  const contenus = VILLES.map((v) =>
    contenuDepuisEntree({
      slug: v.slug,
      nameFr: v.nameFr,
      copy: v.copy,
      economicData: v.economicData,
      fiche: ficheLocale(v.slug),
    }),
  );
  const verdicts = evaluerToutesLesVilles(contenus);
  return VILLES.map((v) => ({
    ...verdicts.get(v.slug)!,
    nom: v.nameFr,
    population: v.population,
  })).sort((a, b) => b.population - a.population || a.slug.localeCompare(b.slug));
}
