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

/** Requête fixe : ramène toujours les fiches de l'offre. */
const REQUETE_OFFRE = "Journée IA prix garantie présentiel déplacement acompte";

export const rechercherFichesPertinentes: DependancesFideliteLlm["rechercherFiches"] = async ({
  output,
  kbEntryIds,
}) => {
  const o = (output ?? {}) as { title?: string };
  // 1. Fiches de l'offre : TOUJOURS en tête. Sans elles, impossible de contrôler prix,
  //    garantie ou déplacement : on échoue franchement (fail-closed → relecture).
  const offre = await retrieveAvecMode({
    query: REQUETE_OFFRE,
    locale: "fr",
    k: 4,
    mode: "hybrid",
  });
  const ordre: string[] = [];
  const ajouter = (id: string) => {
    if (!ordre.includes(id)) ordre.push(id);
  };
  for (const c of offre.chunks) ajouter(c.entryId);
  if (ordre.length === 0) throw new Error("aucune fiche de l'offre retrouvée");
  // 2. Fiches qui ont nourri le texte, puis recherche sur le titre.
  for (const id of kbEntryIds ?? []) ajouter(id);
  const titre = (o.title ?? "").trim();
  if (titre.length > 0) {
    const r = await retrieveAvecMode({ query: titre, locale: "fr", k: 6, mode: "hybrid" });
    for (const c of r.chunks) ajouter(c.entryId);
  }
  const retenus = ordre.slice(0, MAX_FICHES);
  const lignes = await prisma.knowledgeTranslation.findMany({
    where: {
      entryId: { in: retenus },
      locale: "fr",
      entry: { status: "published", deletedAt: null },
    },
    select: { entryId: true, title: true, body: true, bodyText: true },
  });
  // Ordre déterministe : celui de la recherche (offre d'abord).
  lignes.sort((x, y) => retenus.indexOf(x.entryId) - retenus.indexOf(y.entryId));
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
