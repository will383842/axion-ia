// Catégories de QR codes — elles servent de sous-onglets dans la BARRE LATÉRALE
// de l'admin (pas dans l'en-tête de page), chacune sur sa propre route.
//
// ⚠️ Ne JAMAIS renommer une `value` : elle est stockée telle quelle en base
// (colonne VARCHAR libre, aucune contrainte SQL) et surtout, les QR déjà
// IMPRIMÉS y sont rattachés. Un renommage laisserait des lignes orphelines,
// invisibles dans les filtres. Les `label`, `route` et `icon`, eux, sont libres.
//
// ── Ce fichier est le SSOT des sous-onglets ──────────────────────────────────
// `buildAdminNav()` DÉRIVE ses entrées de niveau 2 de cette liste ; il ne les
// recopie plus. Avant le 2026-08-17, les libellés existaient en double, et la
// catégorie « general » déclarait une `route` sans page ni entrée de menu : les
// deux QR de la carte de visite n'avaient aucun tiroir et n'apparaissaient que
// dans la liste racine, noyés parmi 45 QR de catalogue. Personne ne l'avait vu
// parce qu'il fallait comparer trois fichiers pour s'en apercevoir.
//
// Ajouter une catégorie = ajouter une entrée ICI **et** créer sa page
// `src/app/[locale]/(admin)/[adminPrefix]/qr-codes/<route>/page.tsx`.
// `categories.spec.ts` refuse une route sans page — il lit le disque.

export const QR_CATEGORIES = [
  {
    value: "catalogue-en-ligne",
    // « Catalogue en ligne » et non « QR du catalogue » : l'ancien libellé se
    // distinguait de « QR dans le catalogue » par une seule préposition, pour
    // deux choses opposées — le QR qui MÈNE au catalogue contre les QU'ON Y
    // IMPRIME. Le préfixe « QR » est retiré partout : on est dans la section
    // QR, il ne distinguait rien.
    label: "Catalogue en ligne",
    route: "catalogue",
    icon: "BookOpen",
    catalogue: true,
    description:
      "Le QR unique qui ouvre le catalogue complet à feuilleter en ligne. C'est celui qu'on imprime au colophon et qu'un dirigeant transmet à un associé.",
  },
  {
    value: "avis-catalogue",
    label: "Avis du catalogue",
    route: "avis",
    icon: "Quote",
    catalogue: true,
    description:
      "Les QR des interviews filmées de clients, imprimés sur la double-page témoignages.",
  },
  {
    value: "catalogue-formations",
    label: "Pages du catalogue",
    route: "pages",
    // Pas « QrCode » : le parent « QR codes & liens » la porte déjà, et deux
    // entrées du même groupe avec la même icône sont indistinguables dans la
    // barre latérale (garde-fou admin-nav-icons.test.ts).
    icon: "Tags",
    catalogue: true,
    description:
      "Un QR par double-page produit : formations, séminaire, coaching, audits, implémentations, plus la 4e de couverture.",
  },
  {
    value: "general",
    label: "Carte de visite & divers",
    route: "general",
    icon: "IdCard",
    catalogue: false,
    description:
      "Tout ce qui ne relève pas du catalogue imprimé — au premier chef les deux QR de la carte de visite : « Enregistrer mon contact » (vc) et WhatsApp (wa).",
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
