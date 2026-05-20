/**
 * Knowledge Base — Tags sectoriels canoniques pour Axion-IA B2B France.
 *
 * Sprint City Quality V3 Phase B 2026-05-19.
 *
 * Cette taxonomie sectorielle structure le RAG ContentGen : chaque ville
 * pilote (`src/content/villes/economic-data/<slug>.ts`) référence un sous-
 * ensemble de ces tags via `kbSectorTags`. ContentGen requête ensuite les
 * entries KB taggées pour composer landing pages anti-duplicate.
 *
 * Conventions :
 * - Slug : kebab-case ASCII, stable, jamais accentué (clé de jointure)
 * - Découpage : sectoriel B2B-pertinent pour Axion-IA (cabinet IA audits/
 *   interventions/implementations/un-a-un), pas une nomenclature INSEE
 *   exhaustive (qui aurait ~500 codes NAF)
 * - Stabilité : ne pas renommer un slug sans migration (les `kbSectorTags`
 *   dans villes/ deviennent invalides)
 *
 * Mapping macro vers sections NACE INSEE (à titre indicatif) :
 * - Tertiaire/services → sections M, J, K, L
 * - Industrie → sections B, C, D, E, F
 * - Santé → section Q
 * - Agroalimentaire → sections A, C10 (industries alimentaires)
 * - Commerce → section G
 */

export interface KbSectorTag {
  /** Slug stable kebab-case. */
  readonly slug: string;
  /** Libellé court FR (titre humain). */
  readonly labelFr: string;
  /** Libellé court EN. */
  readonly labelEn: string;
  /** Description 1 phrase FR (≤ 150 chars). */
  readonly descFr: string;
  /** Description 1 phrase EN. */
  readonly descEn: string;
  /** Catégorie macro (regroupement UI dashboard). */
  readonly categorie:
    | "tertiaire"
    | "industrie"
    | "sante"
    | "agroalimentaire"
    | "commerce"
    | "mode_luxe"
    | "culture_creatif"
    | "public_recherche";
}

export const KB_SECTOR_TAGS: ReadonlyArray<KbSectorTag> = [
  // ─── Tertiaire / services (axe principal Axion-IA) ─────────────────
  {
    slug: "conseil-affaires",
    labelFr: "Conseil aux affaires",
    labelEn: "Business consulting",
    descFr: "Cabinets de conseil, audit financier, conseil stratégique et organisation.",
    descEn: "Consulting firms, financial audit, strategy and organization.",
    categorie: "tertiaire",
  },
  {
    slug: "banque-finance",
    labelFr: "Banque & finance",
    labelEn: "Banking & finance",
    descFr: "Banques de détail, banque corporate, asset management, fintech.",
    descEn: "Retail and corporate banking, asset management, fintech.",
    categorie: "tertiaire",
  },
  {
    slug: "assurance",
    labelFr: "Assurance & mutuelles",
    labelEn: "Insurance & mutuals",
    descFr: "Compagnies d'assurance, mutuelles, InsurTech, courtage.",
    descEn: "Insurance companies, mutuals, InsurTech, brokerage.",
    categorie: "tertiaire",
  },
  {
    slug: "immobilier-pro",
    labelFr: "Immobilier professionnel",
    labelEn: "Commercial real estate",
    descFr: "Promotion immobilière, foncières, property management, proptech.",
    descEn: "Real estate development, REITs, property management, proptech.",
    categorie: "tertiaire",
  },
  {
    slug: "it-numerique",
    labelFr: "IT & numérique",
    labelEn: "IT & digital",
    descFr: "ESN, éditeurs logiciels, infrastructure cloud, intégrateurs IT B2B.",
    descEn: "IT services, software publishers, cloud infrastructure, B2B integrators.",
    categorie: "tertiaire",
  },
  {
    slug: "cybersecurite",
    labelFr: "Cybersécurité",
    labelEn: "Cybersecurity",
    descFr: "SOC, audit sécurité, pentest, gouvernance ISO 27001 et NIS 2.",
    descEn: "SOC, security audit, pentest, ISO 27001 and NIS 2 governance.",
    categorie: "tertiaire",
  },
  {
    slug: "communication-medias",
    labelFr: "Communication & médias",
    labelEn: "Communication & media",
    descFr: "Agences publicité, médias audiovisuels, RP, marketing B2B.",
    descEn: "Advertising agencies, broadcast media, PR, B2B marketing.",
    categorie: "tertiaire",
  },
  {
    slug: "juridique",
    labelFr: "Juridique & Notariat",
    labelEn: "Legal & Notarial",
    descFr:
      "Cabinets d'avocats, notaires, huissiers, LegalTech et conseil juridique en entreprise.",
    descEn: "Law firms, notaries, bailiffs, LegalTech and in-house legal counsel.",
    categorie: "tertiaire",
  },

  // ─── Industrie ──────────────────────────────────────────────────────
  {
    slug: "industrie-manufacturiere",
    labelFr: "Industrie manufacturière",
    labelEn: "Manufacturing industry",
    descFr: "Production industrielle de biens d'équipement et de consommation.",
    descEn: "Industrial production of equipment and consumer goods.",
    categorie: "industrie",
  },
  {
    slug: "mecanique-precision",
    labelFr: "Mécanique de précision",
    labelEn: "Precision engineering",
    descFr: "Microtechniques, horlogerie, micro-mécanique, instrumentation.",
    descEn: "Microtechnology, watchmaking, micro-mechanics, instrumentation.",
    categorie: "industrie",
  },
  {
    slug: "chimie-pharma",
    labelFr: "Chimie & pharmacie",
    labelEn: "Chemicals & pharmaceuticals",
    descFr: "Chimie industrielle, pharmacie, cosmétique, parfumerie.",
    descEn: "Industrial chemistry, pharmaceuticals, cosmetics, perfumery.",
    categorie: "industrie",
  },
  {
    slug: "aerospatial-defense",
    labelFr: "Aérospatial & défense",
    labelEn: "Aerospace & defense",
    descFr: "Aéronautique civile, spatial, drones, défense terrestre et maritime.",
    descEn: "Civil aeronautics, space, drones, land and maritime defense.",
    categorie: "industrie",
  },
  {
    slug: "automobile-mobilite",
    labelFr: "Automobile & mobilité",
    labelEn: "Automotive & mobility",
    descFr: "Constructeurs auto, équipementiers, mobilité décarbonée, sous-traitance.",
    descEn: "Car makers, tier-1 suppliers, low-carbon mobility, subcontracting.",
    categorie: "industrie",
  },
  {
    slug: "construction-btp",
    labelFr: "Construction & BTP",
    labelEn: "Construction & BTP",
    descFr: "Bâtiment, travaux publics, génie civil, matériaux de construction.",
    descEn: "Building, public works, civil engineering, construction materials.",
    categorie: "industrie",
  },
  {
    slug: "energie-cleantech",
    labelFr: "Énergie & cleantech",
    labelEn: "Energy & cleantech",
    descFr: "Énergies renouvelables, nucléaire, efficacité énergétique, hydrogène.",
    descEn: "Renewable energy, nuclear, energy efficiency, hydrogen.",
    categorie: "industrie",
  },
  {
    slug: "maritime-portuaire",
    labelFr: "Maritime & portuaire",
    labelEn: "Maritime & port",
    descFr: "Transport maritime, construction navale, économie portuaire, pêche pro.",
    descEn: "Maritime transport, shipbuilding, port economy, commercial fishing.",
    categorie: "industrie",
  },

  // ─── Santé ──────────────────────────────────────────────────────────
  {
    slug: "sante-biotech",
    labelFr: "Santé & biotech",
    labelEn: "Health & biotech",
    descFr: "Établissements de santé, biotechnologies, e-santé, télémédecine.",
    descEn: "Healthcare facilities, biotechnology, e-health, telemedicine.",
    categorie: "sante",
  },
  {
    slug: "dispositifs-medicaux",
    labelFr: "Dispositifs médicaux",
    labelEn: "Medical devices",
    descFr: "Conception et production de dispositifs médicaux, MedTech B2B.",
    descEn: "Design and production of medical devices, B2B MedTech.",
    categorie: "sante",
  },

  // ─── Agroalimentaire / terroir ──────────────────────────────────────
  {
    slug: "agroalimentaire-igp",
    labelFr: "Agroalimentaire & IGP/AOP",
    labelEn: "Food industry & PGI/PDO",
    descFr: "Industries agroalimentaires, filières IGP/AOP, transformation et qualité.",
    descEn: "Food industries, PGI/PDO chains, processing and quality.",
    categorie: "agroalimentaire",
  },
  {
    slug: "viticulture-haut-de-gamme",
    labelFr: "Viticulture haut de gamme",
    labelEn: "Premium wine",
    descFr: "Domaines viticoles AOC, négoce vin, Champagne, vins de prestige.",
    descEn: "AOC wineries, wine trading, Champagne, premium wines.",
    categorie: "agroalimentaire",
  },
  {
    slug: "agriculture-elevage",
    labelFr: "Agriculture & élevage",
    labelEn: "Agriculture & livestock",
    descFr: "Exploitations agricoles, élevage, coopératives, agro-équipement.",
    descEn: "Farms, livestock, cooperatives, agricultural equipment.",
    categorie: "agroalimentaire",
  },

  // ─── Commerce & distribution ────────────────────────────────────────
  {
    slug: "retail-e-commerce",
    labelFr: "Retail & e-commerce",
    labelEn: "Retail & e-commerce",
    descFr: "Distribution spécialisée, commerce de détail, e-commerce B2B et B2C.",
    descEn: "Specialty retail, brick-and-mortar, B2B and B2C e-commerce.",
    categorie: "commerce",
  },
  {
    slug: "logistique-supply-chain",
    labelFr: "Logistique & supply chain",
    labelEn: "Logistics & supply chain",
    descFr: "Transport, entreposage, supply chain, logistique portuaire et ferroviaire.",
    descEn: "Transport, warehousing, supply chain, port and rail logistics.",
    categorie: "commerce",
  },
  {
    slug: "distribution-grande-conso",
    labelFr: "Grande distribution",
    labelEn: "Mass retail",
    descFr: "Hypermarchés, supermarchés, centrales d'achat, distribution alimentaire.",
    descEn: "Hypermarkets, supermarkets, purchasing centrals, food distribution.",
    categorie: "commerce",
  },

  // ─── Mode / luxe ────────────────────────────────────────────────────
  {
    slug: "mode-luxe-maroquinerie",
    labelFr: "Mode, luxe & maroquinerie",
    labelEn: "Fashion, luxury & leather",
    descFr: "Maisons de luxe, mode, maroquinerie, joaillerie, horlogerie haut de gamme.",
    descEn: "Luxury houses, fashion, leather goods, jewelry, premium watchmaking.",
    categorie: "mode_luxe",
  },
  {
    slug: "cosmetique-beaute",
    labelFr: "Cosmétique & beauté",
    labelEn: "Cosmetics & beauty",
    descFr: "Cosmétique, parfumerie, soins, ingrédients beauté, distribution sélective.",
    descEn: "Cosmetics, perfumery, skincare, beauty ingredients, selective distribution.",
    categorie: "mode_luxe",
  },

  // ─── Culture / créatif ──────────────────────────────────────────────
  {
    slug: "tourisme-affaires",
    labelFr: "Tourisme d'affaires & MICE",
    labelEn: "Business tourism & MICE",
    descFr: "Hôtellerie d'affaires, congrès, événementiel professionnel, salons.",
    descEn: "Business hotels, conferences, professional events, trade shows.",
    categorie: "culture_creatif",
  },
  {
    slug: "arts-creatif-design",
    labelFr: "Arts, design & jeu vidéo",
    labelEn: "Arts, design & gaming",
    descFr: "Studios design, agences créatives, jeu vidéo, animation, métiers d'art.",
    descEn: "Design studios, creative agencies, gaming, animation, craft trades.",
    categorie: "culture_creatif",
  },

  // ─── Public / recherche ─────────────────────────────────────────────
  {
    slug: "enseignement-recherche",
    labelFr: "Enseignement supérieur & recherche",
    labelEn: "Higher education & research",
    descFr: "Universités, grandes écoles, organismes de recherche publique, R&D.",
    descEn: "Universities, grandes écoles, public research bodies, R&D.",
    categorie: "public_recherche",
  },
  {
    slug: "administration-publique",
    labelFr: "Administration publique",
    labelEn: "Public administration",
    descFr: "Collectivités, services publics, opérateurs étatiques, défense administrative.",
    descEn: "Local authorities, public services, state operators, administrative defense.",
    categorie: "public_recherche",
  },
] as const;

/** Set des slugs valides (pour validation runtime kbSectorTags). */
export const KB_SECTOR_TAG_SLUGS: ReadonlySet<string> = new Set(KB_SECTOR_TAGS.map((t) => t.slug));

export function getSectorTag(slug: string): KbSectorTag | undefined {
  return KB_SECTOR_TAGS.find((t) => t.slug === slug);
}

export function isValidSectorTagSlug(slug: string): boolean {
  return KB_SECTOR_TAG_SLUGS.has(slug);
}

export function getSectorTagsByCategorie(
  categorie: KbSectorTag["categorie"],
): ReadonlyArray<KbSectorTag> {
  return KB_SECTOR_TAGS.filter((t) => t.categorie === categorie);
}
