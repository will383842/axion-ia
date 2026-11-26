/**
 * Adaptateurs réels (E/S) du contrôle de fidélité par Claude : recherche des fiches
 * (recherche existante de la base) et appel au juge (modèle de relecture, via la porte
 * `blog-claude` : plafonds jour/mois, réservation et solde du coût, prompt caching).
 */

import { prisma } from "@/lib/prisma";
import { resolvePriceTokens } from "@/content/pricing-tokens";
import { retrieveAvecMode } from "../kb-client";
import { genererTexteBlogClaude } from "../providers/blog-claude";
import type { DependancesFideliteLlm } from "./fidelite-llm";

/** Requête fixe : ramène toujours les fiches de l'offre. */
const REQUETE_OFFRE = "Journée IA prix garantie présentiel déplacement acompte";

export const rechercherFichesPertinentes: DependancesFideliteLlm["rechercherFiches"] = async ({
  output,
  kbEntryIds,
}) => {
  const o = (output ?? {}) as { title?: string; primaryKeyword?: string };
  const requetes = [`${o.title ?? ""} ${o.primaryKeyword ?? ""}`.trim(), REQUETE_OFFRE].filter(
    (q) => q.length > 0,
  );
  const ids = new Set<string>(kbEntryIds ?? []);
  for (const query of requetes) {
    const r = await retrieveAvecMode({
      query,
      locale: "fr",
      k: query === REQUETE_OFFRE ? 4 : 6,
      mode: "hybrid",
    });
    for (const c of r.chunks) ids.add(c.entryId);
  }
  if (ids.size === 0) return [];
  const lignes = await prisma.knowledgeTranslation.findMany({
    where: {
      entryId: { in: [...ids] },
      locale: "fr",
      entry: { status: "published", deletedAt: null },
    },
    select: { entryId: true, title: true, body: true, bodyText: true },
  });
  return lignes.map((t) => ({
    id: t.entryId,
    titre: t.title,
    texte: resolvePriceTokens(t.bodyText || t.body, "fr"),
  }));
};

export const jugerAvecClaude: DependancesFideliteLlm["juger"] = async (a) => {
  const r = await genererTexteBlogClaude(
    {
      jobId: a.jobId,
      contentType: a.contentType,
      role: "text",
      systemPrompt: a.systemPrompt,
      userPrompt: a.userPrompt,
      maxTokens: 4000,
      responseFormatJson: true,
    },
    "relecture",
  );
  return { output: r.output, costUsd: r.costUsd };
};
