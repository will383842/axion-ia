// Données factuelles par ville — lecture côté serveur (tâche X-4, vague 3).
//
// Lit le fichier VERSIONNÉ `donnees.json` (produit hors ligne par
// `scripts/villes/donnees-factuelles.ts`). Aucun appel réseau, ni au build ni au rendu.
//
// Interrupteur `VILLE_DONNEES_FACTUELLES` (déclaré dans `src/env.ts`) : actif SEULEMENT si
// "true". Absent ou "false" : `getVilleDonneesFactuellesAffichables` rend `null` et la page
// ville est rendue exactement comme avant. Lecture de process.env à l'appel, pas à l'import.
import donneesBrutes from "./donnees.json";
import {
  fichierDonneesFactuellesSchema,
  type FichierDonneesFactuelles,
  type VilleDonneesFactuelles,
} from "./schema";

export type { VilleDonneesFactuelles } from "./schema";

/** Environnement lu par le chargeur (injectable en test). */
export type EnvInterrupteur = Readonly<Record<string, string | undefined>>;

export function donneesFactuellesActivees(env: EnvInterrupteur = process.env): boolean {
  return env.VILLE_DONNEES_FACTUELLES === "true";
}

let cache: FichierDonneesFactuelles | null | undefined;

/**
 * Fichier validé, ou `null` s'il ne respecte pas le schéma : un fichier douteux n'affiche
 * RIEN plutôt qu'un fait sans source (les tests garantissent qu'il est valide).
 */
export function lireFichierDonneesFactuelles(): FichierDonneesFactuelles | null {
  if (cache === undefined) {
    const r = fichierDonneesFactuellesSchema.safeParse(donneesBrutes);
    cache = r.success ? r.data : null;
  }
  return cache;
}

/** Vrai si l'entrée porte au moins un fait affichable. */
export function aDesFaits(d: VilleDonneesFactuelles): boolean {
  return Boolean(
    d.population || d.departement || d.region || d.etablissementsActifs || d.secteursDominants,
  );
}

/**
 * Données à afficher pour une ville, ou `null` (interrupteur éteint, fichier invalide, ville
 * absente du fichier ou sans aucun fait). `null` = le bloc ne s'affiche pas.
 */
export function getVilleDonneesFactuellesAffichables(
  slug: string,
  env: EnvInterrupteur = process.env,
): VilleDonneesFactuelles | null {
  if (!donneesFactuellesActivees(env)) return null;
  const d = lireFichierDonneesFactuelles()?.villes.find((v) => v.slug === slug);
  return d && aDesFaits(d) ? d : null;
}
