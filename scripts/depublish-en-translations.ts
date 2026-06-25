// Dépublication DÉFINITIVE des traductions ANGLAISES auto-générées (one-shot prod).
//
// CONTEXTE (audit 2026-06-25 + décision Will « EN à fond ») : la doctrine content-gen
// est FR-only (EN désactivé 2026-05-16, proxy 301 + sitemaps filtrés). Or la base
// contenait 5 `article_translations` locale=en `published` + tier_1_indexable (slugs EN).
// `indexation_tier` vit sur `articles` (PARTAGÉ FR+EN) → impossible de noindexer le
// seul EN par le tier. La défense anti-index repose donc UNIQUEMENT sur le proxy+flag.
// Ce script SUPPRIME les rows de traduction EN pour rendre la protection STRUCTURELLE
// (plus aucun contenu EN en base → rien à indexer même si le flag bascule).
//
// SÛR : on supprime des `*_translations` (locale != 'fr'), JAMAIS les `articles` (la
// version FR reste intacte). Aucun code content-gen ne recrée de traduction EN
// (targetLocale:"fr" — vérifié). Idempotent (re-run = 0 suppression).
//
// Usage :
//   pnpm tsx scripts/depublish-en-translations.ts                      # DRY-RUN (rapport seul)
//   pnpm tsx scripts/depublish-en-translations.ts --apply              # supprime les article EN
//   pnpm tsx scripts/depublish-en-translations.ts --apply --case-studies  # + les case-study EN (éditorial)
//
// `--case-studies` est OPT-IN explicite : les `case_study_translations` EN sont du
// contenu ÉDITORIAL (rédigé main), pas du content-gen FR-only. À ne supprimer que si
// Will confirme « EN à fond » sur l'éditorial aussi.
//
// En prod : exécuter DANS le conteneur (DATABASE_URL réel injecté par Coolify).

import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "../prisma/generated/client";

// Confort local : charge .env.local si DATABASE_URL absent (no-op en prod conteneur).
if (!process.env["DATABASE_URL"] && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

const APPLY = process.argv.includes("--apply");
const CASE_STUDIES = process.argv.includes("--case-studies");
const prisma = new PrismaClient();

async function main() {
  console.log(`\n=== Dépublication traductions EN ===  mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  // 1. Inventaire (lecture seule) — toutes les tables de traduction porteuses d'un
  //    `locale`/`languageCode`. On RAPPORTE tout ; on SUPPRIME seulement les
  //    article_translations EN (= le contenu auto-généré indexable). Les autres
  //    tables (éditoriales) sont signalées pour décision Will.
  const enArticles = await prisma.$queryRawUnsafe<Array<{ locale: string; n: number }>>(
    `select locale, count(*)::int n from article_translations where locale <> 'fr' group by locale`,
  );
  console.log("article_translations (locale != fr) :", JSON.stringify(enArticles));

  // Détail des articles concernés (pour la trace).
  const detail = await prisma.$queryRawUnsafe<
    Array<{ slug: string; status: string; tier: string }>
  >(
    `select at.slug, a.status, a.indexation_tier tier
       from article_translations at join articles a on a.id = at.article_id
      where at.locale <> 'fr' order by at.slug`,
  );
  for (const d of detail) console.log(`  - ${d.slug}  [${d.status} / ${d.tier}]`);

  // Inventaire informatif des autres tables de traduction (NON supprimées ici).
  for (const t of ["knowledge_translations", "case_study_translations"]) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ locale: string; n: number }>>(
        `select locale, count(*)::int n from ${t} where locale <> 'fr' group by locale`,
      );
      console.log(`${t} (locale != fr) :`, rows.length ? JSON.stringify(rows) : "0 (rien)");
    } catch {
      console.log(`${t} : (table absente / pas de colonne locale — ignorée)`);
    }
  }

  // 2. Suppression (APPLY uniquement) — article_translations EN.
  if (!APPLY) {
    console.log(
      `\nDRY-RUN : ${detail.length} traduction(s) EN seraient supprimées. ` +
        `Relancer avec --apply pour exécuter.\n`,
    );
    return;
  }

  const res = await prisma.articleTranslation.deleteMany({ where: { locale: { not: "fr" } } });
  console.log(`\n✅ ${res.count} traduction(s) article EN SUPPRIMÉE(S).`);

  const remaining = await prisma.articleTranslation.count({ where: { locale: { not: "fr" } } });
  console.log(`Vérif post-suppression — article_translations EN restantes : ${remaining}`);

  // Éditorial (opt-in) — case_study_translations EN.
  if (CASE_STUDIES) {
    const r2 = await prisma.$executeRawUnsafe(
      `delete from case_study_translations where locale <> 'fr'`,
    );
    console.log(`✅ ${r2} traduction(s) case-study EN SUPPRIMÉE(S) (--case-studies).`);
  } else {
    console.log(
      `ℹ️  case_study_translations EN NON touchées (éditorial). Ajouter --case-studies pour les retirer aussi.`,
    );
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("ERREUR :", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
