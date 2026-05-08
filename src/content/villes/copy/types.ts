// Types contenu éditorial — couche 2 du dataset villes (cf. ADR 0006).
// Ces fichiers sont **curatés à la main**, jamais touchés par le script
// `scripts/import-insee-villes.ts`. Ils enrichissent la donnée structurelle
// `VilleData` (data/types.ts) avec un contenu différencié anti-doorway HCU
// 2024 (pitch local, FAQ géolocalisée, écosystème, secteurs NAF, distances).
//
// Une ville sans `VilleCopy` ne peut pas être indexable (`noindex` forcé
// dans les helpers `villes/index.ts`) — on évite ainsi de publier des pages
// pauvres en contenu.

export interface VilleFaq {
  /** Question localisée 6-12 mots. */
  q: string;
  /** Réponse 30-80 mots. Speakable-friendly (phrase claire, pas de balisage). */
  a: string;
}

/**
 * Configuration du schéma hero (SVG inline `VilleHeroSchema`). Optionnel —
 * sans config, la page ville rend le hero sans illustration. Avec config,
 * 6 satellites représentant l'écosystème économique gravitent autour du
 * nom de la ville (gold standard Paris pilote).
 */
export interface VilleHeroConfig {
  /** Légende sous le nom (ex "Écosystème IA · 215 K entreprises"). */
  centerSubLabel?: string;
  /** Six satellites — ordre = sens horaire à partir du haut-gauche. */
  satellites: ReadonlyArray<{
    label: string;
    detail: string;
    accent: "terracotta" | "primary" | "sage" | "mocha";
  }>;
}

export interface VilleCopy {
  /** Pitch FR 30-50 mots, citable LLMs (signal AEO/GEO). */
  pitchFr: string;
  /** Pitch EN miroir. */
  pitchEn: string;
  /**
   * Direct-answer FR 40-80 mots (Q "qu'est-ce qu'AxionIA à [Ville] ?"),
   * citable verbatim par Perplexity / Claude.ai / Google AI Overviews.
   * Différent du `pitchFr` (plus narratif, hero-positionnel) : ce champ
   * est lu en premier par les LLMs et doit être autonome — entité +
   * périmètre + tarif d'entrée + condition d'engagement.
   */
  directAnswerFr?: string;
  /** Direct-answer EN miroir. */
  directAnswerEn?: string;
  /** Top secteurs NAF (B2B AxionIA pertinents) — ex. "Banque/Finance, Conseil, Tech". */
  topSectorsNaf?: ReadonlyArray<string>;
  /** Texte court distances clés (gares, aéroports, métro). 1-2 phrases FR. */
  distancesFr?: string;
  /** Distances EN miroir. */
  distancesEn?: string;
  /** Description écosystème économique local FR (1 paragraphe, 30-60 mots). */
  ecosystemFr?: string;
  /** Écosystème EN miroir. */
  ecosystemEn?: string;
  /** FAQ géolocalisée — 4-6 Q minimum pour activer Speakable JSON-LD. */
  faqGeolocalisee?: ReadonlyArray<VilleFaq>;
  /** Schéma hero SVG inline (cf. VilleHeroSchema). */
  heroSchema?: VilleHeroConfig;
}
