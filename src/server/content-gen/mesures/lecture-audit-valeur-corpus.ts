/**
 * Fiche C2b — lecture (LECTURE SEULE) du corpus publié : articles FR et pages villes
 * gabaritées approuvées, plus les impressions Search Console en UN appel groupé.
 * Aucune écriture, aucun noindex, aucun appel payant. Le calcul est dans
 * `audit-valeur-corpus.ts` (pur).
 */

import { prisma } from "@/lib/prisma";
import { gscSearchAnalytics } from "@/server/content-gen/seo/gsc-client";
import { buildArticleUrl } from "@/server/content-gen/indexing/url-builder";
import { compterMots } from "@/server/content-gen/audit-blog-existant";
import {
  auditerCorpus,
  cleUrl,
  extraireH2,
  type PageCorpus,
  type RapportCorpus,
} from "./audit-valeur-corpus";

export const FENETRE_IMPRESSIONS_JOURS = 90;
const LIMITE_PAGES = 5000;
const DEFAUT_SITE = "https://axion-ia.com";

function jourIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function texteDe(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

function questionsFaq(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) =>
      typeof x === "object" && x !== null && typeof (x as { q?: unknown }).q === "string"
        ? (x as { q: string }).q
        : "",
    )
    .filter((q) => q.length > 0);
}

export async function chargerPagesCorpus(): Promise<PageCorpus[]> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAUT_SITE).replace(/\/$/, "");
  const pages: PageCorpus[] = [];

  const traductions = await prisma.articleTranslation.findMany({
    where: { locale: "fr", article: { status: "published" } },
    select: {
      slug: true,
      title: true,
      body: true,
      bodyText: true,
      article: {
        select: {
          id: true,
          isNews: true,
          templateVariant: true,
          qualityScore: true,
          publishedAt: true,
        },
      },
    },
    orderBy: { slug: "asc" },
    take: LIMITE_PAGES,
  });
  for (const t of traductions) {
    pages.push({
      id: t.article.id,
      type: "article",
      url: buildArticleUrl({
        slug: t.slug,
        isNews: t.article.isNews,
        templateVariant: t.article.templateVariant,
      }),
      titre: t.title,
      mots: compterMots(t.bodyText ?? t.body),
      qualityScore: t.article.qualityScore,
      publieLe: t.article.publishedAt,
      plan: extraireH2(t.body),
      impressions: null,
    });
  }

  const copies = await prisma.generatedVilleCopy.findMany({
    where: { status: "approved" },
    select: {
      id: true,
      villeSlug: true,
      pitchFr: true,
      directAnswerFr: true,
      ecosystemFr: true,
      distancesFr: true,
      servicesContextJson: true,
      faqGeolocaliseeJson: true,
      qualityScore: true,
      generatedAt: true,
    },
    take: LIMITE_PAGES,
  });
  const slugs = copies.map((c) => c.villeSlug);
  const villes =
    slugs.length > 0
      ? await prisma.city.findMany({
          where: { slug: { in: slugs } },
          select: { slug: true, name: true, regionSlug: true, regionName: true },
        })
      : [];
  const parSlug = new Map(villes.map((v) => [v.slug, v]));
  for (const c of copies) {
    const v = parSlug.get(c.villeSlug);
    if (!v) continue; // sans ville connue, pas d'adresse : rien à signaler de fiable
    const questions = questionsFaq(c.faqGeolocaliseeJson);
    const corps = [
      c.pitchFr,
      c.directAnswerFr,
      c.ecosystemFr,
      c.distancesFr,
      texteDe(c.servicesContextJson),
      questions.join(" "),
    ].join(" ");
    pages.push({
      id: c.id,
      type: "page-ville",
      url: `${site}/fr/implantations/${v.regionSlug}/${v.slug}`,
      titre: v.name,
      mots: compterMots(corps),
      qualityScore: c.qualityScore,
      publieLe: c.generatedAt,
      // Le « plan » d'une page ville est la liste de ses questions : le nom de la ville est retiré.
      plan: questions,
      motsVariables: [v.name, v.regionName],
      impressions: null,
    });
  }
  return pages;
}

/** Impressions par adresse, en un appel groupé. `null` si Search Console n'a pas répondu. */
export async function lireImpressionsParUrl(
  maintenant: Date = new Date(),
): Promise<Map<string, number> | null> {
  // Les derniers jours ne sont pas « finaux » : on s'arrête 3 jours avant aujourd'hui.
  const fin = new Date(maintenant.getTime() - 3 * 86_400_000);
  const debut = new Date(fin.getTime() - FENETRE_IMPRESSIONS_JOURS * 86_400_000);
  const r = await gscSearchAnalytics({
    startDate: jourIso(debut),
    endDate: jourIso(fin),
    dimensions: ["page"],
    dataState: "final",
  });
  if (r.etat !== "ok" || !r.complet) return null;
  const carte = new Map<string, number>();
  for (const row of r.rows) {
    const url = row.keys[0];
    if (url) carte.set(cleUrl(url), (carte.get(cleUrl(url)) ?? 0) + row.impressions);
  }
  return carte;
}

export async function chargerAuditCorpus(maintenant: Date = new Date()): Promise<RapportCorpus> {
  const pages = await chargerPagesCorpus();
  const impr = await lireImpressionsParUrl(maintenant);
  const avecImpr = pages.map((p) => ({
    ...p,
    impressions: impr === null ? null : (impr.get(cleUrl(p.url)) ?? 0),
  }));
  return auditerCorpus(avecImpr, maintenant);
}
