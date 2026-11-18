/**
 * V2-14 — articles EXCLUS de toute correction automatique.
 *
 * Décision de Williams (18/11/2026) : les 43 articles à témoignage ou à cas chiffré fictif
 * restent TELS QUELS, sans mention. L'outil de crible ne les corrige jamais : il les liste
 * à part, sans recommandation. La liste vient de l'audit « fausses preuves »
 * (axion-plans-prive, `geo/audit-existant/URGENT-fausses-preuves.md`, groupes A et B).
 *
 * Deux filets complémentaires, parce qu'une liste figée rate les articles que l'audit n'a pas vus :
 *   1. la liste de slugs ci-dessous (43) ;
 *   2. la détection : un article dont le texte déclenche `temoignage-axion`, `citation-temoin`
 *      ou `stat-axion`, ou dont l'adresse évoque un cas client, est traité comme exclu.
 * Dans le doute, l'article est exclu : l'outil préfère ne rien corriger.
 */

/** Slugs FR des 43 articles (28 du groupe A + 15 du groupe B). */
export const SLUGS_EXCLUS_TEMOIGNAGE: ReadonlySet<string> = new Set<string>([
  "accelerer-time-to-market-eti-ia-montfermeil",
  "accompagnement-strategie-ia-entreprise-meudon",
  "acculturation-ia-equipes-toulon",
  "audit-biais-intelligence-artificielle-yerres",
  "audit-ia-villeparisis-cas-concret-pme",
  "audit-protection-donnees-ia-entreprise-chelles",
  "certification-formation-ia-professionnelle-france-2026-roanne",
  "certification-ia-managers-bagnolet",
  "certification-ia-managers-villepinte",
  "coaching-ia-dirigeant-eaubonne-cas-concret",
  "coaching-ia-dirigeant-gonesse-cas-concret",
  "definition-ia-rh-entreprise-antibes",
  "definition-mentoring-ia-cto-programme-specialise-elancourt",
  "etude-cas-audit-ia-champigny-sur-marne",
  "etude-cas-certifications-ia-vaulx-en-velin",
  "etude-cas-e-learning-ia-troyes",
  "etude-cas-formateur-ia-certifie-saint-ouen",
  "etude-cas-formation-ia-finance-comptabilite-annemasse",
  "etude-cas-formation-ia-plessis-trevise",
  "etude-de-cas-formation-ia-grenoble",
  "formation-ia-bois-colombes-etude-cas",
  "formation-ia-dirigeants-pme-savigny-sur-orge",
  "formation-ia-lille-cas-concret-pme-commerce",
  "formation-ia-merignac-cas-concret-pme",
  "formation-ia-montrouge-cas-client",
  "formation-ia-orleans-cas-client-pme-loiret",
  "formation-ia-tassin-la-demi-lune-cas-concret",
  "optimisation-prompt-engineering-pme-ivry-sur-seine",
  "atelier-integration-ia-developpeurs-web-colmar",
  "audit-ia-bourgoin-jallieu",
  "coach-ia-paris-dirigeant-pavillons-sous-bois",
  "definition-prompt-engineering-audit-entreprise-champs-sur-marne",
  "formation-ia-charenton-le-pont",
  "formation-ia-draveil-calculateur-roi",
  "formation-ia-equipe-commerciale-saint-ouen-sur-seine",
  "formation-ia-eti-programme-multi-equipes-annemasse",
  "formation-ia-gpt-fine-tuning-personnalisation-saint-herblain",
  "formation-ia-industrie-manufacturier-usine-comparatif",
  "formation-ia-le-plessis-trevise",
  "formation-ia-villeurbanne-solutions-metier",
  "ia-reduction-temps-recrutement",
  "pourquoi-auditer-avant-implementer-ia",
  "roi-ia-cabinet-comptable-clichy",
]);

/** Codes de la doctrine qui signalent un témoignage ou un cas chiffré présenté comme réel. */
export const CODES_TEMOIGNAGE: ReadonlySet<string> = new Set<string>([
  "temoignage-axion",
  "citation-temoin",
  "stat-axion",
]);

/** Adresse qui évoque un cas client ou une étude de cas. */
export function slugEvoqueUnCas(slug: string): boolean {
  return /(^|-)(cas-(concret|client)|etudes?-de?-cas|etude-cas|temoignage)(-|$)/.test(slug);
}

export type RaisonExclusion = "liste-43" | "detecte-temoignage" | "adresse-cas";

/** Pourquoi l'article est exclu de toute correction, ou `null` s'il ne l'est pas. */
export function raisonExclusion(
  slug: string,
  codesDetectes: Iterable<string>,
): RaisonExclusion | null {
  if (SLUGS_EXCLUS_TEMOIGNAGE.has(slug)) return "liste-43";
  for (const c of codesDetectes) if (CODES_TEMOIGNAGE.has(c)) return "detecte-temoignage";
  if (slugEvoqueUnCas(slug)) return "adresse-cas";
  return null;
}
