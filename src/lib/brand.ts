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
  /** Raison sociale juridique pour mentions légales (société française — Will précise forme SAS/SASU + SIREN). */
  legalName: "Axion-IA",
  /** Noms alternatifs Knowledge Graph / Wikidata — disambiguation vs axionai.fr. */
  alternateName: ["AxionIA", "Axion IA", "axion-ia.com"] as const,
  /** Tagline courte FR — sous-titre, JSON-LD `description`, OG. */
  taglineFr: "cabinet IA opérationnel",
  /** Tagline courte EN. */
  taglineEn: "operational AI consultancy",
  /** Slogan long FR — hero principal, meta descriptions, pitch commercial. */
  sloganFr: "De l'idée à l'impact. Un seul partenaire IA.",
  /** Slogan long EN. */
  sloganEn: "From idea to impact. One AI partner.",
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
