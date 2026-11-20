/**
 * Retrait des mentions de financement : blog (articles, FAQ) et offres d'emploi.
 *
 * Plan : `geo/PLAN-RETRAIT-FINANCEMENT.md` (axion-plans-prive). Règles : `src/server/content-gen/
 * retrait-financement/regles.ts`. MODIFIER, jamais supprimer : même URL, même slug.
 *
 * Modes (un seul à la fois) :
 *   --dry-run (DÉFAUT)             lit, calcule le plan, n'écrit RIEN en base. Affiche l'empreinte du plan.
 *   --apply --plan-sha=<sha>       écrit ; refuse si l'empreinte recalculée ≠ celle de l'essai à blanc,
 *                                  et REFUSE (sortie en erreur) tant qu'un contenu ambigu n'est pas
 *                                  couvert par retrait-financement-overrides.json.
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
  ambigusNonCouverts,
  refuserSiAmbigus,
  type Champs,
  type Overrides,
  type Proposition,
  type Table,
  empreintePlan,
  integrerOverrides,
  proposerArticle,
  proposerFaq,
  proposerOffre,
  proposerTraduction,
  rapportRestauration,
  resume,
} from "../../src/server/content-gen/retrait-financement/plan";
import {
  type Depot,
  appliquer,
  restaurer,
} from "../../src/server/content-gen/retrait-financement/ecriture";
import { construireRapport } from "../../src/server/content-gen/retrait-financement/rapport";

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
  const vus = new Set<string>();
  const ajouter = (p: Proposition | null, cle: string, originaux: Champs, url: string | null) => {
    vus.add(cle);
    // Un override présent est appliqué (ou signalé) même quand le contenu n'a plus rien à retirer.
    const r = integrerOverrides(p, cle, originaux, overrides);
    ignores.push(...r.ignores);
    if (!r.proposition) return;
    propositions.push(r.proposition);
    if (url && Object.keys(r.proposition.apres).length > 0) urls.push(url);
  };

  for (const t of await prisma.articleTranslation.findMany()) {
    if (!garde(t.id)) continue;
    const p = proposerTraduction({ ...t, bodyJson: json(t.bodyJson) });
    ajouter(
      p,
      `article_translation:${t.id}`,
      t as unknown as Champs,
      `/${t.locale}/blog/${t.slug}`,
    );
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
    ajouter(p, `article:${a.id}`, a as unknown as Champs, null);
    if (p && Object.keys(p.apres).length > 0)
      for (const t of a.translations) urls.push(`/${t.locale}/blog/${t.slug}`);
  }
  for (const f of await prisma.fAQ.findMany({ where: { parentArticleId: { not: null } } })) {
    if (!garde(f.id)) continue;
    const p = proposerFaq(f);
    ajouter(p, `faq:${f.id}`, f as unknown as Champs, null);
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
    ajouter(p, `job_offer:${j.id}`, j as unknown as Champs, `/fr/carrieres/${j.slug}`);
  }
  // Un override dont le contenu n'a pas été lu (id inconnu, filtré par --only exclu) : jamais silencieux.
  for (const cle of Object.keys(overrides))
    if (!vus.has(cle) && garde(cle.slice(cle.indexOf(":") + 1)))
      ignores.push(`${cle} : contenu introuvable (ou hors périmètre), override ignoré`);
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

/** Adaptateur Prisma du dépôt d'écriture (la logique, testée, est dans `ecriture.ts`). */
const depot: Depot = {
  existe: async (action, cle) =>
    !!(await prisma.contentGenAuditLog.findFirst({
      where: { action, settingKey: cle },
      select: { id: true },
    })),
  existeApres: async (action, cle, apres) =>
    !!(await prisma.contentGenAuditLog.findFirst({
      where: { action, settingKey: cle, createdAt: { gt: apres } },
      select: { id: true },
    })),
  lignes: (actions) =>
    prisma.contentGenAuditLog.findMany({
      where: { action: { in: actions } },
      orderBy: { createdAt: "desc" },
    }),
  transaction: (f) =>
    prisma.$transaction((tx) =>
      f({
        lire: (table, id) => delegue(tx, table).findUnique({ where: { id } }),
        ecrire: async (table, id, champs) => {
          await delegue(tx, table).update({ where: { id }, data: donnees(champs) });
        },
        journaliser: async (e) => {
          await tx.contentGenAuditLog.create({
            data: {
              action: e.action,
              settingKey: e.settingKey,
              oldValue: e.oldValue as Prisma.InputJsonValue,
              newValue: e.newValue as Prisma.InputJsonValue,
              actorEmail: ACTEUR,
            },
          });
        },
      }),
    ),
};

// ───────────────────────────── rapport ─────────────────────────────

/** Rapport : textes PUBLICS seulement (passage retiré + contexte + remplacement), jamais le dump. */
function ecrireRapport(
  fichier: string,
  o: Options,
  p: Proposition[],
  ignores: string[],
  sha: string,
): void {
  fs.writeFileSync(fichier, construireRapport(o.mode, p, ignores, sha));
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const o = lireOptions(process.argv.slice(2));
  console.log(`── Retrait des mentions de financement : mode ${o.mode} ──`);

  if (o.mode === "restore") {
    const r = await restaurer(depot, o.only, urlsDe);
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
    `Contenus concernés : ${r.total} · à réécrire : ${r.a_reecrire}${r.partiels > 0 ? ` + ${r.partiels} partiels` : ""} · ambigus : ${r.ambigus}`,
  );
  console.log(`PLAN_SHA=${sha}`);
  for (const i of ignores) console.log(`⚠ override ignoré : ${i}`);
  for (const p of propositions)
    for (const [champ, termes] of Object.entries(p.conservesSurDecision ?? {}))
      console.log(`✔ conservé sur décision : ${p.cle}.${champ} (${termes.join(", ")})`);
  for (const x of ambigusNonCouverts(propositions))
    console.log(`⛔ ambigu non couvert : ${x.cle}.${x.champ}`);
  if (o.rapport) ecrireRapport(o.rapport, o, propositions, ignores, sha);
  if (o.urls) fs.writeFileSync(o.urls, `${urls.join("\n")}\n`);

  if (o.mode === "dry-run") {
    console.log("Essai à blanc : RIEN n'a été écrit en base.");
    return;
  }
  refuserSiAmbigus(propositions, o.overrides);
  if (!o.planSha) throw new Error("--apply exige --plan-sha=<empreinte de l'essai à blanc>.");
  if (o.planSha !== sha)
    throw new Error(
      `Empreinte du plan différente (essai à blanc ${o.planSha}, maintenant ${sha}) : refus. Relancer l'essai à blanc.`,
    );
  const e = await appliquer(depot, propositions);
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
