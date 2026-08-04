/**
 * Libellés français des enums de modèles de génération.
 *
 * 🔴 CES TABLES EXISTAIENT DÉJÀ — dans `TemplateNewFormWrapper.tsx`, le
 * formulaire de CRÉATION. Le formulaire d'ÉDITION, lui, affichait les valeurs
 * d'enum brutes : la même donnée se lisait « Blog depuis un flux RSS » à la
 * création et `blog_from_rss` à la modification, dans deux écrans reliés par un
 * simple clic. Une table de libellés qui ne vit que dans un composant finit
 * toujours par ne servir qu'à ce composant.
 *
 * Les valeurs (clés) restent les enums Prisma : rien ne change en base.
 */

/** Libellé d'un type de contenu. Une valeur inconnue est CITÉE, jamais maquillée. */
export const CONTENT_TYPE_LABEL_FR: Record<string, string> = {
  landing_ville: "Page ville",
  blog_article: "Article de blog",
  blog_from_title: "Blog depuis un titre",
  blog_from_keywords: "Blog depuis des mots-clés",
  blog_from_rss: "Blog depuis un flux RSS",
  comparison: "Comparatif",
  guide_pilier: "Guide pilier",
  qa_derived: "Question-réponse dérivée",
  faq_standalone: "FAQ autonome",
};

export const EXPANSION_MODE_LABEL_FR: Record<string, string> = {
  manual: "Manuel",
  all_villes: "Toutes les villes",
  all_regions: "Toutes les régions",
  custom_villes: "Villes personnalisées",
  from_keywords: "Depuis des mots-clés",
  from_questions: "Depuis des questions",
  from_rss_items: "Depuis des éléments RSS",
  from_csv: "Depuis un CSV",
};

export function libelleTypeContenu(valeur: string): string {
  return CONTENT_TYPE_LABEL_FR[valeur] ?? `« ${valeur} »`;
}

export function libelleModeExpansion(valeur: string): string {
  return EXPANSION_MODE_LABEL_FR[valeur] ?? `« ${valeur} »`;
}

/**
 * Nom affiché des neuf modèles livrés avec l'application.
 *
 * 🔴 Le filtre « Type » de la liste des jobs est entièrement en français
 * (« Article depuis mots-clés », « Article depuis une actu (RSS) »…) et le
 * filtre juste en dessous, qui nomme LES MÊMES contenus, était en anglais :
 * « Blog from keywords », « Blog from RSS NewsArticle », « Blog from manual
 * title », « Landing ville (default) ». Deux listes déroulantes voisines
 * décrivant la même chose dans deux langues.
 *
 * Ces noms viennent de la colonne `name` en base, posée par le seed. Les
 * corriger dans le seed ne suffit pas : le seed ne rejoue pas à chaque
 * déploiement, donc les lignes déjà en production garderaient l'anglais. On
 * traduit donc à l'AFFICHAGE, indexé par `slug` — la seule clé stable (le
 * `name`, lui, est modifiable par l'utilisateur).
 *
 * Un modèle créé à la main garde son nom tel quel : cette table ne couvre que
 * les neuf slugs livrés.
 */
export const TEMPLATE_NAME_BY_SLUG_FR: Record<string, string> = {
  "landing-ville-default-v1": "Page ville (par défaut)",
  "blog-article-v1": "Article de blog générique",
  "blog-from-rss-v1": "Article depuis une actualité (RSS)",
  "blog-from-keywords-v1": "Article depuis des mots-clés",
  "blog-from-title-v1": "Article depuis un titre saisi",
  "comparison-v1": "Comparatif d'outils et de services",
  "guide-pilier-v1": "Guide pilier (contenu de fond)",
  "qa-derived-v1": "Question-réponse dérivée (automatique)",
  "faq-standalone-v1": "FAQ autonome (page dédiée)",
};

/**
 * Nom d'une instruction IA — le mot de la barre de navigation
 * (« Instructions IA (prompts) »), que les pages disaient « template ».
 *
 * Un slug hors des neuf livrés retombe sur le nom saisi : c'est celui que
 * l'utilisateur a écrit lui-même, on ne le réinvente pas.
 */
export function libelleInstructionIA(slug: string, nomEnBase: string): string {
  return TEMPLATE_NAME_BY_SLUG_FR[slug] ?? nomEnBase;
}
