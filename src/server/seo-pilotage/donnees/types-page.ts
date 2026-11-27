/**
 * Type de page d'après le chemin. Module PUR.
 *
 * `site-explorer/categories.ts` n'a ni faq, ni guide, ni actualité : cette table par
 * préfixe de segment est écrite une fois ici. Le test `types-page.spec.ts` la confronte à
 * `categorizeRoute` pour qu'elle ne diverge jamais.
 */

export const TYPES_PAGE = [
  "article",
  "actualite",
  "guide",
  "ville",
  "offre",
  "faq",
  "institutionnel",
  "conversion",
  "galerie",
  "autre",
] as const;

export type TypePage = (typeof TYPES_PAGE)[number];

/** Premier segment (après la langue) → type. Segment exact, jamais un simple préfixe de texte. */
const PAR_SEGMENT: Readonly<Record<string, TypePage>> = {
  // Contenu éditorial
  blog: "article",
  connaissances: "article",
  ressources: "article",
  glossaire: "article",
  "cas-concrets": "article",
  comparaisons: "article",
  actualites: "actualite",
  guides: "guide",
  presse: "institutionnel",
  // Aide
  faq: "faq",
  "centre-aide": "faq",
  // Villes
  implantations: "ville",
  // Offres (catégorie « commercial »)
  audit: "offre",
  interventions: "offre",
  implementation: "offre",
  "un-a-un": "offre",
  "sites-web-augmentes": "offre",
  // Institutionnel (catégories « transversal » et « legal »)
  "a-propos": "institutionnel",
  equipe: "institutionnel",
  methodologie: "institutionnel",
  "stack-ia": "institutionnel",
  "guide-ia": "institutionnel",
  roi: "institutionnel",
  tarifs: "institutionnel",
  transparence: "institutionnel",
  "charte-editoriale": "institutionnel",
  corrections: "institutionnel",
  "sous-processeurs": "institutionnel",
  recherche: "institutionnel",
  "mentions-legales": "institutionnel",
  "conditions-generales": "institutionnel",
  "politique-confidentialite": "institutionnel",
  "politique-deplacement": "institutionnel",
  cookies: "institutionnel",
  "preferences-cookies": "institutionnel",
  rgpd: "institutionnel",
  accessibilite: "institutionnel",
  "mes-donnees": "institutionnel",
  desabonnement: "institutionnel",
  confirmation: "institutionnel",
  // Conversion
  contact: "conversion",
  "demande-devis": "conversion",
  reserver: "conversion",
  appel: "conversion",
  booking: "conversion",
  // Galerie
  galerie: "galerie",
};

/** Chemin déjà normalisé (voir `normaliserChemin`). Sans langue : le chemin est lu tel quel. */
export function typePageDepuisChemin(chemin: string): TypePage {
  const segments = chemin.toLowerCase().split("/").filter(Boolean);
  if (segments[0] === "fr" || segments[0] === "en") segments.shift();
  // Home (`/`, `/fr`) : vitrine de l'offre, comme `categorizeRoute`.
  if (segments.length === 0) return "offre";
  // Pages ville × service, rangées en « villes » par categories.ts.
  if (segments.includes("par-ville")) return "ville";
  return PAR_SEGMENT[segments[0]!] ?? "autre";
}
