/**
 * Content Generator — audit de l'existant du blog : la LECTURE (base + Search Console).
 *
 * Lot L10 (audit blog/RAG du 24/10/2026). Ce module ne fait que LIRE : deux
 * requêtes Prisma `findMany` et, pour deux listes seulement, des lectures du
 * trafic Search Console. Aucune écriture, aucun DELETE, aucun appel payant.
 * Le classement vit dans `audit-blog-existant.ts` (pur, testé sans base).
 */

import { prisma } from "@/lib/prisma";
import { gscPageMetricsForUrl } from "@/server/content-gen/seo/gsc-client";
import { buildArticleUrl } from "@/server/content-gen/indexing/url-builder";
import {
  auditerArticles,
  compterMots,
  type EntreeAudit,
  type LigneAudit,
  type ResultatAudit,
} from "./audit-blog-existant";

/** Garde-fou : le blog compte environ 550 articles publiés. */
const LIMITE_ARTICLES = 3000;
/** Fenêtre de trafic montrée à Will (jours). */
export const FENETRE_TRAFIC_JOURS = 90;
/** Au plus ce nombre d'adresses interrogées dans Search Console par ouverture de page. */
const LIMITE_LECTURES_GSC = 60;
const SIMULTANEES_GSC = 6;
const DELAI_GSC_MS = 8000;

export interface TraficGsc {
  readonly clics: number;
  readonly impressions: number;
  readonly position: number;
}

export interface AuditBlogCharge {
  readonly resultat: ResultatAudit;
  readonly totalPublies: number;
  /** Trafic par id d'article, pour les listes « Grenoble » et « très courts ». */
  readonly trafic: ReadonlyMap<string, TraficGsc>;
  /** `false` : Search Console n'a rien répondu (identifiants absents ou erreur). */
  readonly gscDisponible: boolean;
  readonly fenetreJours: number;
}

function enTexte(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return undefined;
  }
}

async function chargerEntrees(): Promise<EntreeAudit[]> {
  const traductions = await prisma.articleTranslation.findMany({
    where: { locale: "fr", article: { status: "published" } },
    select: {
      slug: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      body: true,
      bodyText: true,
      article: {
        select: {
          id: true,
          indexationTier: true,
          isNews: true,
          qualityScore: true,
          campaignId: true,
          templateVariant: true,
          directAnswer: true,
          keyTakeaway: true,
          expertQuoteName: true,
          expertQuoteText: true,
          faqJson: true,
        },
      },
    },
    orderBy: { slug: "asc" },
    take: LIMITE_ARTICLES,
  });

  const idsCampagnes = [
    ...new Set(traductions.map((t) => t.article.campaignId).filter((c): c is string => !!c)),
  ];
  const campagnes =
    idsCampagnes.length > 0
      ? await prisma.coverageCampaign.findMany({
          where: { id: { in: idsCampagnes } },
          select: { id: true, name: true },
        })
      : [];
  const nomParCampagne = new Map(campagnes.map((c) => [c.id, c.name]));

  return traductions.map((t) => {
    const a = t.article;
    const corps = t.bodyText ?? t.body;
    return {
      id: a.id,
      slug: t.slug,
      titre: t.title,
      indexationTier: a.indexationTier,
      isNews: a.isNews,
      templateVariant: a.templateVariant,
      qualityScore: a.qualityScore,
      campagneNom: a.campaignId ? (nomParCampagne.get(a.campaignId) ?? null) : null,
      expertNom: a.expertQuoteName,
      expertTexte: a.expertQuoteText,
      mots: compterMots(corps),
      surface: {
        titre: t.title,
        metaTitre: t.metaTitle ?? undefined,
        metaDescription: t.metaDescription ?? undefined,
        slug: t.slug.replace(/-/g, " "),
        reponseDirecte: a.directAnswer ?? undefined,
        pointCle: a.keyTakeaway ?? undefined,
        expertNom: a.expertQuoteName ?? undefined,
        expertTexte: a.expertQuoteText ?? undefined,
        faq: enTexte(a.faqJson),
        corps,
      },
    };
  });
}

function avecDelai<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const minuteur = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(minuteur);
        resolve(v);
      },
      () => {
        clearTimeout(minuteur);
        resolve(null);
      },
    );
  });
}

/**
 * Lit le trafic Search Console des lignes données (lecture seule). Renvoie une
 * table vide quand Search Console n'est pas branchée dans ce conteneur.
 */
export async function lireTraficGsc(
  lignes: ReadonlyArray<LigneAudit>,
): Promise<{ trafic: Map<string, TraficGsc>; disponible: boolean }> {
  const trafic = new Map<string, TraficGsc>();
  const uniques = [...new Map(lignes.map((l) => [l.id, l])).values()].slice(0, LIMITE_LECTURES_GSC);
  let reponses = 0;

  for (let i = 0; i < uniques.length; i += SIMULTANEES_GSC) {
    const lot = uniques.slice(i, i + SIMULTANEES_GSC);
    const resultats = await Promise.all(
      lot.map((l) =>
        avecDelai(
          gscPageMetricsForUrl(
            buildArticleUrl({
              slug: l.slug,
              isNews: l.isNews,
              templateVariant: l.templateVariant,
            }),
            FENETRE_TRAFIC_JOURS,
          ),
          DELAI_GSC_MS,
        ),
      ),
    );
    resultats.forEach((m, idx) => {
      const l = lot[idx];
      if (!l || !m) return;
      reponses += 1;
      trafic.set(l.id, { clics: m.clicks, impressions: m.impressions, position: m.position });
    });
    // Aucune réponse sur le premier lot : identifiants absents, inutile d'insister.
    if (i === 0 && reponses === 0) break;
  }
  return { trafic, disponible: reponses > 0 };
}

/** Charge l'audit complet. Sous l'URL stub du build, ne lit rien. */
export async function chargerAuditBlog(): Promise<AuditBlogCharge> {
  const entrees = process.env.DATABASE_URL?.includes("stub.invalid") ? [] : await chargerEntrees();
  // OPCO / France Travail restent comptés comme interdits : le contrat de
  // `server/qualiopi/config/financing.ts` (divulgation fermée) est la règle de
  // l'audit, et lire ce réglage exigerait d'importer le domaine Qualiopi.
  const resultat = auditerArticles(entrees, { financementPublicAutorise: false });
  const aMesurer = [...resultat.grenoble, ...resultat["tres-courts"]];
  const { trafic, disponible } =
    aMesurer.length > 0
      ? await lireTraficGsc(aMesurer)
      : { trafic: new Map<string, TraficGsc>(), disponible: true };
  return {
    resultat,
    totalPublies: entrees.length,
    trafic,
    gscDisponible: disponible,
    fenetreJours: FENETRE_TRAFIC_JOURS,
  };
}
