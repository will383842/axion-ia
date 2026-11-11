/**
 * Couche « Méthode » — plan et exécution de l'import (ADR 0076 § 2.9).
 *
 * - ESSAI À BLANC par défaut : `executerImport(fiches, { ecrire: false, … })` ne
 *   touche JAMAIS au dépôt et rend seulement le plan ;
 * - écriture seulement avec `ecrire: true` (option `--ecrire` du script) ;
 * - idempotent sur le slug : créer si absent, mettre à jour sinon ;
 * - JAMAIS de suppression (aucune méthode de suppression dans le dépôt injecté) ;
 * - JAMAIS de publication : statut `approved`, `publishedAt` nul ; une entrée déjà
 *   `published` (qui ne devrait pas exister) est laissée intacte et signalée.
 */

import { COLLECTION_SANTE, COLLECTION_VENTE, type FicheMethode } from "./decoupage";

export const COLLECTIONS_METHODE = {
  [COLLECTION_VENTE]: {
    titreFr: "Méthode · vente",
    descriptionFr:
      "Fiches de méthode de vente (9 livres appliqués à Axion-IA, closing, audit, posture). " +
      "Équipe uniquement, jamais publiées. Les montants cités sont des exemples d'entraînement.",
  },
  [COLLECTION_SANTE]: {
    titreFr: "Méthode · secteur santé",
    descriptionFr:
      "Dossier secteur santé, servi seulement quand on s'adresse à la santé. Équipe uniquement.",
  },
} as const;

export interface EntreeExistante {
  readonly id: string;
  readonly status: string;
}

/** Le dépôt d'écriture. Volontairement SANS méthode de suppression. */
export interface DepotMethode {
  trouverEntree(slug: string): Promise<EntreeExistante | null>;
  creerEntree(fiche: FicheMethode): Promise<string>;
  mettreAJourEntree(id: string, fiche: FicheMethode): Promise<void>;
  assurerCollection(slug: string, titreFr: string, descriptionFr: string): Promise<string>;
  rattacherACollection(collectionId: string, entreeId: string): Promise<void>;
  assurerEtiquette(slug: string): Promise<string>;
  etiqueter(entreeId: string, etiquetteId: string): Promise<void>;
}

export type ActionPrevue = "creer" | "mettre-a-jour" | "ignorer-publiee";

export interface LignePlan {
  readonly slug: string;
  readonly action: ActionPrevue;
  readonly collection: string;
  readonly etiquettes: readonly string[];
  readonly caracteres: number;
}

export interface ResultatImport {
  readonly ecrit: boolean;
  readonly plan: readonly LignePlan[];
}

export interface OptionsImport {
  readonly ecrire: boolean;
  readonly depot: DepotMethode;
}

/** Refuse un lot qui porterait deux fois le même slug (l'idempotence en dépend). */
export function verifierSlugsUniques(fiches: readonly FicheMethode[]): void {
  const vus = new Set<string>();
  for (const f of fiches) {
    if (vus.has(f.slug)) throw new Error(`Slug en double dans le lot : ${f.slug}`);
    vus.add(f.slug);
  }
}

export async function executerImport(
  fiches: readonly FicheMethode[],
  options: OptionsImport,
): Promise<ResultatImport> {
  verifierSlugsUniques(fiches);
  const plan: LignePlan[] = [];
  const { depot } = options;

  if (!options.ecrire) {
    // Essai à blanc : le plan ne dit pas « créer » ou « mettre à jour » sans lire la
    // base ; sans base, toute fiche est annoncée « creer-ou-mettre-a-jour » → « creer ».
    for (const f of fiches) {
      plan.push({
        slug: f.slug,
        action: "creer",
        collection: f.collection,
        etiquettes: f.etiquettes,
        caracteres: f.corps.length,
      });
    }
    return { ecrit: false, plan };
  }

  const collections = new Map<string, string>();
  const etiquettes = new Map<string, string>();

  for (const f of fiches) {
    const existante = await depot.trouverEntree(f.slug);
    if (existante?.status === "published") {
      plan.push({
        slug: f.slug,
        action: "ignorer-publiee",
        collection: f.collection,
        etiquettes: f.etiquettes,
        caracteres: f.corps.length,
      });
      continue;
    }

    let id: string;
    if (existante) {
      await depot.mettreAJourEntree(existante.id, f);
      id = existante.id;
    } else {
      id = await depot.creerEntree(f);
    }

    let collectionId = collections.get(f.collection);
    if (!collectionId) {
      const meta = COLLECTIONS_METHODE[f.collection];
      collectionId = await depot.assurerCollection(f.collection, meta.titreFr, meta.descriptionFr);
      collections.set(f.collection, collectionId);
    }
    await depot.rattacherACollection(collectionId, id);

    for (const e of f.etiquettes) {
      let etiquetteId = etiquettes.get(e);
      if (!etiquetteId) {
        etiquetteId = await depot.assurerEtiquette(e);
        etiquettes.set(e, etiquetteId);
      }
      await depot.etiqueter(id, etiquetteId);
    }

    plan.push({
      slug: f.slug,
      action: existante ? "mettre-a-jour" : "creer",
      collection: f.collection,
      etiquettes: f.etiquettes,
      caracteres: f.corps.length,
    });
  }
  return { ecrit: true, plan };
}
