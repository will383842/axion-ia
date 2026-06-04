// Tool `chercher_ressource` (T-13, REQ-033, ADR-CB-09) — renvoie une ressource
// pertinente (article de blog OU cas client) PUBLIÉE : titre + URL FR + extrait.
//
// Lecture seule (jamais de mutation). FR-only (locale "fr"). Filtre statut
// `published` (jamais de brouillon/archivé). Renvoie `null` si rien de pertinent
// → l'orchestrateur n'invente jamais de lien.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ToolContext } from "@/server/chatbot/tools/rechercher-offres";

export const ChercherRessourceInputSchema = z
  .object({
    sujet: z.string().min(1).max(200),
    type: z.enum(["article", "cas_client"]),
  })
  .strict();

export type ChercherRessourceInput = z.infer<typeof ChercherRessourceInputSchema>;

export interface RessourceResult {
  readonly titre: string;
  /** URL FR canonique relative (validable par l'output-guard / isKnownFrUrl). */
  readonly url: string;
  readonly extrait: string | null;
  readonly type: "article" | "cas_client";
}

/**
 * Cherche une ressource publiée dont le titre (ou l'extrait, pour un article)
 * contient le sujet. `tenant_id` non requis : articles/cas clients sont des
 * contenus éditoriaux globaux (mono-site), pas des données par tenant.
 */
export async function chercherRessource(
  rawInput: unknown,
  _ctx: ToolContext,
): Promise<RessourceResult | null> {
  const { sujet, type } = ChercherRessourceInputSchema.parse(rawInput);

  if (type === "article") {
    const t = await prisma.articleTranslation.findFirst({
      where: {
        locale: "fr",
        article: { status: "published" },
        OR: [
          { title: { contains: sujet, mode: "insensitive" } },
          { excerpt: { contains: sujet, mode: "insensitive" } },
        ],
      },
      orderBy: { article: { publishedAt: "desc" } },
      select: { title: true, slug: true, excerpt: true },
    });
    if (!t) return null;
    return { titre: t.title, url: `/fr/blog/${t.slug}`, extrait: t.excerpt, type };
  }

  // cas_client — CaseStudyTranslation n'a pas d'extrait → null.
  const t = await prisma.caseStudyTranslation.findFirst({
    where: {
      locale: "fr",
      caseStudy: { status: "published" },
      title: { contains: sujet, mode: "insensitive" },
    },
    orderBy: { caseStudy: { publishedAt: "desc" } },
    select: { title: true, slug: true },
  });
  if (!t) return null;
  return { titre: t.title, url: `/fr/cas-concrets/${t.slug}`, extrait: null, type };
}
