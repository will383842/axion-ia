/**
 * Glossaire de référence (décision du 18/11/2026) : forme d'un terme écrit à la main.
 *
 * Structure fixe, 120 à 200 mots au total pour les quatre champs de prose :
 *   1. `definition`     : première phrase autonome et citable (« X est… »), éventuellement
 *                         complétée d'une phrase ;
 *   2. `fonctionnement` : comment ça marche, en clair ;
 *   3. `exemple`        : un cas concret dans une PME française (métier précis, sans chiffre
 *                         de résultat inventé, sans nom d'entreprise) ;
 *   4. `limite`         : erreur fréquente ou limite.
 * Les termes liés (`related`) et le lien vers l'offre (`offre`) sont rendus en plus.
 *
 * Verrouillé par `src/content/glossaire-reference/glossaire-reference.test.ts`.
 */

export type CategorieGlossaire =
  | "foundational"
  | "agents"
  | "rag"
  | "models"
  | "infra"
  | "security"
  | "evaluation"
  | "usages"
  | "gouvernance"
  | "visibilite";

/** Offre Axion-IA proposée en fin de fiche, sans insistance. */
export type OffreGlossaire = "journee-ia" | "formations" | "automatisations" | "cartographie";

export interface TermeSource {
  readonly slug: string;
  readonly term: string;
  readonly category: CategorieGlossaire;
  readonly aliases: readonly string[];
  /** Slugs d'autres termes du glossaire (3 à 5). */
  readonly related: readonly string[];
  readonly definition: string;
  readonly fonctionnement: string;
  readonly exemple: string;
  readonly limite: string;
  readonly offre: OffreGlossaire;
}
