/**
 * Keyword Templates — Géolocalisation 2100 villes (Phase 6 Sprint Perfection 2026-05-22)
 *
 * Deux modes :
 *  1. Seeds en dur (top 100 villes) → déjà dans les fichiers g1c/g2c/etc. via intent "local"
 *  2. Templates à la volée (villes 100-2100) → `generateGeoKeywords()` appelé par keyword-selector
 *
 * Usage :
 *   const kws = generateGeoKeywords('audits', { name: 'Rennes', regionName: 'Bretagne' });
 *   // → ["audit IA Rennes", "audit intelligence artificielle Rennes PME", ...]
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CityRef {
  readonly name: string;
  readonly regionName: string;
  readonly departmentName?: string;
  readonly inseeCode?: string;
}

export interface GeoKeywordContext {
  readonly city: CityRef;
  readonly vertical: string;
  readonly target?: "tpe" | "pme" | "eti" | undefined;
}

// ── Templates par verticale ───────────────────────────────────────────────────

const GEO_TEMPLATES_BY_VERTICAL: Readonly<Record<string, readonly string[]>> = {
  audits: [
    "audit IA {city}",
    "audit intelligence artificielle {city} {target}",
    "cabinet audit IA {city}",
    "consultant audit IA {region}",
    "diagnostic IA entreprise {city}",
    "audit RGPD IA {city}",
    "cabinet conseil IA {city} entreprise",
  ],

  interventions_formations: [
    "formation IA {city}",
    "formation intelligence artificielle {target} {city}",
    "cours IA {city} entreprise",
    "formation IA {region}",
    "formation prompt engineering {city}",
    "atelier IA {city} {target}",
    "conférence IA {city} entreprise",
  ],

  un_a_un: [
    "coaching IA dirigeant {city}",
    "accompagnement IA {target} {city}",
    "mentor IA dirigeant {region}",
    "coach IA {city}",
    "consulting IA individuel {city}",
  ],

  implementations: [
    "implémentation IA {city} entreprise",
    "intégrateur IA {city} {target}",
    "développement IA {city}",
    "chatbot IA {city} {target}",
    "automatisation IA {region}",
  ],

  sites_web_augmentes: [
    "agence SEO IA {city}",
    "création site web IA {city}",
    "référencement IA {city} {target}",
    "agence web IA {region}",
    "AEO GEO {city} entreprise",
  ],
};

/** Templates transversaux (toutes verticales) */
const GEO_TEMPLATES_TRANSVERSAL: readonly string[] = [
  "prestataire IA {city}",
  "cabinet IA {city} {target}",
  "expert IA {region}",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyTemplate(template: string, ctx: GeoKeywordContext): string {
  const target = ctx.target ?? "entreprise";
  return template
    .replace("{city}", ctx.city.name)
    .replace("{region}", ctx.city.regionName)
    .replace("{target}", target)
    .replace("{dept}", ctx.city.departmentName ?? ctx.city.regionName)
    .trim();
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Génère des keywords géo à la volée pour une ville + verticale donnée.
 *
 * Utilisé par le keyword-selector pour les villes tier 3/4 (100-2100).
 * Les 100 premières villes ont leurs seeds en dur dans les fichiers g1c-audit-clusters.ts etc.
 *
 * @returns Liste de keywords géo pour cette ville/verticale (jamais vide — fallback transversal)
 */
export function generateGeoKeywords(
  vertical: string,
  city: CityRef,
  target?: "tpe" | "pme" | "eti",
): string[] {
  const ctx: GeoKeywordContext = { city, vertical, target };
  const templates = GEO_TEMPLATES_BY_VERTICAL[vertical] ?? GEO_TEMPLATES_TRANSVERSAL;

  return templates.map((t) => applyTemplate(t, ctx)).filter((kw) => kw.length >= 10);
}

/**
 * Génère keywords géo pour TOUTES les verticales d'une ville.
 * Utile pour les pages landing ville (ex: /fr/villes/paris).
 */
export function generateAllVerticalGeoKeywords(
  city: CityRef,
  target?: "tpe" | "pme" | "eti" | undefined,
): Readonly<Record<string, string[]>> {
  const verticals = Object.keys(GEO_TEMPLATES_BY_VERTICAL);
  const result: Record<string, string[]> = {};
  for (const vertical of verticals) {
    result[vertical] = generateGeoKeywords(vertical, city, target);
  }
  return result;
}

/**
 * Sélectionne un keyword géo non encore utilisé parmi les templates.
 *
 * Round-robin sur les templates pour maximiser la diversité.
 * Incrément externe via `usedIndex` pour éviter les doublons entre appels.
 */
export function selectGeoKeyword(
  vertical: string,
  city: CityRef,
  usedIndex: number,
  target?: "tpe" | "pme" | "eti" | undefined,
): string {
  const kws = generateGeoKeywords(vertical, city, target);
  if (kws.length === 0) return `${vertical} IA ${city.name}`;
  return kws[usedIndex % kws.length]!;
}

/** Top 100 villes stratégiques France (Tier 1 + Tier 2) pour seeds en dur */
export const TOP_100_VILLES_FRANCE: readonly CityRef[] = [
  // Tier 1 — Top 10 villes
  { name: "Paris", regionName: "Île-de-France", departmentName: "Paris" },
  { name: "Lyon", regionName: "Auvergne-Rhône-Alpes", departmentName: "Rhône" },
  {
    name: "Marseille",
    regionName: "Provence-Alpes-Côte d'Azur",
    departmentName: "Bouches-du-Rhône",
  },
  { name: "Toulouse", regionName: "Occitanie", departmentName: "Haute-Garonne" },
  { name: "Nice", regionName: "Provence-Alpes-Côte d'Azur", departmentName: "Alpes-Maritimes" },
  { name: "Nantes", regionName: "Pays de la Loire", departmentName: "Loire-Atlantique" },
  { name: "Bordeaux", regionName: "Nouvelle-Aquitaine", departmentName: "Gironde" },
  { name: "Strasbourg", regionName: "Grand Est", departmentName: "Bas-Rhin" },
  { name: "Lille", regionName: "Hauts-de-France", departmentName: "Nord" },
  { name: "Rennes", regionName: "Bretagne", departmentName: "Ille-et-Vilaine" },
  // Tier 2 — Villes 11-50
  { name: "Montpellier", regionName: "Occitanie", departmentName: "Hérault" },
  { name: "Reims", regionName: "Grand Est", departmentName: "Marne" },
  { name: "Toulon", regionName: "Provence-Alpes-Côte d'Azur", departmentName: "Var" },
  { name: "Grenoble", regionName: "Auvergne-Rhône-Alpes", departmentName: "Isère" },
  { name: "Dijon", regionName: "Bourgogne-Franche-Comté", departmentName: "Côte-d'Or" },
  { name: "Angers", regionName: "Pays de la Loire", departmentName: "Maine-et-Loire" },
  { name: "Nîmes", regionName: "Occitanie", departmentName: "Gard" },
  { name: "Villeurbanne", regionName: "Auvergne-Rhône-Alpes", departmentName: "Rhône" },
  {
    name: "Aix-en-Provence",
    regionName: "Provence-Alpes-Côte d'Azur",
    departmentName: "Bouches-du-Rhône",
  },
  { name: "Brest", regionName: "Bretagne", departmentName: "Finistère" },
  { name: "Le Havre", regionName: "Normandie", departmentName: "Seine-Maritime" },
  { name: "Amiens", regionName: "Hauts-de-France", departmentName: "Somme" },
  { name: "Rouen", regionName: "Normandie", departmentName: "Seine-Maritime" },
  { name: "Clermont-Ferrand", regionName: "Auvergne-Rhône-Alpes", departmentName: "Puy-de-Dôme" },
  { name: "Caen", regionName: "Normandie", departmentName: "Calvados" },
  { name: "Mulhouse", regionName: "Grand Est", departmentName: "Haut-Rhin" },
  { name: "Nancy", regionName: "Grand Est", departmentName: "Meurthe-et-Moselle" },
  { name: "Orléans", regionName: "Centre-Val de Loire", departmentName: "Loiret" },
  { name: "Metz", regionName: "Grand Est", departmentName: "Moselle" },
  { name: "Tours", regionName: "Centre-Val de Loire", departmentName: "Indre-et-Loire" },
  { name: "Besançon", regionName: "Bourgogne-Franche-Comté", departmentName: "Doubs" },
  { name: "Roubaix", regionName: "Hauts-de-France", departmentName: "Nord" },
  { name: "Perpignan", regionName: "Occitanie", departmentName: "Pyrénées-Orientales" },
  { name: "Avignon", regionName: "Provence-Alpes-Côte d'Azur", departmentName: "Vaucluse" },
  { name: "Versailles", regionName: "Île-de-France", departmentName: "Yvelines" },
  { name: "Boulogne-Billancourt", regionName: "Île-de-France", departmentName: "Hauts-de-Seine" },
  { name: "Mérignac", regionName: "Nouvelle-Aquitaine", departmentName: "Gironde" },
  { name: "Nanterre", regionName: "Île-de-France", departmentName: "Hauts-de-Seine" },
  { name: "Argenteuil", regionName: "Île-de-France", departmentName: "Val-d'Oise" },
  { name: "Montreuil", regionName: "Île-de-France", departmentName: "Seine-Saint-Denis" },
  // Tier 2 — Villes 51-100
  { name: "Saint-Denis", regionName: "Île-de-France", departmentName: "Seine-Saint-Denis" },
  { name: "Vitry-sur-Seine", regionName: "Île-de-France", departmentName: "Val-de-Marne" },
  { name: "Creil", regionName: "Hauts-de-France", departmentName: "Oise" },
  { name: "Pau", regionName: "Nouvelle-Aquitaine", departmentName: "Pyrénées-Atlantiques" },
  { name: "Limoges", regionName: "Nouvelle-Aquitaine", departmentName: "Haute-Vienne" },
  { name: "Chambéry", regionName: "Auvergne-Rhône-Alpes", departmentName: "Savoie" },
  { name: "Annecy", regionName: "Auvergne-Rhône-Alpes", departmentName: "Haute-Savoie" },
  { name: "Quimper", regionName: "Bretagne", departmentName: "Finistère" },
  { name: "Lorient", regionName: "Bretagne", departmentName: "Morbihan" },
  { name: "Valence", regionName: "Auvergne-Rhône-Alpes", departmentName: "Drôme" },
  { name: "Bayonne", regionName: "Nouvelle-Aquitaine", departmentName: "Pyrénées-Atlantiques" },
  { name: "Poitiers", regionName: "Nouvelle-Aquitaine", departmentName: "Vienne" },
  { name: "La Rochelle", regionName: "Nouvelle-Aquitaine", departmentName: "Charente-Maritime" },
  { name: "Caen", regionName: "Normandie", departmentName: "Calvados" },
  { name: "Dunkerque", regionName: "Hauts-de-France", departmentName: "Nord" },
  { name: "Antibes", regionName: "Provence-Alpes-Côte d'Azur", departmentName: "Alpes-Maritimes" },
  { name: "Cannes", regionName: "Provence-Alpes-Côte d'Azur", departmentName: "Alpes-Maritimes" },
  { name: "Saint-Nazaire", regionName: "Pays de la Loire", departmentName: "Loire-Atlantique" },
  { name: "Colmar", regionName: "Grand Est", departmentName: "Haut-Rhin" },
  { name: "Troyes", regionName: "Grand Est", departmentName: "Aube" },
  { name: "Chartres", regionName: "Centre-Val de Loire", departmentName: "Eure-et-Loir" },
  { name: "Saint-Étienne", regionName: "Auvergne-Rhône-Alpes", departmentName: "Loire" },
  { name: "Toulon", regionName: "Provence-Alpes-Côte d'Azur", departmentName: "Var" },
  { name: "Montauban", regionName: "Occitanie", departmentName: "Tarn-et-Garonne" },
  { name: "Chambéry", regionName: "Auvergne-Rhône-Alpes", departmentName: "Savoie" },
  { name: "Metz", regionName: "Grand Est", departmentName: "Moselle" },
  { name: "Hyères", regionName: "Provence-Alpes-Côte d'Azur", departmentName: "Var" },
  { name: "Roubaix", regionName: "Hauts-de-France", departmentName: "Nord" },
  { name: "Tourcoing", regionName: "Hauts-de-France", departmentName: "Nord" },
  { name: "Béziers", regionName: "Occitanie", departmentName: "Hérault" },
  { name: "Ajaccio", regionName: "Corse", departmentName: "Corse-du-Sud" },
  { name: "Noisy-le-Grand", regionName: "Île-de-France", departmentName: "Seine-Saint-Denis" },
  { name: "Levallois-Perret", regionName: "Île-de-France", departmentName: "Hauts-de-Seine" },
  { name: "Neuilly-sur-Seine", regionName: "Île-de-France", departmentName: "Hauts-de-Seine" },
  { name: "Cergy", regionName: "Île-de-France", departmentName: "Val-d'Oise" },
  { name: "Évry-Courcouronnes", regionName: "Île-de-France", departmentName: "Essonne" },
  { name: "Issy-les-Moulineaux", regionName: "Île-de-France", departmentName: "Hauts-de-Seine" },
  { name: "Courbevoie", regionName: "Île-de-France", departmentName: "Hauts-de-Seine" },
  { name: "Saint-Maur-des-Fossés", regionName: "Île-de-France", departmentName: "Val-de-Marne" },
  { name: "Aulnay-sous-Bois", regionName: "Île-de-France", departmentName: "Seine-Saint-Denis" },
  { name: "Asnières-sur-Seine", regionName: "Île-de-France", departmentName: "Hauts-de-Seine" },
  { name: "Rueil-Malmaison", regionName: "Île-de-France", departmentName: "Hauts-de-Seine" },
  { name: "Colombes", regionName: "Île-de-France", departmentName: "Hauts-de-Seine" },
  { name: "Créteil", regionName: "Île-de-France", departmentName: "Val-de-Marne" },
  { name: "Massy", regionName: "Île-de-France", departmentName: "Essonne" },
  { name: "Cholet", regionName: "Pays de la Loire", departmentName: "Maine-et-Loire" },
  { name: "Rouen", regionName: "Normandie", departmentName: "Seine-Maritime" },
  { name: "Brive-la-Gaillarde", regionName: "Nouvelle-Aquitaine", departmentName: "Corrèze" },
  { name: "Châlons-en-Champagne", regionName: "Grand Est", departmentName: "Marne" },
  { name: "Niort", regionName: "Nouvelle-Aquitaine", departmentName: "Deux-Sèvres" },
];
