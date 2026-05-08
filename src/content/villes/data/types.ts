// Types data brute INSEE — couche 1 du dataset villes (cf. ADR 0006).
// Aucune information éditoriale ici (pas de directAnswer, FAQ, NAF, etc.).
// Ces fichiers sont régénérés par `scripts/import-insee-villes.ts` à partir
// d'un CSV INSEE communes (open-data, recensement légal). Ne PAS éditer
// à la main les fichiers `data/[region-slug].ts` — le script écrase tout.

export interface VilleData {
  /** Slug FR-canonique kebab-case ASCII (jamais accentué). Stable, sert de clé. */
  slug: string;
  /** Nom affiché (FR canonique, accentué). */
  nameFr: string;
  /** Nom EN miroir (par défaut = nameFr — beaucoup de communes FR n'ont pas de nom EN). */
  nameEn?: string;
  /** Slug région (FK → REGIONS). */
  region: string;
  /** Code département numérique ou "2A"/"2B"/"971"-"976". */
  departement: string;
  /** Label département (par défaut = departement). */
  departementLabel?: string;
  /** Code commune INSEE 5 chiffres (clé technique INSEE). */
  inseeCode: string;
  /** Code postal principal. */
  postalCode?: string;
  /** Population légale (recensement INSEE). */
  population: number;
  /** Coordonnées centre-ville WGS84. */
  geo: { lat: number; lon: number };
}
