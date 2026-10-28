/**
 * Tour France IA : le registre des villes (PR-2a).
 *
 * Une demande dit sa ville en texte libre. Pour compter « par ville » sans que « Lyon », « LYON » et
 * « lyon 69003 » fassent trois villes, on la ramène à une CLÉ :
 *
 *   · dans le référentiel des villes du site (`prisma/seeds/cities/cities-france-5000plus.json`) :
 *     la clé est le nom normalisé (sans accent ni majuscule, mots séparés par « - »), et le nom du
 *     référentiel est gardé : c'est le seul qui pourra un jour s'afficher en public ;
 *   · hors référentiel, ou ambiguë (deux villes de ce nom, « Saint-Denis ») : la clé est
 *     `?<texte normalisé>` et AUCUN nom n'est gardé : cette ville compte, mais ne s'affiche jamais
 *     en public (on ne devine pas laquelle des deux Saint-Denis la personne voulait dire).
 *
 * Module PUR côté serveur : le JSON est importé statiquement (il n'entre dans aucun bundle client,
 * aucun composant client ne l'importe).
 */

import villesDuReferentiel from "../../../prisma/seeds/cities/cities-france-5000plus.json";
import { normaliserVille } from "@/server/qualiopi/crm/normaliser-nom";

interface VilleDuReferentiel {
  readonly name: string;
}

const REFERENTIEL: ReadonlyArray<VilleDuReferentiel> = villesDuReferentiel;

/** Les abréviations d'usage, remplacées mot pour mot (« st etienne » → « saint etienne »). */
const ABREVIATIONS: Readonly<Record<string, string>> = { st: "saint", ste: "sainte" };

/** Longueur maximale d'une clé (colonne `ville_cle`). */
const LONGUEUR_MAX_CLE = 100;

/**
 * La ville tapée, normalisée : sans accent ni majuscule, un seul espace entre les mots, sans code
 * postal à cinq chiffres ni « cedex », abréviations « st » et « ste » développées. PUR.
 */
export function normaliserSaisieVille(saisie: string): string {
  return normaliserVille(saisie)
    .split(" ")
    .filter((mot) => mot !== "" && mot !== "cedex" && !/^\d{5}$/.test(mot))
    .map((mot) => ABREVIATIONS[mot] ?? mot)
    .join(" ");
}

/** Index du référentiel : nom normalisé → nom d'usage et nombre de villes de ce nom. */
const INDEX: ReadonlyMap<string, { readonly nom: string; readonly nombre: number }> = (() => {
  const index = new Map<string, { readonly nom: string; readonly nombre: number }>();
  for (const ville of REFERENTIEL) {
    const cle = normaliserSaisieVille(ville.name);
    if (cle === "") continue;
    const deja = index.get(cle);
    index.set(
      cle,
      deja === undefined
        ? { nom: ville.name, nombre: 1 }
        : { nom: deja.nom, nombre: deja.nombre + 1 },
    );
  }
  return index;
})();

export interface VilleResolue {
  /** Clé de comptage : `lyon`, `saint-etienne` ; `?annecy` hors référentiel ou ambiguë. */
  readonly cle: string;
  /** Nom du référentiel, ou `null` : une ville sans nom ne s'affiche jamais en public. */
  readonly nom: string | null;
}

/** Résout la ville tapée. `null` si elle est vide (une demande sans ville est refusée). PUR. */
export function resoudreVille(saisie: string): VilleResolue | null {
  const normalisee = normaliserSaisieVille(saisie);
  if (normalisee === "") return null;
  const trouvee = INDEX.get(normalisee);
  if (trouvee !== undefined && trouvee.nombre === 1) {
    return { cle: normalisee.replace(/ /g, "-").slice(0, LONGUEUR_MAX_CLE), nom: trouvee.nom };
  }
  return { cle: `?${normalisee}`.slice(0, LONGUEUR_MAX_CLE), nom: null };
}
