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
 * Audit d'harmonie du 08/11/2026 (lot R6) : Manon est une plume IA déclarée (jamais
 * « experte » ni personne de l'équipe) ; la cible s'écrit « TPE et PME » ; la bio ne promet
 * plus une relecture humaine systématique (contrôles automatiques bloquants avant
 * publication, relecture humaine en cas d'alerte, corrections sur signalement).
 * ⚠️ Ce seed ne resynchronise PAS la bio en base (voir `update` plus bas) : la bio et le
 * disclaimer déjà enregistrés se corrigent dans la console /content-gen/author/manon.
 */

import type { PrismaClient } from "../../generated/client";

const MANON_BIO_MD = `**Manon** est la plume IA d'Axion-IA : une assistance d'IA générative, supervisée par l'équipe Axion-IA, sous le nom de laquelle sont signés nos contenus. Ce n'est pas une personne de l'équipe.

Son portrait visuel est une illustration générée par IA. Nos contenus passent des contrôles automatiques bloquants avant publication ; relecture humaine en cas d'alerte ; corrections sur signalement.

Manon écrit sur l'intelligence artificielle opérationnelle, l'audit IA en entreprise, la transformation digitale des TPE et PME, l'implémentation IA custom, l'AEO et le SEO 2026, l'automatisation des processus métiers, la méthodologie Axion-IA, et la conduite du changement IA.

Sa signature couvre quatre formats : landings villes, articles blog, comparatifs outils, guides piliers, FAQ standalone et Q/R post-process.`;

const MANON_PERSONA_DISCLAIMER = `Manon est la plume IA d'Axion-IA, pas une personne de l'équipe. Son portrait visuel est une illustration générée par IA. Les contenus signés sous son nom sont rédigés avec une IA générative, supervisée par l'équipe Axion-IA. Ils sont publiés après des contrôles automatiques bloquants ; relecture humaine en cas d'alerte ; corrections sur signalement.`;

const MANON_PHOTO_ALT = "Manon — portrait synthétique généré par IA, plume IA d'Axion-IA";

export async function seedAuthorProfile(
  prisma: PrismaClient,
): Promise<{ slug: string; aiGenerated: boolean }> {
  const row = await prisma.authorProfile.upsert({
    where: { slug: "manon" },
    create: {
      slug: "manon",
      displayName: "Manon",
      jobTitle: "Plume IA d'Axion-IA",
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
        "Transformation digitale TPE et PME",
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
      // Synchronise tout sauf bio et disclaimer (Williams peut éditer admin /content-gen/author/manon).
      // ⚠️ Conséquence : une fiche déjà en base garde son ancienne bio tant qu'elle n'est pas mise à jour dans la console.
      displayName: "Manon",
      jobTitle: "Plume IA d'Axion-IA",
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
