#!/usr/bin/env tsx
/**
 * C2b — Audit du corpus déjà publié. LECTURE SEULE.
 *
 * Liste les articles, actualités et pages villes gabaritées à faible valeur, sans impression
 * Search Console, ou en doublon de plan, et écrit un rapport Markdown pour un humain.
 * Jamais de noindex, de suppression, de fusion ni d'écriture en base : uniquement des `findMany`.
 *
 * Éteint par défaut : ne fait rien sans `--lancer` (ou AUDIT_CORPUS_ACTIF=true).
 * Usage :  pnpm tsx scripts/audit-corpus-publie.ts --lancer [--sortie=_AUDIT/audit-corpus.md]
 * Refuse de tourner sur la base factice du build (`stub.invalid`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PrismaClient } from "../prisma/generated/client";
import {
  analyserCorpus,
  formaterRapport,
  type PageCorpus,
} from "../src/server/seo-pilotage/audit-corpus";

function enTexte(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titres(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)) {
    const t = enTexte(m[1] ?? "");
    if (t) out.push(t);
  }
  return out;
}

function compterMots(texte: string): number {
  return texte ? texte.split(" ").length : 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const actif = args.includes("--lancer") || process.env.AUDIT_CORPUS_ACTIF === "true";
  if (!actif) {
    console.log("Audit C2b éteint par défaut. Relancer avec --lancer (lecture seule).");
    return;
  }
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("stub.invalid")) {
    console.error("DATABASE_URL absente ou factice (stub.invalid) : audit impossible.");
    process.exitCode = 1;
    return;
  }
  const sortie = args.find((a) => a.startsWith("--sortie="))?.slice(9);

  const prisma = new PrismaClient();
  try {
    const pages: PageCorpus[] = [];

    const articles = await prisma.article.findMany({
      where: { status: "published" },
      select: {
        id: true,
        isNews: true,
        templateVariant: true,
        publishedAt: true,
        translations: { where: { locale: "fr" }, select: { slug: true, title: true, body: true } },
      },
    });
    // Impressions : lues sur le Site Explorer (null si la ligne ou la mesure manque).
    const routes = await prisma.siteRoute.findMany({
      where: { sourceDbTable: "articles", removedAt: null },
      select: {
        sourceDbId: true,
        pathRendered: true,
        gscImpressions: true,
        gscDataAt: true,
        isIndexable: true,
      },
    });
    // Une mesure ne vaut que pour une route vivante, indexable et réellement mesurée ; sinon
    // « indisponible » (null), jamais 0 (le worker GSC ne remet pas à null une page repassée noindex).
    const impParArticleUrl = new Map(
      routes
        .filter((r) => r.isIndexable === true && r.gscDataAt !== null && r.pathRendered)
        .map((r) => [`${r.sourceDbId}|${r.pathRendered}`, r.gscImpressions]),
    );

    for (const a of articles) {
      const t = a.translations[0];
      if (!t) continue;
      const guide = a.templateVariant?.startsWith("guide") || t.slug.startsWith("guide-");
      const segment = a.isNews ? "actualites" : guide ? "guides" : "blog";
      const texte = enTexte(t.body);
      const url = `/fr/${segment}/${t.slug}`;
      pages.push({
        url,
        type: a.isNews ? "actualite" : "article",
        titre: t.title,
        mots: compterMots(texte),
        impressions: impParArticleUrl.get(`${a.id}|${url}`) ?? null,
        publieLe: a.publishedAt,
        plan: titres(t.body),
        texte: null,
        villeNom: null,
      });
    }

    const copies = await prisma.generatedVilleCopy.findMany({
      where: { status: "approved" },
      select: {
        villeSlug: true,
        pitchFr: true,
        directAnswerFr: true,
        ecosystemFr: true,
        distancesFr: true,
      },
    });
    // Hub ville du Site Explorer : section « implantations », jointure sur le slug (cityIds = codes INSEE).
    const routesVilles = await prisma.siteRoute.findMany({
      where: { section: "implantations", removedAt: null, pathSlug: { not: null } },
      select: {
        pathRendered: true,
        pathSlug: true,
        gscImpressions: true,
        gscDataAt: true,
        isIndexable: true,
        createdAt: true,
      },
    });
    const routeParVille = new Map(routesVilles.map((r) => [r.pathSlug, r]));
    for (const c of copies) {
      const route = routeParVille.get(c.villeSlug);
      const mesure = route?.isIndexable === true && route.gscDataAt !== null;
      const texte = [c.pitchFr, c.directAnswerFr, c.ecosystemFr, c.distancesFr].join(" ");
      pages.push({
        url: route?.pathRendered ?? `ville:${c.villeSlug}`,
        type: "ville",
        titre: c.villeSlug,
        // Les 4 champs générés ne sont qu'une partie de la page rendue : mots inconnus (jamais
        // « faible valeur » sur ce seul critère). Date = première découverte de la route
        // (le drip d'indexation fait foi pour la date réelle, absente ici).
        mots: null,
        impressions: mesure ? (route?.gscImpressions ?? null) : null,
        publieLe: route?.createdAt ?? null,
        plan: [],
        texte,
        villeNom: c.villeSlug.replace(/-/g, " "),
      });
    }

    const maintenant = new Date();
    const rapport = formaterRapport(analyserCorpus(pages, maintenant), maintenant);
    if (sortie) {
      mkdirSync(dirname(sortie), { recursive: true });
      writeFileSync(sortie, rapport, "utf-8");
      console.log(`Rapport écrit : ${sortie}`);
    } else {
      console.log(rapport);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
