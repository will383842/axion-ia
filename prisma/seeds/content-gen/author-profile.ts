/**
 * Seed AuthorProfile — 1 row Manon (Q13 résolu 2026-05-14).
 *
 * Doctrine v2.1 (manon-person.md) — portrait IA disclosed + zéro réseau social :
 * - Photo `/auteurs/manon.png` (1.5 MB, 1024×1024 PNG IA-generated)
 * - `aiGenerated: true`
 * - `photoAlt` canonique disclaimer IA explicite
 * - `linkedinUrl: null`, `twitterHandle: null` (TOUJOURS — pas de balise twitter:creator)
 * - `alumniOf: null`, `awards: []` (persona fictive)
 * - `isPersona: true`, `personaDisclaimer` enrichi mention IA
 *
 * Bio validée OK tel quel par Will (cf. seed `_AUDIT/seeds-templates/manon-profile.md` § 3).
 */

import type { PrismaClient } from "../../generated/client";

const MANON_BIO_MD = `**Manon** est la plume éditoriale d'Axion-IA — persona éditoriale fictive transparente sous laquelle signe notre équipe de rédaction et notre processus de production IA supervisé.

Son portrait visuel est une illustration générée par IA. Tous les contenus tier-1 sont validés par notre relecture humaine avant publication.

Manon écrit sur l'intelligence artificielle opérationnelle, l'audit IA en entreprise, la transformation digitale PME / ETI / grands groupes, l'implémentation IA custom, l'AEO et le SEO 2026, l'automatisation des processus métiers, la méthodologie Axion-IA, et la conduite du changement IA.

Sa signature couvre quatre formats : landings villes, articles blog, comparatifs outils, guides piliers, FAQ standalone et Q/R post-process.`;

const MANON_PERSONA_DISCLAIMER = `Manon est une persona éditoriale fictive d'Axion-IA. Son portrait visuel est une illustration générée par IA. Les contenus signés sous son nom sont produits par notre équipe + processus IA supervisé. Tous nos contenus tier-1 (sitemap public) sont validés par relecture humaine avant publication.`;

const MANON_PHOTO_ALT =
  "Manon — portrait synthétique généré par IA, plume éditoriale fictive d'Axion-IA";

export async function seedAuthorProfile(
  prisma: PrismaClient,
): Promise<{ slug: string; aiGenerated: boolean }> {
  const row = await prisma.authorProfile.upsert({
    where: { slug: "manon" },
    create: {
      slug: "manon",
      displayName: "Manon",
      jobTitle: "Plume éditoriale d'Axion-IA",
      bioMd: MANON_BIO_MD,
      photoUrl80: "/auteurs/manon.png",
      photoUrl256: "/auteurs/manon.png",
      photoUrl1024: "/auteurs/manon.png",
      photoAlt: MANON_PHOTO_ALT,
      aiGenerated: true,
      linkedinUrl: null,
      twitterHandle: null,
      alumniOf: null,
      awards: [],
      knowsAbout: [
        "Intelligence artificielle opérationnelle",
        "Audit IA en entreprise",
        "Transformation digitale PME ETI grands groupes",
        "Implémentation IA custom",
        "AEO et SEO 2026",
        "Automatisation des processus métiers",
        "Méthodologie Axion-IA",
        "Conduite du changement IA",
      ],
      isPersona: true,
      personaDisclaimer: MANON_PERSONA_DISCLAIMER,
      isActive: true,
    },
    update: {
      // Synchronise tout sauf bio (Will peut éditer admin /content-gen/author/manon).
      displayName: "Manon",
      jobTitle: "Plume éditoriale d'Axion-IA",
      photoUrl80: "/auteurs/manon.png",
      photoUrl256: "/auteurs/manon.png",
      photoUrl1024: "/auteurs/manon.png",
      photoAlt: MANON_PHOTO_ALT,
      aiGenerated: true,
      linkedinUrl: null,
      twitterHandle: null,
      isPersona: true,
      isActive: true,
    },
  });
  return { slug: row.slug, aiGenerated: row.aiGenerated };
}
