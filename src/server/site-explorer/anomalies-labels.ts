/**
 * Libellés français des anomalies SEO — SOURCE UNIQUE.
 *
 * 🔴 L'ÉCRAN DES ANOMALIES PARLAIT MACHINE. La pastille de gravité affichait
 * « high », « medium », « low » ; le type de l'anomalie sortait en monospace
 * sous la forme `duplicate_meta_title`, `no_ai_disclaimer`, `orphan_page`. Sur
 * un écran qui existe pour dire ce qui ne va pas, il fallait déjà connaître le
 * code interne pour savoir de quoi on parlait.
 *
 * Les clés sont celles réellement écrites par le détecteur
 * (`site-route-anomaly-detector-worker.ts`) — relevées dans le code, pas
 * devinées. Un type inconnu est CITÉ, jamais maquillé : si le détecteur en
 * ajoute un, l'écran le montre tel quel plutôt que de le faire disparaître.
 */

export const GRAVITE_LABELS: Record<string, string> = {
  high: "Critique",
  medium: "Moyenne",
  low: "Faible",
};

export const ANOMALIE_LABELS: Record<string, string> = {
  "404": "Page introuvable (404)",
  duplicate_meta_title: "Titre SEO en double",
  duplicate_meta_description: "Description SEO en double",
  duplicate_h1: "Titre principal (H1) en double",
  orphan_page: "Page orpheline — aucun lien interne n'y mène",
  thin_content: "Contenu trop court",
  no_jsonld: "Aucune donnée structurée",
  no_ai_disclaimer: "Mention IA absente",
  no_external_links: "Aucun lien externe",
  // Aperçu de partage — recensement OG 2026-08-17.
  og_image_absente: "Aperçu de partage sans image",
  og_image_injoignable: "Image de partage injoignable",
  og_image_trop_petite: "Image de partage trop petite pour LinkedIn",
  og_dimensions_mensongeres: "Taille d'image annoncée fausse",
  og_image_tierce: "Aperçu hébergé hors de notre domaine",
};

export function libelleGravite(gravite: string): string {
  return GRAVITE_LABELS[gravite] ?? `« ${gravite} »`;
}

export function libelleAnomalie(type: string): string {
  return ANOMALIE_LABELS[type] ?? `« ${type} »`;
}

/**
 * Type d'une route. Ces libellés existaient déjà — mais SEULEMENT dans le
 * <select> de filtre : la fiche de la route, elle, affichait `dynamic_db` brut.
 * Le filtre et le détail décrivaient donc la même donnée en deux langues.
 */
export const TYPE_ROUTE_LABELS: Record<string, string> = {
  static: "Page statique",
  dynamic_db: "Dynamique (base de données)",
  dynamic_template: "Dynamique (modèle)",
  dynamic_filesystem: "Dynamique (fichiers)",
};

export function libelleTypeRoute(type: string): string {
  return TYPE_ROUTE_LABELS[type] ?? `« ${type} »`;
}
