// Libellé humain d'un type d'intervention (valeur enum Prisma OU slug) pour la
// console d'admin (audit 2026-06-12 — remplace l'affichage de l'enum brut
// `ia_fondamentaux` par « IA Fondamentaux · 1 j » dans toutes les vues admin).
//
// SSOT : réutilise les `labelFr` du booking-catalog (qui incluent DÉJÀ la durée)
// → aucune duplication, aucun drift. Fallback pour les slugs legacy (anciennes
// offres, bookings historiques absents du catalogue V2) + prettify de sûreté.
//
// Données pures (pas de server-only) : utilisable en composant serveur ET client.

import { BOOKING_CATALOG } from "@/content/booking-catalog";

const LABEL_BY_SLUG: ReadonlyMap<string, string> = new Map(
  BOOKING_CATALOG.flatMap((c) => c.formats).map((f) => [f.slug, f.labelFr]),
);

// Anciennes offres — historiques, absentes du booking-catalog V2.
const LEGACY_LABELS: Readonly<Record<string, string>> = {
  essentielle: "Formation Essentielle",
  approfondie: "Formation Approfondie",
  conference: "Conférence",
  dirigeants: "Journée dirigeant",
  "gagner-du-temps": "Gagner du temps avec l'IA",
  "intervention-claude": "Intervention 100 % Claude",
  "demarrage-ia-express": "Démarrage IA Express",
};

function prettify(slug: string): string {
  const s = slug.replace(/-/g, " ").trim();
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
}

/**
 * Convertit un type d'intervention (valeur enum Postgres snake_case OU slug
 * kebab-case) en libellé humain affichable.
 * Ex. `ia_fondamentaux` → « IA Fondamentaux · 1 j ».
 */
export function interventionTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const slug = value.replace(/_/g, "-");
  return LABEL_BY_SLUG.get(slug) ?? LEGACY_LABELS[slug] ?? prettify(slug);
}
