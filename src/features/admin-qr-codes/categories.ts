// Catégories de QR codes — servent de sous-onglets dans l'admin pour
// retrouver facilement les QR par usage (catalogue, avis, …).

export const QR_CATEGORIES = [
  { value: "catalogue-formations", label: "Catalogue formations" },
  { value: "avis-catalogue", label: "Avis catalogue" },
  { value: "general", label: "Général" },
] as const;

export type QrCategory = (typeof QR_CATEGORIES)[number]["value"];

export const QR_CATEGORY_VALUES = QR_CATEGORIES.map((c) => c.value) as [
  QrCategory,
  ...QrCategory[],
];

export function qrCategoryLabel(value: string): string {
  return QR_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
