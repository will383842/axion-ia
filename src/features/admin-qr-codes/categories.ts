// Catégories de QR codes — elles servent de sous-onglets dans la BARRE LATÉRALE
// de l'admin (pas dans l'en-tête de page), chacune sur sa propre route.
//
// ⚠️ Ne JAMAIS renommer une `value` : elle est stockée telle quelle en base
// (colonne VARCHAR libre, aucune contrainte SQL) et surtout, les QR déjà
// IMPRIMÉS y sont rattachés. Un renommage laisserait des lignes orphelines,
// invisibles dans les filtres. Les `label` et `route`, eux, sont libres.

export const QR_CATEGORIES = [
  {
    value: "catalogue-en-ligne",
    label: "QR du catalogue",
    route: "catalogue",
    catalogue: true,
    description:
      "Le QR unique qui ouvre le catalogue complet à feuilleter en ligne. C'est celui qu'on imprime au colophon et qu'un dirigeant transmet à un associé.",
  },
  {
    value: "avis-catalogue",
    label: "QR avis du catalogue",
    route: "avis",
    catalogue: true,
    description:
      "Les QR des interviews filmées de clients, imprimés sur la double-page témoignages.",
  },
  {
    value: "catalogue-formations",
    label: "QR dans le catalogue",
    route: "pages",
    catalogue: true,
    description:
      "Un QR par double-page produit : formations, séminaire, coaching, audits, implémentations, plus la 4e de couverture.",
  },
  {
    value: "general",
    label: "Général",
    route: "general",
    catalogue: false,
    description: "Tout ce qui ne relève pas du catalogue imprimé.",
  },
] as const;

export type QrCategory = (typeof QR_CATEGORIES)[number]["value"];

export const QR_CATEGORY_VALUES = QR_CATEGORIES.map((c) => c.value) as [
  QrCategory,
  ...QrCategory[],
];

/** Les seules catégories rattachées au catalogue imprimé, dans l'ordre des sous-onglets. */
export const QR_CATALOGUE_CATEGORIES = QR_CATEGORIES.filter((c) => c.catalogue);

export function qrCategoryLabel(value: string): string {
  return QR_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function qrCategoryByRoute(route: string) {
  return QR_CATEGORIES.find((c) => c.route === route);
}
