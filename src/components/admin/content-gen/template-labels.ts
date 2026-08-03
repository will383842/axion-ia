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
