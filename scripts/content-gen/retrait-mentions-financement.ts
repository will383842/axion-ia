/**
 * Retrait des mentions de financement : blog (articles, FAQ) et offres d'emploi.
 *
 * Plan : `geo/PLAN-RETRAIT-FINANCEMENT.md` (axion-plans-prive). Règles : `src/server/content-gen/
 * retrait-financement/regles.ts`. MODIFIER, jamais supprimer : même URL, même slug.
 *
 * Modes (un seul à la fois) :
 *   --dry-run (DÉFAUT)             lit, calcule le plan, n'écrit RIEN en base. Affiche l'empreinte du plan.
 *   --apply --plan-sha=<sha>       écrit ; refuse si l'empreinte recalculée ≠ celle de l'essai à blanc.
 *   --restore                      remet les valeurs d'origine (seulement si la valeur actuelle = celle écrite).
 * Options : --only=<id,id,…> (ids de lignes) · --report=<fichier> · --overrides=<fichier.json>.
 *
 * Sauvegarde : une ligne `ContentGenAuditLog` par contenu (action « retrait-financement-2026-11 »,
 * settingKey « <table>:<id> », oldValue = TOUS les champs textuels d'origine du contenu (et le statut
 * pour les offres), newValue = les seuls champs modifiés), écrite DANS
 * la même transaction que la mise à jour. Aucune migration. Aucune sauvegarde existante n'est écrasée.
 *
 * Le script n'appelle ni l'IA ni le réseau. La purge du cache et IndexNow sont faites par le
 * workflow, après `apply` / `restore`, à partir de la liste d'URL écrite par `--urls=<fichier>`.
 */
import fs from "node:fs";
import { Prisma, PrismaClient } from "../../prisma/generated/client";
import {
  ACTION_RESTAURATION,
  ACTION_RETRAIT,
  type Champs,
  type Overrides,
  type Proposition,
  type Table,
  appliquerOverrides,
  champsARestaurer,
  empreinte,
  empreintePlan,
  proposerArticle,
  proposerFaq,
  proposerOffre,
  proposerTraduction,
  rapportRestauration,
  resume,
} from "../../src/server/content-gen/retrait-financement/plan";

const prisma = new PrismaClient();
const ACTEUR = "script:retrait-financement";

interface Options {
  mode: "dry-run" | "apply" | "restore";
  planSha: string | null;
  only: Set<string> | null;
  rapport: string | null;
  overrides: string | null;
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
    overrides: val("overrides"),
    urls: val("urls"),
  };
}

// ───────────────────────────── URL à purger ─────────────────────────────

/** Pages publiques d'un article (une par traduction). */
async function urlsArticle(articleId: string): Promise<string[]> {
  const ts = await prisma.articleTranslation.findMany({
    where: { articleId },
    select: { locale: true, slug: true },
  });
  return ts.map((t) => `/${t.locale}/blog/${t.slug}`);
}

/** Pages à purger pour une ligne : une FAQ fille s'affiche sur la page de son article parent. */
async function urlsDe(table: Table, ligne: Record<string, unknown>): Promise<string[]> {
  switch (table) {
    case "article_translation":
      return [`/${String(ligne.locale)}/blog/${String(ligne.slug)}`];
    case "article":
      return urlsArticle(String(ligne.id));
    case "faq":
      return typeof ligne.parentArticleId === "string" ? urlsArticle(ligne.parentArticleId) : [];
    case "job_offer":
      return [`/fr/carrieres/${String(ligne.slug)}`];
  }
}

// ───────────────────────────── lecture ─────────────────────────────

const json = (v: unknown): unknown => (v === null || v === undefined ? null : v);

async function construirePlan(
  o: Options,
): Promise<{ propositions: Proposition[]; ignores: string[]; urls: string[] }> {
  const overrides: Overrides =
    o.overrides && fs.existsSync(o.overrides)
      ? (JSON.parse(fs.readFileSync(o.overrides, "utf8")) as Overrides)
      : {};
  const garde = (id: string) => !o.only || o.only.has(id);
  const propositions: Proposition[] = [];
  const ignores: string[] = [];
  const urls: string[] = [];
  const ajouter = (p: Proposition | null, originaux: Champs, url: string | null) => {
    if (!p) return;
    const r = appliquerOverrides(p, originaux, overrides);
    ignores.push(...r.ignores);
    propositions.push(r.proposition);
    if (url && Object.keys(r.proposition.apres).length > 0) urls.push(url);
  };

  for (const t of await prisma.articleTranslation.findMany()) {
    if (!garde(t.id)) continue;
    const p = proposerTraduction({ ...t, bodyJson: json(t.bodyJson) });
    ajouter(p, t as unknown as Champs, `/${t.locale}/blog/${t.slug}`);
  }
  for (const a of await prisma.article.findMany({
    select: {
      id: true,
      directAnswer: true,
      faqJson: true,
      keyTakeaway: true,
      expertQuoteText: true,
      featuredImageAltFr: true,
      featuredImageAltEn: true,
      translations: { select: { locale: true, slug: true } },
    },
  })) {
    if (!garde(a.id)) continue;
    const p = proposerArticle({ ...a, faqJson: json(a.faqJson) });
    ajouter(p, a as unknown as Champs, null);
    if (p && Object.keys(p.apres).length > 0)
      for (const t of a.translations) urls.push(`/${t.locale}/blog/${t.slug}`);
  }
  for (const f of await prisma.fAQ.findMany({ where: { parentArticleId: { not: null } } })) {
    if (!garde(f.id)) continue;
    const p = proposerFaq(f);
    ajouter(p, f as unknown as Champs, null);
    // La FAQ fille se rend sur la page de l'article parent : purger cette page aussi.
    if (p && Object.keys(p.apres).length > 0) urls.push(...(await urlsDe("faq", f)));
  }
  for (const j of await prisma.jobOffer.findMany()) {
    if (!garde(j.id)) continue;
    const p = proposerOffre({
      ...j,
      bodyJsonFr: json(j.bodyJsonFr),
      bodyJsonEn: json(j.bodyJsonEn),
    });
    ajouter(p, j as unknown as Champs, `/fr/carrieres/${j.slug}`);
  }
  return { propositions, ignores, urls: [...new Set(urls)].sort() };
}

// ───────────────────────────── écriture ─────────────────────────────

const toJson = (v: unknown) => (v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue));
const CHAMPS_JSON = new Set(["bodyJson", "bodyJsonFr", "bodyJsonEn", "faqJson"]);

function donnees(champs: Champs): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(champs)) out[k] = CHAMPS_JSON.has(k) ? toJson(v) : v;
  return out;
}

type Delegue = {
  findUnique: (a: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
  update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
};

function delegue(tx: Prisma.TransactionClient, table: Table): Delegue {
  const map = {
    article_translation: tx.articleTranslation,
    article: tx.article,
    faq: tx.fAQ,
    job_offer: tx.jobOffer,
  } as const;
  return map[table] as unknown as Delegue;
}

async function appliquer(propositions: Proposition[]): Promise<{ ecrits: number; deja: string[] }> {
  let ecrits = 0;
  const deja: string[] = [];
  for (const p of propositions) {
    if (Object.keys(p.apres).length === 0) continue;
    // Jamais d'écrasement d'une sauvegarde existante : contenu déjà traité → on s'arrête là pour lui.
    const existe = await prisma.contentGenAuditLog.findFirst({
      where: { action: ACTION_RETRAIT, settingKey: p.cle },
      select: { id: true },
    });
    if (existe) {
      deja.push(p.cle);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const d = delegue(tx, p.table);
      const courant = await d.findUnique({ where: { id: p.id } });
      if (!courant) throw new Error(`${p.cle} : ligne introuvable`);
      for (const [champ, ancien] of Object.entries(p.avant)) {
        if (empreinte(json(courant[champ])) !== empreinte(json(ancien)))
          throw new Error(`${p.cle}.${champ} : modifié depuis l'essai à blanc, refus`);
      }
      await tx.contentGenAuditLog.create({
        data: {
          action: ACTION_RETRAIT,
          settingKey: p.cle,
          oldValue: p.avant as Prisma.InputJsonValue,
          newValue: p.apres as Prisma.InputJsonValue,
          actorEmail: ACTEUR,
        },
      });
      await d.update({ where: { id: p.id }, data: donnees(p.apres) });
    });
    ecrits++;
  }
  return { ecrits, deja };
}

async function restaurer(
  only: Set<string> | null,
): Promise<{ restaures: number; divergences: string[]; urls: string[]; lignes: string[] }> {
  const lignes = await prisma.contentGenAuditLog.findMany({
    where: { action: ACTION_RETRAIT },
    orderBy: { createdAt: "asc" },
  });
  let restaures = 0;
  const divergences: string[] = [];
  const urls: string[] = [];
  const restaurees: string[] = [];
  for (const l of lignes) {
    const [table, id] = (l.settingKey ?? "").split(":") as [Table, string];
    if (!table || !id || (only && !only.has(id))) continue;
    const avant = (l.oldValue ?? {}) as Champs;
    const apres = (l.newValue ?? {}) as Champs;
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
      const d = delegue(tx, table);
      const courant = await d.findUnique({ where: { id } });
      if (!courant) {
        divergences.push(`${l.settingKey} : ligne introuvable`);
        return;
      }
      // Remet l'original SEULEMENT si la valeur actuelle est celle que le script a écrite.
      const diverge = Object.keys(apres).filter(
        (c) => empreinte(json(courant[c])) !== empreinte(json(apres[c])),
      );
      if (diverge.length > 0) {
        divergences.push(
          `${l.settingKey} : champs modifiés depuis (${diverge.join(", ")}), non restauré`,
        );
        return;
      }
      // Seuls les champs écrits par le script sont remis (la sauvegarde porte tous les champs).
      const remis = champsARestaurer(avant, apres);
      await d.update({ where: { id }, data: donnees(remis) });
      await tx.contentGenAuditLog.create({
        data: {
          action: ACTION_RESTAURATION,
          settingKey: l.settingKey,
          oldValue: apres as Prisma.InputJsonValue,
          newValue: remis as Prisma.InputJsonValue,
          actorEmail: ACTEUR,
        },
      });
      restaures++;
      restaurees.push(`${l.settingKey} : ${Object.keys(remis).join(", ")}`);
      urls.push(...(await urlsDe(table, courant)));
    });
  }
  return { restaures, divergences, urls: [...new Set(urls)].sort(), lignes: restaurees };
}

// ───────────────────────────── rapport ─────────────────────────────

/** Rapport : textes PUBLICS seulement (ce qui est retiré), jamais le contenu intégral ni le dump. */
function ecrireRapport(
  fichier: string,
  o: Options,
  p: Proposition[],
  ignores: string[],
  sha: string,
): void {
  const coupe = (v: unknown) =>
    typeof v === "string" ? v.replace(/\s+/g, " ").slice(0, 200) : "(structure JSON)";
  const l: string[] = [
    `# Retrait des mentions de financement — ${o.mode}`,
    "",
    `Empreinte du plan : \`${sha}\``,
    "",
  ];
  const r = resume(p);
  l.push(
    `Contenus concernés : ${r.total} · à réécrire : ${r.a_reecrire} · ambigus : ${r.ambigus}`,
    "",
  );
  l.push("## Modifications");
  for (const x of p)
    for (const c of Object.keys(x.apres))
      l.push(`- \`${x.cle}\` · ${c} : « ${coupe(x.avant[c])} » → « ${coupe(x.apres[c])} »`);
  l.push("", "## Cas ambigus (à trancher dans `retrait-financement-overrides.json`)");
  for (const x of p) for (const a of x.ambigus) l.push(`- ${a}`);
  l.push("", "## « prise en charge » conservées (hors financement)");
  for (const x of p) for (const c of x.conserves) l.push(`- \`${x.cle}\` : ${c}`);
  if (ignores.length > 0) l.push("", "## Overrides ignorés", ...ignores.map((i) => `- ${i}`));
  l.push(
    "",
    "## Hors périmètre (listés, non traités)",
    "- texte dans les images ; titres d'ExternalReference ; slugs contenant « opco » / « certification » (inchangés).",
  );
  fs.writeFileSync(fichier, `${l.join("\n")}\n`);
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const o = lireOptions(process.argv.slice(2));
  console.log(`── Retrait des mentions de financement : mode ${o.mode} ──`);

  if (o.mode === "restore") {
    const r = await restaurer(o.only);
    console.log(`Restaurés : ${r.restaures}`);
    for (const d of r.divergences) console.log(`⚠ ${d}`);
    // Le workflow purge le cache et notifie IndexNow à partir de ces fichiers, aussi en restore.
    if (o.rapport) fs.writeFileSync(o.rapport, rapportRestauration(r));
    if (o.urls) fs.writeFileSync(o.urls, r.urls.length > 0 ? `${r.urls.join("\n")}\n` : "");
    return;
  }

  const { propositions, ignores, urls } = await construirePlan(o);
  const sha = empreintePlan(propositions);
  const r = resume(propositions);
  console.log(
    `Contenus concernés : ${r.total} · à réécrire : ${r.a_reecrire} · ambigus : ${r.ambigus}`,
  );
  console.log(`PLAN_SHA=${sha}`);
  if (o.rapport) ecrireRapport(o.rapport, o, propositions, ignores, sha);
  if (o.urls) fs.writeFileSync(o.urls, `${urls.join("\n")}\n`);

  if (o.mode === "dry-run") {
    console.log("Essai à blanc : RIEN n'a été écrit en base.");
    return;
  }
  if (!o.planSha) throw new Error("--apply exige --plan-sha=<empreinte de l'essai à blanc>.");
  if (o.planSha !== sha)
    throw new Error(
      `Empreinte du plan différente (essai à blanc ${o.planSha}, maintenant ${sha}) : refus. Relancer l'essai à blanc.`,
    );
  const e = await appliquer(propositions);
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
