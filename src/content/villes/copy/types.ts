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

/**
 * Contexte local d'application des 3 services Axion-IA — version COURTE
 * pour la page ville mère (1 phrase ~25-50 mots par service).
 * Conservé pour rétrocompat. Pour les pages ville × service dédiées
 * (`/audit/[ville]`, etc.), utiliser `services` (long form) ci-dessous.
 */
export interface VilleServicesContext {
  audit?: { fr: string; en: string };
  interventions?: { fr: string; en: string };
  implementation?: { fr: string; en: string };
}

/**
 * Témoignage local pour preuve sociale spécifique à la ville × service.
 * Anonymisé (pas de nom entreprise complet) pour respecter la convention
 * Axion-IA (cf. `src/content/case-studies.ts`).
 */
export interface VilleTestimonial {
  /** Quote 30-80 mots. */
  quote: string;
  /** Rôle anonymisé (ex "Directeur général"). */
  role: string;
  /** Profil entreprise anonymisé (ex "ETI conseil 9e arrondissement, 250 collab"). */
  companyProfile: string;
}

/**
 * Copie longue d'un service à la ville — pour la page ville × service
 * dédiée (`/audit/[ville]`, `/interventions/[ville]`, `/implementation/[ville]`).
 *
 * Sprint 14.10.1 (2026-05-08) : décision Will = « toutes villes indexables ».
 * Cap = perfection extrême + différenciation anti-doorway HCU 2024.
 * Volume cible : 1500-2500 mots par page ville × service (data unique).
 */
export interface VilleServiceCopyLocale {
  /**
   * Hero direct-answer 80-150 mots citable LLMs.
   * Cible : `audit IA <ville>`, `formation IA <ville>`, `implémentation IA <ville>`.
   * Doit mentionner : entité Axion-IA + service + ville + tarif d'entrée +
   * délai démarrage + différenciateur clé.
   */
  hero: string;
  /**
   * 4-6 raisons spécifiques pourquoi Axion-IA à cette ville × service
   * (data INSEE locale + secteurs B2B + cas clients secteurs présents).
   * Ex pour audit Paris : "Pôle prioritaire 5j moyenne kick-off",
   * "Frais déplacement intra-Paris inclus", "Tissu PME/ETI 215K entreprises", etc.
   */
  whyHere: ReadonlyArray<string>;
  /**
   * Méthodologie pas à pas — 4-6 étapes spécifiques au service.
   * Différenciée de la doctrine générique : ancre contextes locaux quand pertinent.
   */
  methodology: ReadonlyArray<{ step: string; detail: string }>;
  /**
   * Grille tarifaire locale par taille entreprise INSEE (TPE/PME/ETI/GE).
   * Tarifs publics, pas de devis opaque (différenciateur Axion-IA).
   */
  pricing: ReadonlyArray<{
    sizeLabel: string; // "TPE (< 10 collab)" / "PME (10-249)" / "ETI (250-4999)" / "Grande entreprise (5000+)"
    price: string; // "490 € HT" / "1 900 - 3 900 € HT" / "Sur devis"
    detail: string; // 1 phrase contextuelle
  }>;
  /**
   * Témoignages clients locaux anonymisés (1-3 par service × ville).
   * Pivot social proof : "ETI conseil 9e arrondissement, 250 collab" + quote.
   */
  testimonials?: ReadonlyArray<VilleTestimonial>;
  /**
   * FAQ spécifique au service à la ville (4-8 Q/R). Speakable JSON-LD.
   * Sujets : tarifs locaux, délai démarrage, formats, RGPD, garanties,
   * comparaison vs alternatives.
   */
  faq: ReadonlyArray<VilleFaq>;
  /**
   * Garanties / engagements spécifiques au service. 1 paragraphe ~50-100 mots.
   * Anti-fear : RGPD, no lock-in, satisfaction, ROI chiffré.
   */
  guarantees: string;
}

/**
 * Long-form services à la ville — alimente les 3 pages ville × service
 * dédiées (`/audit/[ville]`, `/interventions/[ville]`, `/implementation/[ville]`)
 * ainsi que des sections détaillées sur la page ville mère.
 *
 * Optionnel : si absent, les pages ville × service rendent un stub minimal
 * `noindex follow` (anti-doorway HCU 2024).
 */
export interface VilleServicesLong {
  audit?: { fr: VilleServiceCopyLocale; en: VilleServiceCopyLocale };
  interventions?: { fr: VilleServiceCopyLocale; en: VilleServiceCopyLocale };
  implementation?: { fr: VilleServiceCopyLocale; en: VilleServiceCopyLocale };
}

export interface VilleCopy {
  /** Pitch FR 30-50 mots, citable LLMs (signal AEO/GEO). */
  pitchFr: string;
  /** Pitch EN miroir. */
  pitchEn: string;
  /** Contexte local d'application des 3 services Axion-IA (version courte). */
  servicesContext?: VilleServicesContext;
  /**
   * Long-form services à la ville (1500-2500 mots par service). Sprint 14.10.1.
   * Alimente les pages ville × service dédiées + sections détaillées page mère.
   * Cap : perfection extrême — chaque ville pilote DOIT avoir cette structure
   * pour rank #1 sur « audit IA <ville> » / « formation IA <ville> » / etc.
   */
  services?: VilleServicesLong;
  /**
   * Direct-answer FR 40-80 mots (Q "qu'est-ce qu'Axion-IA à [Ville] ?"),
   * citable verbatim par Perplexity / Claude.ai / Google AI Overviews.
   * Différent du `pitchFr` (plus narratif, hero-positionnel) : ce champ
   * est lu en premier par les LLMs et doit être autonome — entité +
   * périmètre + tarif d'entrée + condition d'engagement.
   */
  directAnswerFr?: string;
  /** Direct-answer EN miroir. */
  directAnswerEn?: string;
  /** Top secteurs NAF (B2B Axion-IA pertinents) — ex. "Banque/Finance, Conseil, Tech". */
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
