/**
 * Seed des 10 offres d'emploi tech/IA au siège de Grenoble (2026-07).
 *
 * Modèle : identique à `seed-careers-offers.ts` (même qualité), mais input dédié
 * `careers_grenoble_input.json` → n'upsert QUE ces 10 slugs (ne touche pas les 44).
 * Contenu rédigé dans `careers-gen/<slug>.json` (titleFr, summaryFr, bodyFrHtml,
 * metaTitle, metaDescription). Upsert idempotent par slug → relançable.
 * FR-only (EN = FR). Salaire affiché (directive UE 2023/970). Pas de validThrough
 * (offres permanentes : retrait manuel via console).
 *
 * Lancement :
 *   pnpm tsx scripts/seed-careers-grenoble.ts            (DATABASE_URL de l'env)
 *   DATABASE_URL=... pnpm tsx scripts/seed-careers-grenoble.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../prisma/generated/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INPUT = path.join(ROOT, "careers_grenoble_input.json");
const GEN_DIR = path.join(ROOT, "careers-gen");

const prisma = new PrismaClient();

interface Poste {
  slug: string;
  num: number;
  categorie: string;
  emploi: string;
  sal_min: number;
  sal_max: number;
  workMode: string;
  multiCity: boolean;
  city: string | null;
}
interface GenContent {
  titleFr: string;
  summaryFr: string;
  bodyFrHtml: string;
  metaTitle: string;
  metaDescription: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Troncature défensive aux limites des colonnes. */
const cut = (s: string, n: number): string =>
  s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";

async function main() {
  const input = JSON.parse(fs.readFileSync(INPUT, "utf8")) as { postes: Poste[] };

  let created = 0;
  let updated = 0;
  const missing: string[] = [];

  for (const p of input.postes) {
    const genPath = path.join(GEN_DIR, `${p.slug}.json`);
    if (!fs.existsSync(genPath)) {
      missing.push(p.slug);
      continue;
    }
    const c = JSON.parse(fs.readFileSync(genPath, "utf8")) as GenContent;
    const bodyText = stripHtml(c.bodyFrHtml);
    const salaryVisible = Boolean(p.sal_min || p.sal_max);

    const data = {
      slug: p.slug,
      status: "published" as const,
      category: p.categorie as never,
      titleFr: cut(c.titleFr, 160),
      titleEn: cut(c.titleFr, 160), // FR-only : EN = FR
      summaryFr: cut(c.summaryFr, 320),
      summaryEn: cut(c.summaryFr, 320),
      bodyFr: c.bodyFrHtml,
      bodyTextFr: bodyText,
      bodyEn: c.bodyFrHtml,
      bodyTextEn: bodyText,
      employmentType: p.emploi,
      workMode: p.workMode as never,
      city: p.city,
      region: p.city === "Grenoble" ? "Isère" : null,
      country: "FR",
      salaryMin: p.sal_min || null,
      salaryMax: p.sal_max || null,
      salaryVisible,
      salaryPeriod: "YEAR",
      salaryCurrency: "EUR",
      metaTitle: cut(c.metaTitle, 70),
      metaDescription: cut(c.metaDescription, 160),
      indexationTier: "tier_1_indexable" as const,
      displayOrder: p.num,
      publishedAt: new Date(),
      // Pas de validThrough : offre permanente jusqu'au retrait manuel.
    };

    const existing = await prisma.jobOffer.findUnique({
      where: { slug: p.slug },
      select: { id: true },
    });
    await prisma.jobOffer.upsert({
      where: { slug: p.slug },
      create: data,
      // En update, on ne réécrase pas publishedAt s'il existe déjà.
      update: (({ publishedAt: _publishedAt, ...rest }) => rest)(data),
    });
    if (existing) updated++;
    else created++;
    console.log(`  ✓ ${p.slug}`);
  }

  console.log(
    `\n=== SEED GRENOBLE TERMINÉ : ${created} créées, ${updated} mises à jour${
      missing.length ? `, ${missing.length} manquantes : ${missing.join(", ")}` : ""
    } ===`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ ERREUR SEED GRENOBLE:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
