/**
 * Accès aux données du « chargé de liens » (PR 18) : candidats réels, oppositions, coût engagé,
 * lecture et écriture des occasions dans `ContentGenJob.outputJsonRaw.chargeLiens` (champ JSON
 * existant : aucune table, aucune migration). L'écriture FUSIONNE : les autres clés du JSON sont
 * conservées. Aucun envoi ici.
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { ficheLocale } from "@/content/villes/fiches-locales";
import type { CandidatLien, OccasionLien } from "./charge-de-liens";

export interface EntreeChargeLiens {
  readonly version: 1;
  readonly occasions: OccasionLien[];
  readonly coutUsd: number;
}

const CATEGORIES_ANNUAIRE = new Set(["cci", "technopole", "french-tech", "pole"]);

/** Candidats réels : retombées presse déjà en base, institutions des fiches locales, pages citant déjà le sujet. */
export async function chargerCandidats(
  articleId: string,
  villes: readonly string[],
): Promise<CandidatLien[]> {
  const out: CandidatLien[] = [];
  const medias = await prisma.mediaCoverage.findMany({
    where: { status: "published", deletedAt: null },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { id: true, outlet: true, url: true },
  });
  for (const m of medias) {
    out.push({ id: `media-${m.id}`, type: "media-region", cible: m.outlet, url: m.url });
  }
  for (const slug of villes) {
    for (const [i, inst] of (ficheLocale(slug)?.institutions ?? []).entries()) {
      if (!CATEGORIES_ANNUAIRE.has(inst.categorie)) continue;
      out.push({ id: `annuaire-${slug}-${i}`, type: "annuaire", cible: inst.nom, url: inst.url });
    }
  }
  const citations = await prisma.contentCitation.findMany({
    where: { articleId, externalReference: { isAlive: true } },
    take: 20,
    select: {
      externalReference: { select: { id: true, publisher: true, title: true, url: true } },
    },
  });
  for (const c of citations) {
    const r = c.externalReference;
    out.push({
      id: `page-${r.id}`,
      type: "page-citante",
      cible: r.publisher ?? r.title,
      url: r.url,
    });
  }
  return out;
}

/** Vrai si l'adresse est en opposition ou en liste de suppression (aucune ligne n'est supprimée). */
export async function estOppose(email: string): Promise<boolean> {
  const hash = hashEmailForLookup(email);
  const normalise = email.trim().toLowerCase();
  if (hash && (await prisma.emailOpposition.findUnique({ where: { emailHash: hash } }))) {
    return true;
  }
  if (
    await prisma.prospectionSuppressionEntry.findFirst({
      where: { type: "email", valueNormalized: normalise },
    })
  ) {
    return true;
  }
  return (
    (await prisma.prospectionContact.findFirst({
      where: { valueNormalized: normalise, person: { optOut: true } },
    })) !== null
  );
}

export async function coutDejaEngage(jobId: string): Promise<number> {
  const r = await prisma.costLedger.aggregate({ where: { jobId }, _sum: { costUsd: true } });
  return Number(r._sum.costUsd ?? 0);
}

function lireEntree(json: unknown): EntreeChargeLiens | null {
  const c = (json as { chargeLiens?: EntreeChargeLiens } | null)?.chargeLiens;
  return c && Array.isArray(c.occasions) ? c : null;
}

export async function lireOccasions(jobId: string): Promise<EntreeChargeLiens | null> {
  const job = await prisma.contentGenJob.findUnique({
    where: { id: jobId },
    select: { outputJsonRaw: true },
  });
  return lireEntree(job?.outputJsonRaw);
}

/** Fusion sans écraser les autres clés du JSON du job. */
export async function ecrireOccasions(jobId: string, entree: EntreeChargeLiens): Promise<void> {
  const job = await prisma.contentGenJob.findUnique({
    where: { id: jobId },
    select: { outputJsonRaw: true },
  });
  const base =
    job?.outputJsonRaw && typeof job.outputJsonRaw === "object" && !Array.isArray(job.outputJsonRaw)
      ? (job.outputJsonRaw as Record<string, unknown>)
      : {};
  await prisma.contentGenJob.update({
    where: { id: jobId },
    data: { outputJsonRaw: JSON.parse(JSON.stringify({ ...base, chargeLiens: entree })) },
  });
}

export interface ArticleAvecOccasions {
  readonly jobId: string;
  readonly titre: string;
  readonly url: string;
  readonly occasions: OccasionLien[];
}

/** Articles récents dont le job porte des occasions (lecture de la console). */
export async function listerArticlesAvecOccasions(take = 50): Promise<ArticleAvecOccasions[]> {
  const jobs = await prisma.contentGenJob.findMany({
    where: { outputJsonRaw: { path: ["chargeLiens"], not: undefined as never } },
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, outputJsonRaw: true },
  });
  const res: ArticleAvecOccasions[] = [];
  for (const j of jobs) {
    const entree = lireEntree(j.outputJsonRaw);
    if (!entree || entree.occasions.length === 0) continue;
    const art = await prisma.article.findFirst({
      where: { generatedByJobId: j.id },
      select: { translations: { where: { locale: "fr" }, select: { title: true }, take: 1 } },
    });
    const t = art?.translations[0];
    res.push({
      jobId: j.id,
      titre: t?.title ?? j.id,
      url: "",
      occasions: entree.occasions,
    });
  }
  return res;
}
