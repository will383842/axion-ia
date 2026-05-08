// SSOT branding — Sprint cert 14.x (2026-05-08).
// Toute mention publique de la marque doit dériver d'ici, jamais hardcoder.
// Naming canonique acté Will 2026-05-08 : « Axion-IA » (avec tiret, IA majuscule)
// — aligné sur le repo + domaine `axion-ia.com` + ADR 0009 hosting.
//
// Si un jour la marque change (ex. ajout suffixe juridique, traduction tagline),
// patcher uniquement ce fichier. La doctrine SSOT « code = vérité » garantit
// que toutes les pages, JSON-LD, OG images, manifest dérivent de ces constantes.

import { env } from "@/env";

export const BRAND = {
  /** Nom canonique customer-facing (logo, header, JSON-LD `name`, OG, titles). */
  name: "Axion-IA",
  /** Raison sociale juridique pour mentions légales / OÜ Estonia. */
  legalName: "Axion-IA OÜ",
  /** Tagline FR utilisée dans subtitles, hero descriptions, OG, JSON-LD `description`. */
  taglineFr: "cabinet IA opérationnel",
  /** Tagline EN équivalent. */
  taglineEn: "operational AI consultancy",
  /** URL canonique du site (déduite de env, jamais hardcodée). */
  url: env.NEXT_PUBLIC_SITE_URL,
  /**
   * Slug technique du package npm (sans tiret, sans IA majuscule).
   * Utilisé uniquement pour les imports techniques / lockfile / package.json.
   * NE PAS afficher côté UI.
   */
  packageSlug: "axionia",
} as const;

export type Brand = typeof BRAND;
