/**
 * Seed ciblé : met à jour les 2 offres FORMATEUR (présentiel itinérant + distanciel)
 * avec le contenu enrichi (sections « Où tu interviens » / « Partout en France, à
 * distance » — couverture régions/métropoles anti-doorway, dans UNE annonce par mode).
 *
 * Réutilise `careers_seed_input.json` (mêmes métadonnées + `cities` pour le multi-
 * location de l'itinérant) mais N'UPSERT QUE ces 2 slugs. Idempotent (upsert).
 * FR-only (EN = FR). Pas de validThrough (offres permanentes).
 *
 * Lancement : pnpm tsx scripts/seed-careers-formateur.ts  (DATABASE_URL de l'env)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../prisma/generated/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INPUT = path.join(ROOT, "careers_seed_input.json");
const GEN_DIR = path.join(ROOT, "careers-gen");
const SLUGS = new Set(["formateur-ia-itinerant", "formateur-ia-sedentaire"]);

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

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const cut = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

async function main() {
  const input = JSON.parse(fs.readFileSync(INPUT, "utf8")) as {
    postes: Poste[];
    cities?: Array<{ city: string; region: string }>;
  };
  const ALL_CITIES = [...(input.cities ?? [])];

  let updated = 0;
  let created = 0;
  const missing: string[] = [];

  for (const p of input.postes.filter((x) => SLUGS.has(x.slug))) {
    const genPath = path.join(GEN_DIR, `${p.slug}.json`);
    if (!fs.existsSync(genPath)) {
      missing.push(p.slug);
      continue;
    }
    const c = JSON.parse(fs.readFileSync(genPath, "utf8")) as GenContent;
    const bodyText = stripHtml(c.bodyFrHtml);
    const salaryVisible = Boolean(p.sal_min || p.sal_max);
    const jobLocations = p.multiCity ? ALL_CITIES : null;

    const data = {
      slug: p.slug,
      status: "published" as const,
      category: p.categorie as never,
      titleFr: cut(c.titleFr, 160),
      titleEn: cut(c.titleFr, 160),
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
      ...(jobLocations ? { jobLocations } : {}),
    };

    const existing = await prisma.jobOffer.findUnique({ where: { slug: p.slug }, select: { id: true } });
    await prisma.jobOffer.upsert({
      where: { slug: p.slug },
      create: data,
      update: (({ publishedAt: _p, ...rest }) => rest)(data),
    });
    if (existing) updated++;
    else created++;
    console.log(`  ✓ ${p.slug}${jobLocations ? ` (${jobLocations.length} villes)` : ""}`);
  }

  console.log(
    `\n=== SEED FORMATEUR TERMINÉ : ${created} créées, ${updated} mises à jour${
      missing.length ? `, manquantes : ${missing.join(", ")}` : ""
    } ===`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ ERREUR SEED FORMATEUR:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
