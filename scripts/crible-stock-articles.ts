/**
 * V2-14 — crible du stock d'articles publiés (chantier GEO).
 *
 * Plan : `geo/PLAN-GEO.md`, lot V2-14 (dépôt axion-plans-prive). Règles et exclusions :
 * `src/server/crible-stock/`. Le script n'appelle ni l'IA ni le réseau.
 *
 * Modes (un seul à la fois) :
 *   --dry-run (DÉFAUT)            lit, analyse, écrit le rapport, n'écrit RIEN en base. Affiche l'empreinte du plan.
 *   --apply --plan-sha=<sha>      écrit ; refuse si l'empreinte recalculée ≠ celle de l'essai à blanc.
 *   --restore                     remet les valeurs d'origine (seulement si la valeur actuelle est celle écrite).
 * Options : --only=<id,id,…> (ids d'articles) · --report=<fichier> · --urls=<fichier>.
 *
 * Seules corrections possibles : l'avis d'expert d'un article (réattribué à « Point de vue d'Axion-IA »
 * ou retiré s'il porte un interdit). Le corps, le statut et l'indexation ne sont jamais touchés.
 * Les articles à témoignage ou à cas chiffré fictif sont EXCLUS de toute correction (voir exclusions.ts).
 *
 * Sauvegarde : une ligne `ContentGenAuditLog` par article (action « crible-stock-2026-11 »,
 * settingKey « article:<id> », oldValue = les trois champs d'origine, newValue = les champs écrits),
 * créée DANS la même transaction que la mise à jour. Aucune migration, aucune suppression.
 */
import fs from "node:fs";
import { Prisma, PrismaClient } from "../prisma/generated/client";
import { cribler, type ArticleACribler, type Champs } from "../src/server/crible-stock/analyse";
import {
  ACTION_CRIBLE,
  ACTION_RESTAURATION,
  champsARestaurer,
  empreinte,
  empreintePlan,
  propositions,
  rapport,
  rapportRestauration,
  resume,
  type Proposition,
} from "../src/server/crible-stock/plan";

const prisma = new PrismaClient();
const ACTEUR = "script:crible-stock";

interface Options {
  mode: "dry-run" | "apply" | "restore";
  planSha: string | null;
  only: Set<string> | null;
  rapport: string | null;
  urls: string | null;
}

function lireOptions(argv: string[]): Options {
  const val = (nom: string) =>
    argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? null;
  const modes = ["--dry-run", "--apply", "--restore"].filter((m) => argv.includes(m));
  if (modes.length > 1)
    throw new Error("Un seul mode à la fois : --dry-run | --apply | --restore.");
  const mode = modes[0] === "--apply" ? "apply" : modes[0] === "--restore" ? "restore" : "dry-run";
  const only = val("only");
  return {
    mode,
    planSha: val("plan-sha"),
    only: only
      ? new Set(
          only
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : null,
    rapport: val("report"),
    urls: val("urls"),
  };
}

// ───────────────────────────── lecture ─────────────────────────────

const CHAMPS = ["expertQuoteName", "expertQuoteTitle", "expertQuoteText"] as const;

async function urlsArticle(articleId: string): Promise<string[]> {
  const ts = await prisma.articleTranslation.findMany({
    where: { articleId },
    select: { locale: true, slug: true },
  });
  return ts.map((t) => `/${t.locale}/blog/${t.slug}`);
}

async function lireStock(o: Options) {
  const traductions = await prisma.articleTranslation.findMany({
    where: { locale: "fr", article: { status: "published" } },
    select: {
      slug: true,
      title: true,
      body: true,
      article: {
        select: {
          id: true,
          isNews: true,
          directAnswer: true,
          keyTakeaway: true,
          expertQuoteName: true,
          expertQuoteTitle: true,
          expertQuoteText: true,
        },
      },
    },
    orderBy: { slug: "asc" },
  });
  const articles: ArticleACribler[] = traductions
    .filter((t) => !o.only || o.only.has(t.article.id))
    .map((t) => ({
      id: t.article.id,
      slug: t.slug,
      titre: t.title,
      corpsHtml: t.body,
      directAnswer: t.article.directAnswer,
      keyTakeaway: t.article.keyTakeaway,
      expertNom: t.article.expertQuoteName,
      expertTitre: t.article.expertQuoteTitle,
      expertTexte: t.article.expertQuoteText,
      isNews: t.article.isNews,
    }));
  return articles.map(cribler);
}

// ───────────────────────────── écriture ─────────────────────────────

async function appliquer(p: Proposition[]): Promise<{ ecrits: number; deja: string[] }> {
  let ecrits = 0;
  const deja: string[] = [];
  for (const x of p) {
    // Jamais d'écrasement d'une sauvegarde existante.
    const existe = await prisma.contentGenAuditLog.findFirst({
      where: { action: ACTION_CRIBLE, settingKey: x.cle },
      select: { id: true },
    });
    if (existe) {
      deja.push(x.cle);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const courant = await tx.article.findUnique({
        where: { id: x.id },
        select: { expertQuoteName: true, expertQuoteTitle: true, expertQuoteText: true },
      });
      if (!courant) throw new Error(`${x.cle} : ligne introuvable`);
      for (const c of CHAMPS)
        if (empreinte(courant[c]) !== empreinte(x.avant[c]))
          throw new Error(`${x.cle}.${c} : modifié depuis l'essai à blanc, refus`);
      await tx.contentGenAuditLog.create({
        data: {
          action: ACTION_CRIBLE,
          settingKey: x.cle,
          oldValue: x.avant as unknown as Prisma.InputJsonValue,
          newValue: x.apres as unknown as Prisma.InputJsonValue,
          actorEmail: ACTEUR,
        },
      });
      await tx.article.update({ where: { id: x.id }, data: { ...x.apres } });
    });
    ecrits++;
  }
  return { ecrits, deja };
}

async function restaurer(only: Set<string> | null) {
  const lignes = await prisma.contentGenAuditLog.findMany({
    where: { action: ACTION_CRIBLE },
    orderBy: { createdAt: "asc" },
  });
  let restaures = 0;
  const divergences: string[] = [];
  const urls: string[] = [];
  const restaurees: string[] = [];
  for (const l of lignes) {
    const [table, id] = (l.settingKey ?? "").split(":");
    if (table !== "article" || !id || (only && !only.has(id))) continue;
    const avant = (l.oldValue ?? {}) as Partial<Champs>;
    const apres = (l.newValue ?? {}) as Partial<Champs>;
    const deja = await prisma.contentGenAuditLog.findFirst({
      where: {
        action: ACTION_RESTAURATION,
        settingKey: l.settingKey,
        createdAt: { gt: l.createdAt },
      },
      select: { id: true },
    });
    if (deja) continue;
    await prisma.$transaction(async (tx) => {
      const courant = await tx.article.findUnique({
        where: { id },
        select: { expertQuoteName: true, expertQuoteTitle: true, expertQuoteText: true },
      });
      if (!courant) {
        divergences.push(`${l.settingKey} : ligne introuvable`);
        return;
      }
      // Remet l'original SEULEMENT si la valeur actuelle est celle que le script a écrite.
      const diverge = (Object.keys(apres) as Array<keyof Champs>).filter(
        (c) => empreinte(courant[c]) !== empreinte(apres[c]),
      );
      if (diverge.length > 0) {
        divergences.push(
          `${l.settingKey} : champs modifiés depuis (${diverge.join(", ")}), non restauré`,
        );
        return;
      }
      const remis = champsARestaurer(avant, apres);
      await tx.article.update({ where: { id }, data: { ...remis } });
      await tx.contentGenAuditLog.create({
        data: {
          action: ACTION_RESTAURATION,
          settingKey: l.settingKey,
          oldValue: apres as unknown as Prisma.InputJsonValue,
          newValue: remis as unknown as Prisma.InputJsonValue,
          actorEmail: ACTEUR,
        },
      });
      restaures++;
      restaurees.push(`${l.settingKey} : ${Object.keys(remis).join(", ")}`);
      urls.push(...(await urlsArticle(id)));
    });
  }
  return { restaures, divergences, urls: [...new Set(urls)].sort(), lignes: restaurees };
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const o = lireOptions(process.argv.slice(2));
  console.log(`── Crible du stock d'articles (V2-14) : mode ${o.mode} ──`);

  if (o.mode === "restore") {
    const r = await restaurer(o.only);
    console.log(`Restaurés : ${r.restaures}`);
    for (const d of r.divergences) console.log(`⚠ ${d}`);
    if (o.rapport) fs.writeFileSync(o.rapport, rapportRestauration(r));
    if (o.urls) fs.writeFileSync(o.urls, r.urls.length > 0 ? `${r.urls.join("\n")}\n` : "");
    return;
  }

  const resultats = await lireStock(o);
  const p = propositions(resultats);
  const sha = empreintePlan(p);
  const r = resume(resultats, p);
  console.log(
    `Articles criblés : ${r.articles} · exclus : ${r.exclus} · à corriger : ${r.a_corriger}`,
  );
  console.log(`PLAN_SHA=${sha}`);
  if (o.rapport) fs.writeFileSync(o.rapport, rapport(o.mode, sha, resultats, p));
  if (o.urls) {
    const urls: string[] = [];
    for (const x of p) urls.push(...(await urlsArticle(x.id)));
    fs.writeFileSync(o.urls, urls.length > 0 ? `${[...new Set(urls)].sort().join("\n")}\n` : "");
  }

  if (o.mode === "dry-run") {
    console.log("Essai à blanc : RIEN n'a été écrit en base.");
    return;
  }
  if (!o.planSha) throw new Error("--apply exige --plan-sha=<empreinte de l'essai à blanc>.");
  if (o.planSha !== sha)
    throw new Error(
      `Empreinte du plan différente (essai à blanc ${o.planSha}, maintenant ${sha}) : refus. Relancer l'essai à blanc.`,
    );
  const e = await appliquer(p);
  console.log(
    `Écrits : ${e.ecrits} · déjà traités (sauvegarde existante, non écrasée) : ${e.deja.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
