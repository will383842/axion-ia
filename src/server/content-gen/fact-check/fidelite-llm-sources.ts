/**
 * Adaptateurs réels (E/S) du contrôle de fidélité par Claude : recherche des fiches
 * (recherche existante de la base) et appel au juge (modèle de relecture, via la porte
 * `blog-claude` : plafonds jour/mois, réservation et solde du coût, prompt caching).
 */

import { prisma } from "@/lib/prisma";
import { resolvePriceTokens } from "@/content/pricing-tokens";
import { retrieveAvecMode } from "../kb-client";
import { genererTexteBlogClaude } from "../providers/blog-claude";
import { MAX_FICHES, type DependancesFideliteLlm } from "./fidelite-llm";

/**
 * Fiches de la base pertinentes pour l'article (fiches qui l'ont nourri, puis recherche sur
 * le titre). Les faits de l'offre ne viennent PAS d'ici : ils sont injectés depuis la source
 * unique (`faits-offre.ts`), donc indépendants de l'état de la base. Aucune coupe : le
 * décideur compte et bloque au-delà de `MAX_FICHES`.
 */
export const rechercherFichesPertinentes: DependancesFideliteLlm["rechercherFiches"] = async ({
  output,
  kbEntryIds,
}) => {
  const o = (output ?? {}) as { title?: string };
  const ordre: string[] = [];
  const ajouter = (id: string) => {
    if (!ordre.includes(id)) ordre.push(id);
  };
  for (const id of kbEntryIds ?? []) ajouter(id);
  const titre = (o.title ?? "").trim();
  const places = MAX_FICHES - ordre.length;
  if (titre.length > 0 && places > 0) {
    const r = await retrieveAvecMode({ query: titre, locale: "fr", k: places, mode: "hybrid" });
    for (const c of r.chunks) ajouter(c.entryId);
  }
  if (ordre.length === 0) return [];
  const lignes = await prisma.knowledgeTranslation.findMany({
    where: {
      entryId: { in: ordre },
      locale: "fr",
      entry: { status: "published", deletedAt: null },
    },
    select: { entryId: true, title: true, body: true, bodyText: true },
  });
  lignes.sort((x, y) => ordre.indexOf(x.entryId) - ordre.indexOf(y.entryId));
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
