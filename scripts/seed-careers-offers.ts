/**
 * Seed des offres d'emploi Axion-IA (point 7).
 *
 * Lit :
 *  - careers_seed_input.json  (43 postes retenus + mapping villes/workMode/salaire)
 *  - careers-gen/<slug>.json  (contenu rédigé par les agents IA : titleFr, summaryFr,
 *    bodyFrHtml, metaTitle, metaDescription)
 *
 * Upsert idempotent par slug → relançable sans créer de doublons.
 * EN = FR (site FR-only). Salaire affiché si fourchette (directive UE 2023/970).
 * Postes itinérants → jobLocations = 41 villes (JobPosting multi-location, anti-doorway).
 *
 * 🔴 CE SCRIPT ÉCRASE LE TEXTE PUBLIÉ. Relevé du 2026-09-02 : sur 55 offres en
 * ligne, 20 portaient des corrections faites en console que le dépôt n'a jamais
 * reçues (titres raccourcis, accents rétablis, corps retouchés). Une passe
 * complète les aurait toutes effacées, sans un mot. Pour une offre PUBLIÉE, la
 * console est la source de vérité ; ce script sert à créer et à pousser des lots
 * précis — d'où le périmètre désormais obligatoire.
 *
 * Lancement :
 *   pnpm tsx scripts/seed-careers-offers.ts --only=slug-a,slug-b   (recommandé)
 *   pnpm tsx scripts/seed-careers-offers.ts --all                  (écrase les 45)
 *   ... --republish   → rafraîchit aussi publishedAt (date vue par Google for Jobs)
 *
 * `--republish` est un geste HUMAIN : à n'utiliser que sur des offres réellement
 * ouvertes et relues, jamais pour simuler de la fraîcheur (règles Google for Jobs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../prisma/generated/client";
import { normalizeApplicantCountries } from "../src/lib/careers/format";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INPUT = path.join(ROOT, "careers_seed_input.json");
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
  /** Pays d'où l'on accepte les candidatures (ISO2). Absent = France seule. */
  applicantCountries?: string[];
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

/** Troncature défensive aux limites des colonnes (un agent peut dépasser un peu). */
const cut = (s: string, n: number): string =>
  s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";

/** Périmètre d'écriture : `--only=a,b` ou `--all`. Rien = on refuse d'écrire. */
function parseScope(argv: string[]): { slugs: Set<string> | null; republish: boolean } {
  const only = argv.find((a) => a.startsWith("--only="));
  const republish = argv.includes("--republish");
  if (only) {
    const slugs = new Set(
      only
        .slice("--only=".length)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    );
    if (slugs.size === 0) throw new Error("--only= est vide.");
    return { slugs, republish };
  }
  if (argv.includes("--all")) return { slugs: null, republish };
  throw new Error(
    "Périmètre manquant. Ce script écrase le texte publié : 20 des 55 offres en " +
      "ligne portent des corrections console absentes du dépôt (relevé 2026-09-02).\n" +
      "  --only=slug-a,slug-b   n'écrit que ces offres (recommandé)\n" +
      "  --all                  écrit les 45 et écrase les corrections console\n" +
      "  --republish            rafraîchit en plus publishedAt (geste humain)",
  );
}

async function main() {
  const { slugs: scope, republish } = parseScope(process.argv.slice(2));
  const input = JSON.parse(fs.readFileSync(INPUT, "utf8")) as {
    postes: Poste[];
    cities: Array<{ city: string; region: string }>;
  };
  // 40 villes pour les postes itinérants : les 40 hubs (Grenoble — siège — inclus).
  const ALL_CITIES = [...input.cities];

  let created = 0;
  let updated = 0;
  const missing: string[] = [];

  let skipped = 0;
  for (const p of input.postes) {
    if (scope && !scope.has(p.slug)) {
      skipped++;
      continue;
    }
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
      // Sans ça, un re-seed écraserait le ciblage international saisi en console.
      applicantCountries: normalizeApplicantCountries(p.applicantCountries),
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

    const existing = await prisma.jobOffer.findUnique({
      where: { slug: p.slug },
      select: { id: true },
    });
    await prisma.jobOffer.upsert({
      where: { slug: p.slug },
      // En update, on ne réécrase pas publishedAt s'il existe déjà.
      create: data,
      update: republish ? data : (({ publishedAt: _publishedAt, ...rest }) => rest)(data),
    });
    if (existing) updated++;
    else created++;
    console.log(`  ✓ ${p.slug}${jobLocations ? " (41 villes)" : ""}`);
  }

  console.log(
    `\n=== SEED TERMINÉ : ${created} créées, ${updated} mises à jour${republish ? " (publishedAt rafraîchi)" : ""}${
      skipped ? `, ${skipped} hors périmètre` : ""
    }${missing.length ? `, ${missing.length} manquantes : ${missing.join(", ")}` : ""} ===`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ ERREUR SEED:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
