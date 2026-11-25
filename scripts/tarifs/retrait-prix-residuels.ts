/**
 * Retrait des derniers anciens prix affichés (2026-11) : 2 FAQ + boutons d'appel à l'action (CTA)
 * des articles. Règle de Will : seul prix public = Journée IA 1 490 € HT, le reste « sur devis ».
 * Règles pures : `prix-residuels-regles.ts` (testées). Ce fichier ne fait que lire/écrire en base.
 *
 *   --dry-run (défaut)              lecture seule : rapport, liste d'URL, PLAN_SHA
 *   --apply --plan-sha=<sha>        écrit (refus si le plan a changé depuis le dry-run)
 *   --restore                       remet les valeurs d'origine (seulement si la valeur actuelle
 *                                   est celle écrite par l'apply)
 *   --report=<fichier>  --urls=<fichier>  --sauvegarde=<fichier>  (apply : obligatoire)
 *   --sans-controle-sauvegarde      copie jetable seulement : saute l'exigence d'une sauvegarde < 24 h
 *
 * Garanties : aucun DELETE, aucun changement de slug / statut / indexationTier, aucun appel IA.
 * Chaque ligne : audit log + UPDATE CONDITIONNEL (valeur d'origine) dans UNE transaction.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";

import { Prisma, PrismaClient } from "../../prisma/generated/client";

import {
  ANCIENS_MONTANTS_RE,
  FAQ_CIBLES,
  LIBELLES_CTA_SQL,
  contientCtaAvecMontant,
  jsonContientCtaAvecMontant,
  planifierFaq,
  retirerMontantCta,
  retirerMontantCtaJson,
} from "./prix-residuels-regles";

export const ACTION = "retrait-prix-residuels-2026-11";
export const ACTION_RESTORE = `${ACTION}-restore`;
const DESCRIPTION = "script:retrait-prix-residuels";

type Table = "faqs" | "article_translations";

/** Colonnes autorisées en écriture (liste blanche : seuls ces noms entrent dans le SQL). */
const COLONNES: Record<Table, Record<string, { json: boolean }>> = {
  faqs: { answer_fr: { json: false }, answer_en: { json: false } },
  article_translations: {
    body: { json: false },
    body_text: { json: false },
    body_json: { json: true },
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_SUR_RE = /^[A-Za-z0-9._~-]+$/;
const SHA_RE = /^[0-9a-f]{64}$/;

interface Champ {
  colonne: string;
  avant: unknown;
  apres: unknown;
}

interface Ligne {
  table: Table;
  id: string;
  cle: string; // "<table>:<id>"
  libelle: string; // pour le rapport
  champs: Champ[];
  remplacements: number;
  /** Pour la purge du cache. */
  urls: string[];
}

interface Plan {
  lignes: Ligne[];
  aRevoir: string[];
  notes: string[];
  urls: string[];
}

class ChangeEntreTemps extends Error {}

const prisma = new PrismaClient();

// ───────────────────────────── options ─────────────────────────────

type Mode = "dry-run" | "apply" | "restore";

interface Options {
  mode: Mode;
  planSha?: string;
  rapport?: string;
  urls?: string;
  sauvegarde?: string;
  sansControleSauvegarde: boolean;
}

export function lireOptions(argv: string[]): Options {
  const modes: Mode[] = [];
  const o: Options = { mode: "dry-run", sansControleSauvegarde: false };
  for (const a of argv) {
    if (a === "--dry-run") modes.push("dry-run");
    else if (a === "--apply") modes.push("apply");
    else if (a === "--restore") modes.push("restore");
    else if (a === "--sans-controle-sauvegarde") o.sansControleSauvegarde = true;
    else if (a.startsWith("--plan-sha=")) o.planSha = a.slice("--plan-sha=".length);
    else if (a.startsWith("--report=")) o.rapport = a.slice("--report=".length);
    else if (a.startsWith("--urls=")) o.urls = a.slice("--urls=".length);
    else if (a.startsWith("--sauvegarde=")) o.sauvegarde = a.slice("--sauvegarde=".length);
    else throw new Error(`Option inconnue : ${a}`);
  }
  if (modes.length > 1) throw new Error("Un seul mode à la fois (--dry-run, --apply, --restore).");
  if (modes[0]) o.mode = modes[0];
  if (o.planSha !== undefined && !SHA_RE.test(o.planSha))
    throw new Error("--plan-sha : 64 caractères hexadécimaux attendus.");
  if (o.mode === "apply" && !o.planSha) throw new Error("--apply exige --plan-sha=<sha>.");
  if (o.mode === "apply" && !o.sauvegarde)
    throw new Error("--apply exige --sauvegarde=<fichier.json> (valeurs d'origine).");
  return o;
}

// ───────────────────────────── plan ─────────────────────────────

const URLS_FAQ_FIXES = [
  "/fr/faq",
  "/fr/faq/feed.xml",
  "/fr/faq/par-thematique",
  "/fr/faq/par-thematique/pricing",
  "/fr/faq/par-thematique/implementation",
];

function extrait(s: string, n = 160): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** Extrait lisible autour du premier CTA avec montant (pour le rapport). */
function extraitCta(valeur: unknown): string {
  const s = typeof valeur === "string" ? valeur : JSON.stringify(valeur ?? null);
  const i = s.search(/R[ée]server|Faire faire/);
  return extrait(i >= 0 ? s.slice(i, i + 220) : s, 160);
}

interface LigneFaq {
  id: string;
  slug: string;
  answerFr: string;
  answerEn: string;
  metaDescription: string | null;
  status: string;
}

interface LigneArticle {
  id: string;
  slug: string;
  locale: string;
  body: string;
  bodyText: string | null;
  bodyJson: unknown;
  status: string;
  isNews: boolean;
  slugFr: string | null;
}

export async function construirePlan(): Promise<Plan> {
  const lignes: Ligne[] = [];
  const aRevoir: string[] = [];
  const notes: string[] = [];
  const slugsCibles = FAQ_CIBLES.map((c) => c.slug);

  // 1. Les 2 FAQ cibles.
  const faqs = await prisma.$queryRaw<LigneFaq[]>(Prisma.sql`
    SELECT id::text AS id, slug, answer_fr AS "answerFr", answer_en AS "answerEn",
           meta_description AS "metaDescription", status::text AS status
    FROM faqs WHERE slug = ANY(${slugsCibles}::text[])`);
  for (const c of FAQ_CIBLES) {
    if (!faqs.some((f) => f.slug === c.slug)) notes.push(`FAQ absente de la base : ${c.slug}`);
  }
  for (const f of faqs) {
    const p = planifierFaq(f.slug, {
      answerFr: f.answerFr,
      answerEn: f.answerEn,
      metaDescription: f.metaDescription,
    });
    if (!p) continue;
    for (const champ of p.aRevoir)
      aRevoir.push(`faqs:${f.id} (${f.slug}) ${champ} : « ${extrait(f.metaDescription ?? "")} »`);
    const champs: Champ[] = [];
    if (p.ecritures.answerFr !== undefined)
      champs.push({ colonne: "answer_fr", avant: f.answerFr, apres: p.ecritures.answerFr });
    if (p.ecritures.answerEn !== undefined)
      champs.push({ colonne: "answer_en", avant: f.answerEn, apres: p.ecritures.answerEn });
    if (champs.length === 0) continue;
    lignes.push({
      table: "faqs",
      id: f.id,
      cle: `faqs:${f.id}`,
      libelle: `FAQ ${f.slug} (${f.status})`,
      champs,
      remplacements: champs.length,
      urls: [`/fr/faq/${f.slug}`],
    });
  }

  // 2. CTA d'article : filtre SQL large (libellé), puis règle exacte en JS.
  const articles = await prisma.$queryRaw<LigneArticle[]>(Prisma.sql`
    SELECT t.id::text AS id, t.slug, t.locale::text AS locale, t.body, t.body_text AS "bodyText",
           t.body_json AS "bodyJson", a.status::text AS status, a.is_news AS "isNews",
           (SELECT f.slug FROM article_translations f
             WHERE f.article_id = t.article_id AND f.locale::text = 'fr' LIMIT 1) AS "slugFr"
    FROM article_translations t JOIN articles a ON a.id = t.article_id
    WHERE t.body ~ ${LIBELLES_CTA_SQL} OR t.body_text ~ ${LIBELLES_CTA_SQL}
       OR t.body_json::text ~ ${LIBELLES_CTA_SQL}`);
  for (const t of articles) {
    const champs: Champ[] = [];
    let n = 0;
    const b = retirerMontantCta(t.body);
    if (b.remplacements > 0) {
      champs.push({ colonne: "body", avant: t.body, apres: b.texte });
      n += b.remplacements;
    }
    if (t.bodyText !== null) {
      const x = retirerMontantCta(t.bodyText);
      if (x.remplacements > 0) {
        champs.push({ colonne: "body_text", avant: t.bodyText, apres: x.texte });
        n += x.remplacements;
      }
    }
    if (t.bodyJson !== null && t.bodyJson !== undefined) {
      const j = retirerMontantCtaJson(t.bodyJson);
      if (j.remplacements > 0) {
        champs.push({ colonne: "body_json", avant: t.bodyJson, apres: j.valeur });
        n += j.remplacements;
      }
    }
    if (champs.length === 0) continue;
    const slugFr = t.slugFr ?? (t.locale === "fr" ? t.slug : null);
    const urls: string[] = [];
    if (slugFr && SLUG_SUR_RE.test(slugFr)) {
      urls.push(`/fr/blog/${slugFr}`);
      if (t.isNews) urls.push(`/fr/actualites/${slugFr}`);
    } else
      notes.push(`article_translations:${t.id} : pas de slug français sûr, aucune URL à purger`);
    lignes.push({
      table: "article_translations",
      id: t.id,
      cle: `article_translations:${t.id}`,
      libelle: `Article ${t.slug} [${t.locale}] statut ${t.status}${t.isNews ? " actualité" : ""} — ${extraitCta(t.body)}`,
      champs,
      remplacements: n,
      urls,
    });
  }

  // 3. « À revoir » : jamais écrit.
  const autresFaq = await prisma.$queryRaw<
    Array<{ id: string; slug: string; answerFr: string; answerEn: string }>
  >(Prisma.sql`
    SELECT id::text AS id, slug, answer_fr AS "answerFr", answer_en AS "answerEn"
    FROM faqs
    WHERE NOT (slug = ANY(${slugsCibles}::text[])) AND (answer_fr LIKE '%€%' OR answer_en LIKE '%€%')`);
  for (const f of autresFaq) {
    for (const [champ, v] of [
      ["answer_fr", f.answerFr],
      ["answer_en", f.answerEn],
    ] as const) {
      if (ANCIENS_MONTANTS_RE.test(v))
        aRevoir.push(`faqs:${f.id} (${f.slug}) ${champ} : « ${extrait(v)} »`);
    }
  }
  const articlesRevoir = await prisma.$queryRaw<
    Array<{
      id: string;
      faqJson: unknown;
      directAnswer: string | null;
      keyTakeaway: string | null;
      status: string;
    }>
  >(Prisma.sql`
    SELECT id::text AS id, faq_json AS "faqJson", direct_answer AS "directAnswer",
           key_takeaway AS "keyTakeaway", status::text AS status
    FROM articles
    WHERE faq_json::text ~ ${LIBELLES_CTA_SQL} OR direct_answer ~ ${LIBELLES_CTA_SQL}
       OR key_takeaway ~ ${LIBELLES_CTA_SQL}`);
  for (const a of articlesRevoir) {
    if (a.faqJson != null && jsonContientCtaAvecMontant(a.faqJson))
      aRevoir.push(`articles:${a.id} (${a.status}) faq_json : « ${extraitCta(a.faqJson)} »`);
    if (contientCtaAvecMontant(a.directAnswer))
      aRevoir.push(
        `articles:${a.id} (${a.status}) direct_answer : « ${extraitCta(a.directAnswer)} »`,
      );
    if (contientCtaAvecMontant(a.keyTakeaway))
      aRevoir.push(
        `articles:${a.id} (${a.status}) key_takeaway : « ${extraitCta(a.keyTakeaway)} »`,
      );
  }

  // 4. URL à purger : pages FAQ (les fiches affichent des FAQ liées) + articles touchés.
  const faqPubliees = await prisma.$queryRaw<Array<{ slug: string }>>(
    Prisma.sql`SELECT slug FROM faqs WHERE status::text = 'published' ORDER BY slug`,
  );
  const urls = new Set<string>(URLS_FAQ_FIXES);
  for (const f of faqPubliees) if (SLUG_SUR_RE.test(f.slug)) urls.add(`/fr/faq/${f.slug}`);
  for (const l of lignes) for (const u of l.urls) urls.add(u);

  lignes.sort((a, b) => (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0));
  return { lignes, aRevoir: aRevoir.sort(), notes, urls: [...urls] };
}

/** Empreinte du plan trié : si une valeur change entre dry-run et apply, l'empreinte change. */
export function empreintePlan(lignes: Ligne[]): string {
  const tri = [...lignes].sort((a, b) => (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0));
  const h = createHash("sha256");
  h.update(
    stable(
      tri.map((l) => ({
        cle: l.cle,
        champs: l.champs.map((c) => ({ colonne: c.colonne, avant: c.avant, apres: c.apres })),
      })),
    ),
  );
  return h.digest("hex");
}

/** JSON canonique (clés triées) : comparaison et empreinte indépendantes de l'ordre des clés. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

// ───────────────────────────── SQL ─────────────────────────────

function colonneSure(table: Table, colonne: string): { json: boolean } {
  const c = COLONNES[table]?.[colonne];
  if (!c) throw new Error(`Colonne non autorisée : ${table}.${colonne}`);
  return c;
}

function valeurSql(json: boolean, v: unknown): unknown {
  return json ? JSON.stringify(v) : (v as string);
}

/**
 * UPDATE conditionnel : seulement si chaque colonne a encore la valeur `condition`.
 * Rend le nombre de lignes touchées (0 ou 1).
 */
async function majConditionnelle(
  tx: Prisma.TransactionClient,
  table: Table,
  id: string,
  champs: Array<{ colonne: string; nouvelle: unknown; condition: unknown }>,
): Promise<number> {
  if (!UUID_RE.test(id)) throw new Error(`Identifiant invalide : ${id}`);
  const params: unknown[] = [id];
  const sets: string[] = [];
  const conds: string[] = [];
  for (const c of champs) {
    const { json } = colonneSure(table, c.colonne);
    params.push(valeurSql(json, c.nouvelle));
    sets.push(`"${c.colonne}" = $${params.length}${json ? "::jsonb" : ""}`);
  }
  for (const c of champs) {
    const { json } = colonneSure(table, c.colonne);
    params.push(valeurSql(json, c.condition));
    conds.push(`"${c.colonne}" = $${params.length}${json ? "::jsonb" : ""}`);
  }
  const sql = `UPDATE "${table}" SET ${sets.join(", ")} WHERE id = $1::uuid AND ${conds.join(" AND ")}`;
  return tx.$executeRawUnsafe(sql, ...params);
}

// ───────────────────────────── contrôles ─────────────────────────────

async function exigerSauvegarde(): Promise<void> {
  const r = await prisma.backupRun.findFirst({
    where: {
      component: "postgres",
      status: "success",
      startedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
    },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  if (!r) throw new Error("AUCUNE sauvegarde postgres réussie de moins de 24 h : apply refusé.");
  console.log(`Dernière sauvegarde postgres : ${r.startedAt.toISOString()}`);
}

// ───────────────────────────── apply ─────────────────────────────

async function appliquer(lignes: Ligne[]): Promise<{ ecrites: number; perdues: string[] }> {
  let ecrites = 0;
  const perdues: string[] = [];
  for (const l of lignes) {
    const ancien: Record<string, unknown> = {};
    const nouveau: Record<string, unknown> = {};
    for (const c of l.champs) {
      ancien[c.colonne] = c.avant;
      nouveau[c.colonne] = c.apres;
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.contentGenAuditLog.create({
          data: {
            action: ACTION,
            settingKey: l.cle,
            oldValue: ancien as Prisma.InputJsonValue,
            newValue: nouveau as Prisma.InputJsonValue,
            actorEmail: null,
            description: DESCRIPTION,
          },
        });
        const n = await majConditionnelle(
          tx,
          l.table,
          l.id,
          l.champs.map((c) => ({ colonne: c.colonne, nouvelle: c.apres, condition: c.avant })),
        );
        if (n !== 1) throw new ChangeEntreTemps(); // annule aussi l'audit log
      });
      ecrites++;
    } catch (err) {
      if (err instanceof ChangeEntreTemps) {
        perdues.push(l.cle);
        console.log(`⚠ ${l.cle} a changé entre-temps : laissé tel quel (rollback).`);
      } else throw err;
    }
  }
  return { ecrites, perdues };
}

// ───────────────────────────── restore ─────────────────────────────

function estObjet(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

async function restaurer(): Promise<{ restaures: number; divergences: string[]; urls: string[] }> {
  const logs = await prisma.contentGenAuditLog.findMany({
    where: { action: ACTION },
    orderBy: { createdAt: "desc" },
  });
  let restaures = 0;
  const divergences: string[] = [];
  const urls = new Set<string>();
  let faqTouchee = false;
  for (const log of logs) {
    const cle = log.settingKey ?? "";
    const [table, id] = cle.split(":") as [Table, string];
    if (
      !(table in COLONNES) ||
      !UUID_RE.test(id ?? "") ||
      !estObjet(log.oldValue) ||
      !estObjet(log.newValue)
    ) {
      divergences.push(`${cle} : entrée d'audit illisible, ignorée`);
      continue;
    }
    const colonnes = Object.keys(log.newValue);
    if (colonnes.length === 0 || colonnes.some((c) => !(c in COLONNES[table]))) {
      divergences.push(`${cle} : colonnes inattendues, ignorée`);
      continue;
    }
    const liste = colonnes.map((c) => `"${c}"`).join(", ");
    const actuel = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ${liste} FROM "${table}" WHERE id = $1::uuid`,
      id,
    );
    const ligne = actuel[0];
    if (!ligne) {
      divergences.push(`${cle} : ligne introuvable`);
      continue;
    }
    if (
      !colonnes.every(
        (c) => stable(ligne[c]) === stable((log.newValue as Record<string, unknown>)[c]),
      )
    ) {
      divergences.push(
        `${cle} : valeur actuelle différente de celle écrite (déjà restaurée ou modifiée) : laissée`,
      );
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        const n = await majConditionnelle(
          tx,
          table,
          id,
          colonnes.map((c) => ({
            colonne: c,
            nouvelle: (log.oldValue as Record<string, unknown>)[c],
            condition: (log.newValue as Record<string, unknown>)[c],
          })),
        );
        if (n !== 1) throw new ChangeEntreTemps();
        await tx.contentGenAuditLog.create({
          data: {
            action: ACTION_RESTORE,
            settingKey: cle,
            oldValue: log.newValue as Prisma.InputJsonValue,
            newValue: log.oldValue as Prisma.InputJsonValue,
            actorEmail: null,
            description: DESCRIPTION,
          },
        });
      });
      restaures++;
    } catch (err) {
      if (err instanceof ChangeEntreTemps) {
        divergences.push(`${cle} : a changé entre-temps, laissée`);
        continue;
      }
      throw err;
    }
    if (table === "faqs") {
      faqTouchee = true;
      const f = await prisma.$queryRaw<Array<{ slug: string }>>(
        Prisma.sql`SELECT slug FROM faqs WHERE id = ${id}::uuid`,
      );
      if (f[0] && SLUG_SUR_RE.test(f[0].slug)) urls.add(`/fr/faq/${f[0].slug}`);
    } else {
      const a = await prisma.$queryRaw<
        Array<{ slugFr: string | null; isNews: boolean }>
      >(Prisma.sql`
        SELECT (SELECT f.slug FROM article_translations f
                 WHERE f.article_id = t.article_id AND f.locale::text = 'fr' LIMIT 1) AS "slugFr",
               a.is_news AS "isNews"
        FROM article_translations t JOIN articles a ON a.id = t.article_id WHERE t.id = ${id}::uuid`);
      const s = a[0]?.slugFr;
      if (s && SLUG_SUR_RE.test(s)) {
        urls.add(`/fr/blog/${s}`);
        if (a[0]?.isNews) urls.add(`/fr/actualites/${s}`);
      }
    }
  }
  if (faqTouchee) {
    for (const u of URLS_FAQ_FIXES) urls.add(u);
    const pub = await prisma.$queryRaw<Array<{ slug: string }>>(
      Prisma.sql`SELECT slug FROM faqs WHERE status::text = 'published' ORDER BY slug`,
    );
    for (const f of pub) if (SLUG_SUR_RE.test(f.slug)) urls.add(`/fr/faq/${f.slug}`);
  }
  return { restaures, divergences, urls: [...urls] };
}

// ───────────────────────────── rapport ─────────────────────────────

function rapport(mode: Mode, plan: Plan, sha: string): string {
  const out: string[] = [
    `# Retrait des prix résiduels — mode ${mode}`,
    "",
    `- à réécrire : ${plan.lignes.length}`,
    `- à revoir (jamais écrit) : ${plan.aRevoir.length}`,
    `- URL à purger : ${plan.urls.length}`,
    `- PLAN_SHA=${sha}`,
    "",
    "## À réécrire",
  ];
  for (const l of plan.lignes) {
    out.push(
      `- ${l.cle} — ${l.libelle} — colonnes : ${l.champs.map((c) => c.colonne).join(", ")} — remplacements : ${l.remplacements}`,
    );
  }
  out.push("", "## À revoir (jamais écrit automatiquement)");
  for (const r of plan.aRevoir) out.push(`- ${r}`);
  if (plan.notes.length > 0) {
    out.push("", "## Notes");
    for (const n of plan.notes) out.push(`- ${n}`);
  }
  return `${out.join("\n")}\n`;
}

// ───────────────────────────── main ─────────────────────────────

async function main(): Promise<void> {
  const o = lireOptions(process.argv.slice(2));
  console.log(`── Retrait des prix résiduels : mode ${o.mode} ──`);

  if (o.mode === "restore") {
    const r = await restaurer();
    console.log(`Restaurés : ${r.restaures}`);
    for (const d of r.divergences) console.log(`⚠ ${d}`);
    if (o.rapport)
      fs.writeFileSync(
        o.rapport,
        `# Restauration des prix résiduels\n\n- restaurés : ${r.restaures}\n${r.divergences.map((d) => `- ⚠ ${d}`).join("\n")}\n`,
      );
    if (o.urls) fs.writeFileSync(o.urls, r.urls.length > 0 ? `${r.urls.join("\n")}\n` : "");
    return;
  }

  const plan = await construirePlan();
  const sha = empreintePlan(plan.lignes);
  console.log(`à réécrire : ${plan.lignes.length}`);
  console.log(`à revoir : ${plan.aRevoir.length}`);
  console.log(`PLAN_SHA=${sha}`);
  for (const n of plan.notes) console.log(`note : ${n}`);
  for (const r of plan.aRevoir) console.log(`à revoir → ${r}`);
  if (o.rapport) fs.writeFileSync(o.rapport, rapport(o.mode, plan, sha));
  if (o.urls) fs.writeFileSync(o.urls, `${plan.urls.join("\n")}\n`);

  if (o.mode === "dry-run") {
    console.log("Essai à blanc : RIEN n'a été écrit en base.");
    return;
  }

  // apply
  if (sha !== o.planSha) {
    console.error(`Le plan a changé depuis le dry-run (PLAN_SHA recalculé ${sha}) : apply refusé.`);
    process.exit(3);
  }
  if (o.sansControleSauvegarde) console.log("⚠ contrôle de sauvegarde sauté (copie jetable).");
  else await exigerSauvegarde();
  fs.writeFileSync(
    o.sauvegarde!,
    JSON.stringify(
      plan.lignes.map((l) => ({
        cle: l.cle,
        champs: l.champs.map((c) => ({ colonne: c.colonne, avant: c.avant })),
      })),
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Sauvegarde des valeurs d'origine : ${o.sauvegarde}`);
  const r = await appliquer(plan.lignes);
  console.log(`Écrites : ${r.ecrites}/${plan.lignes.length}`);
  if (r.perdues.length > 0) {
    console.error(`${r.perdues.length} ligne(s) ont changé entre-temps : relancer un dry-run.`);
    process.exitCode = 4;
  }
}

if (process.argv[1]?.includes("retrait-prix-residuels")) {
  main()
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
