/**
 * Seeder image bank — 72 ImageAssets + translations FR
 * Usage (depuis /app dans le container) :
 *   npx tsx prisma/seeds/image-bank/seed-images.ts
 * Idempotent (upsert par slug).
 */
import { PrismaClient } from "../../generated/client";

const prisma = new PrismaClient();

type ImageType =
  | "banniere"
  | "carre"
  | "affiche"
  | "infographie"
  | "editorial"
  | "photo"
  | "dataviz"
  | "logo";

const DIMENSIONS: Record<
  ImageType,
  { width: number; height: number; orientation: string; aspectRatio: string }
> = {
  banniere: { width: 1920, height: 1080, orientation: "landscape", aspectRatio: "16:9" },
  carre: { width: 1200, height: 1200, orientation: "square", aspectRatio: "1:1" },
  affiche: { width: 1080, height: 1920, orientation: "portrait", aspectRatio: "9:16" },
  infographie: { width: 1200, height: 1600, orientation: "portrait", aspectRatio: "3:4" },
  editorial: { width: 1200, height: 800, orientation: "landscape", aspectRatio: "3:2" },
  photo: { width: 1920, height: 1080, orientation: "landscape", aspectRatio: "16:9" },
  dataviz: { width: 1200, height: 900, orientation: "landscape", aspectRatio: "4:3" },
  logo: { width: 500, height: 200, orientation: "landscape", aspectRatio: "5:2" },
};

function detectType(slug: string): ImageType {
  if (slug.endsWith("-banniere") || slug.includes("-banniere-")) return "banniere";
  if (slug.endsWith("-carre") || slug.includes("-carre-")) return "carre";
  if (slug.endsWith("-affiche") || slug.includes("-affiche-")) return "affiche";
  if (slug.endsWith("-infographie")) return "infographie";
  if (slug.endsWith("-editorial")) return "editorial";
  if (slug.endsWith("-dataviz")) return "dataviz";
  if (slug.includes("-logo-") || slug.includes("-icone-")) return "logo";
  if (slug.endsWith("-photo-carre")) return "carre";
  if (slug.endsWith("-photo-banniere") || slug.includes("-photo")) return "photo";
  return "banniere";
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/^axion-ia-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bIa\b/g, "IA")
    .replace(/\bTpe\b/g, "TPE")
    .replace(/\bPme\b/g, "PME")
    .replace(/\bEti\b/g, "ETI")
    .replace(/\bRoi\b/g, "ROI")
    .replace(/\bKpi\b/g, "KPI");
}

const MODULE_LABELS: Record<string, string> = {
  audit: "Audit IA",
  interventions: "Formation IA",
  implementations: "Automatisation IA",
  "un-a-un": "Accompagnement 1-to-1",
  graphique: "Graphique / Dataviz",
  logo: "Logo Axion-IA",
  proposition: "Proposition de valeur",
  ville: "Présence locale",
};

interface ImageEntry {
  slug: string;
  module: string;
  subModule?: string;
  targetCity?: string;
  geoPosition?: string;
  geoPlacename?: string;
  isAiGenerated?: boolean;
  sourceType?: string;
  keywordsPrimary?: string;
  targetFormat?: string;
}

const IMAGE_ENTRIES: ImageEntry[] = [
  // ── AUDIT (17) ────────────────────────────────────────────────────────────
  {
    slug: "axion-ia-audit-ia-entreprise-prete-intelligence-artificielle-banniere",
    module: "audit",
    keywordsPrimary: "audit IA entreprise",
  },
  {
    slug: "axion-ia-audit-ia-avantage-competitif-decisions-resultats-banniere",
    module: "audit",
    keywordsPrimary: "audit IA avantage compétitif",
  },
  {
    slug: "axion-ia-audit-ia-transformer-defis-opportunites-leviers-valeur-banniere",
    module: "audit",
    keywordsPrimary: "audit IA transformation",
  },
  {
    slug: "axion-ia-publicite-outdoor-ia-rapporte-concretement-productivite-affiche",
    module: "audit",
    targetFormat: "affiche",
    keywordsPrimary: "publicité outdoor IA productivité",
  },
  {
    slug: "axion-ia-audit-ia-levier-croissance-mesurable-cartographie-roi-banniere",
    module: "audit",
    keywordsPrimary: "audit IA ROI croissance",
  },
  {
    slug: "axion-ia-audit-ia-solutions-artisans-commercants-tpe-pme-eti-banniere",
    module: "audit",
    keywordsPrimary: "audit IA TPE PME ETI",
  },
  {
    slug: "axion-ia-audit-processus-automatiser-temps-couts-productivite-infographie",
    module: "audit",
    keywordsPrimary: "audit processus automatisation",
  },
  {
    slug: "axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-affiche",
    module: "audit",
    targetFormat: "affiche",
    keywordsPrimary: "audit IA gagner temps coûts",
  },
  {
    slug: "axion-ia-audit-ia-methode-5-etapes-analyse-roi-recommandations-infographie",
    module: "audit",
    keywordsPrimary: "méthode audit IA 5 étapes",
  },
  {
    slug: "axion-ia-citation-avenir-prepare-aujourd-hui-comprendre-agir-editorial",
    module: "audit",
    keywordsPrimary: "citation IA avenir préparation",
  },
  {
    slug: "axion-ia-citation-clarte-serenite-resultats-toujours-editorial",
    module: "audit",
    keywordsPrimary: "citation IA clarté sérénité",
  },
  {
    slug: "axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-carre",
    module: "audit",
    keywordsPrimary: "audit IA rentable ROI garanti",
  },
  {
    slug: "axion-ia-audit-ia-vous-gagnez-temps-argent-zero-perte-100-gain-carre",
    module: "audit",
    keywordsPrimary: "audit IA gain temps argent",
  },
  {
    slug: "axion-ia-audit-ia-plus-valeur-moins-perte-performances-decuplees-carre",
    module: "audit",
    keywordsPrimary: "audit IA valeur performance",
  },
  {
    slug: "axion-ia-audit-ia-chaos-ordre-performance-gain-temps-couts-carre",
    module: "audit",
    keywordsPrimary: "audit IA chaos ordre performance",
  },
  {
    slug: "axion-ia-audit-ia-une-journee-mois-gagnes-switch-on-carre",
    module: "audit",
    keywordsPrimary: "audit IA une journée mois gagné",
  },
  {
    slug: "axion-ia-audit-ia-votre-avance-concurrents-benchmark-carre",
    module: "audit",
    keywordsPrimary: "audit IA avance concurrents benchmark",
  },
  // ── FORMATION (15) ────────────────────────────────────────────────────────
  {
    slug: "axion-ia-formation-ia-1-jour-sur-mesure-generique-reserver-carre",
    module: "interventions",
    keywordsPrimary: "formation IA 1 jour sur mesure",
  },
  {
    slug: "axion-ia-intervention-ia-rapide-resultats-concrets-entreprise-carre",
    module: "interventions",
    keywordsPrimary: "intervention IA résultats concrets",
  },
  {
    slug: "axion-ia-formation-ia-comprendre-creer-transformer-humaine-augmentee-banniere",
    module: "interventions",
    keywordsPrimary: "formation IA comprendre créer transformer",
  },
  {
    slug: "axion-ia-intervention-ia-france-toutes-regions-photo-banniere",
    module: "interventions",
    keywordsPrimary: "intervention IA France toutes régions",
  },
  {
    slug: "axion-ia-formation-acculturation-ia-tpe-pme-eti-2026-photo-banniere",
    module: "interventions",
    keywordsPrimary: "formation acculturation IA TPE PME ETI 2026",
  },
  {
    slug: "axion-ia-citation-intelligence-artificielle-valeur-impact-editorial",
    module: "interventions",
    keywordsPrimary: "citation IA valeur impact",
  },
  {
    slug: "axion-ia-citation-ia-ne-remplace-pas-humain-revele-potentiel-editorial",
    module: "interventions",
    keywordsPrimary: "citation IA humain potentiel",
  },
  {
    slug: "axion-ia-formation-ia-vous-gagnez-concretement-5-benefices-banniere",
    module: "interventions",
    keywordsPrimary: "formation IA 5 bénéfices concrets",
  },
  {
    slug: "axion-ia-citation-investir-connaissance-liberte-demain-editorial",
    module: "interventions",
    keywordsPrimary: "citation investir connaissance liberté",
  },
  {
    slug: "axion-ia-formation-ia-benefices-premier-jour-formateur-photo-carre",
    module: "interventions",
    keywordsPrimary: "formation IA bénéfices premier jour",
  },
  {
    slug: "axion-ia-formation-ia-avant-apres-une-journee-resultats-photo-carre",
    module: "interventions",
    keywordsPrimary: "formation IA avant après résultats",
  },
  {
    slug: "axion-ia-formation-ia-moins-stress-clarte-une-journee-photo-banniere",
    module: "interventions",
    keywordsPrimary: "formation IA stress clarté",
  },
  {
    slug: "axion-ia-formation-equipe-ia-40-pourcent-productivite-100-mesure-carre",
    module: "interventions",
    keywordsPrimary: "formation équipe IA productivité 40%",
  },
  {
    slug: "axion-ia-formation-1-jour-progresser-sur-mesure-generique-carre",
    module: "interventions",
    keywordsPrimary: "formation IA 1 jour progresser",
  },
  {
    slug: "axion-ia-formation-ia-1-jour-reserver-session-carre",
    module: "interventions",
    keywordsPrimary: "formation IA 1 jour réserver",
  },
  // ── AUTOMATISATION (4) ────────────────────────────────────────────────────
  {
    slug: "axion-ia-automatisation-ia-benefices-concrets-mesurables-durables-banniere",
    module: "implementations",
    keywordsPrimary: "automatisation IA bénéfices mesurables",
  },
  {
    slug: "axion-ia-automatisation-ia-avant-apres-tableau-bord-45-pourcent-photo-carre",
    module: "implementations",
    keywordsPrimary: "automatisation IA avant après tableau de bord",
  },
  {
    slug: "axion-ia-automatisation-ia-performance-86-pourcent-gain-temps-couts-carre",
    module: "implementations",
    keywordsPrimary: "automatisation IA performance gain temps coûts",
  },
  {
    slug: "axion-ia-automatisation-ia-triangle-temps-couts-resultats-100-gagnant-carre",
    module: "implementations",
    keywordsPrimary: "automatisation IA triangle performance",
  },
  // ── DIRIGEANT (6) ─────────────────────────────────────────────────────────
  {
    slug: "axion-ia-dirigeant-1to1-ouvrir-ralentit-entreprise-12h-semaine-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "accompagnement dirigeant 1to1 IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-reprendre-controle-journee-avant-apres-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant reprendre contrôle IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-temps-plus-grand-atout-liberer-sablier-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant temps atout libérer IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-moins-stress-clarte-performance-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant stress clarté performance IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-moins-subir-plus-piloter-impact-durable-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant piloter impact durable IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-15h-liberees-35-efficacite-25-productivite-infographie",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant 15h libérées efficacité productivité",
  },
  // ── ÉQUIPE (2) ────────────────────────────────────────────────────────────
  {
    slug: "axion-ia-equipe-1to1-tous-profils-manager-rh-marketing-ops-photo-banniere",
    module: "un-a-un",
    subModule: "equipe",
    keywordsPrimary: "accompagnement équipe 1to1 IA",
  },
  {
    slug: "axion-ia-equipe-1to1-une-personne-grandir-competence-performance-photo-carre",
    module: "un-a-un",
    subModule: "equipe",
    keywordsPrimary: "équipe 1to1 compétence performance IA",
  },
  // ── GRAPHIQUES (5) ────────────────────────────────────────────────────────
  {
    slug: "axion-ia-graphique-processus-5-etapes-timeline-infographie",
    module: "graphique",
    keywordsPrimary: "processus IA 5 étapes timeline",
  },
  {
    slug: "axion-ia-graphique-performance-ia-kpi-20-60-pourcent-dataviz",
    module: "graphique",
    keywordsPrimary: "performance IA KPI 20-60%",
  },
  {
    slug: "axion-ia-graphique-adoption-ia-72-pourcent-2024-mckinsey-dataviz",
    module: "graphique",
    keywordsPrimary: "adoption IA 72% McKinsey 2024",
  },
  {
    slug: "axion-ia-graphique-ia-imperatif-performance-fosse-concurrentiel-dataviz",
    module: "graphique",
    keywordsPrimary: "IA impératif fossé concurrentiel",
  },
  {
    slug: "axion-ia-graphique-ia-maintenant-attendre-explorer-integrer-dominer-infographie",
    module: "graphique",
    keywordsPrimary: "IA maintenant explorer intégrer dominer",
  },
  // ── LOGOS (7) ─────────────────────────────────────────────────────────────
  {
    slug: "axion-ia-logo-horizontal-fond-blanc-bordure-orange",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "logo Axion-IA horizontal fond blanc",
  },
  {
    slug: "axion-ia-logo-horizontal-transparent",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "logo Axion-IA horizontal transparent",
  },
  {
    slug: "axion-ia-logo-horizontal-fond-blanc",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "logo Axion-IA horizontal",
  },
  {
    slug: "axion-ia-logo-horizontal-fond-blanc-500px",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "logo Axion-IA 500px",
  },
  {
    slug: "axion-ia-icone-app-fond-creme",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "icône application Axion-IA fond crème",
  },
  {
    slug: "axion-ia-icone-app-fond-creme-500px",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "icône application Axion-IA 500px",
  },
  {
    slug: "axion-ia-icone-app-transparent",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "icône application Axion-IA transparent",
  },
  // ── PROPOSITIONS (11) ─────────────────────────────────────────────────────
  {
    slug: "axion-ia-proposition-outdoor-formations-audit-implementations-affiche",
    module: "proposition",
    targetFormat: "affiche",
    keywordsPrimary: "Axion-IA services formations audit implémentations",
  },
  {
    slug: "axion-ia-proposition-showroom-mur-services-formations-audit-photo",
    module: "proposition",
    keywordsPrimary: "Axion-IA showroom services",
  },
  {
    slug: "axion-ia-proposition-ia-pour-tous-artisans-tpe-pme-banniere",
    module: "proposition",
    keywordsPrimary: "IA pour tous artisans TPE PME",
  },
  {
    slug: "axion-ia-proposition-globe-4-services-formations-audit-implementations-carre",
    module: "proposition",
    keywordsPrimary: "Axion-IA 4 services globe",
  },
  {
    slug: "axion-ia-proposition-booster-productivite-equipes-automatiser-affiche",
    module: "proposition",
    targetFormat: "affiche",
    keywordsPrimary: "booster productivité équipes automatiser IA",
  },
  {
    slug: "axion-ia-proposition-solutions-ia-chaque-realite-5-secteurs-banniere",
    module: "proposition",
    keywordsPrimary: "solutions IA 5 secteurs",
  },
  {
    slug: "axion-ia-proposition-temps-precieux-taches-processus-intelligents-carre",
    module: "proposition",
    keywordsPrimary: "temps précieux processus intelligents IA",
  },
  {
    slug: "axion-ia-proposition-moins-taches-plus-valeur-carre",
    module: "proposition",
    keywordsPrimary: "moins tâches plus valeur IA",
  },
  {
    slug: "axion-ia-proposition-ia-simplifie-interventions-photo-banniere",
    module: "proposition",
    keywordsPrimary: "IA simplifie interventions",
  },
  {
    slug: "axion-ia-proposition-temps-vers-argent-croissance-photo-banniere",
    module: "proposition",
    keywordsPrimary: "temps vers argent croissance IA",
  },
  {
    slug: "axion-ia-equipe-ia-service-humain-12-personnes-photo-groupe",
    module: "proposition",
    keywordsPrimary: "équipe Axion-IA 12 personnes service humain",
  },
  // ── VILLES (5) ────────────────────────────────────────────────────────────
  {
    slug: "axion-ia-paris-consultante-tour-eiffel-performance-28-pourcent-banniere",
    module: "ville",
    targetCity: "Paris",
    geoPosition: "48.8566;2.3522",
    geoPlacename: "Paris, Île-de-France, France",
    keywordsPrimary: "consultant IA Paris Tour Eiffel",
  },
  {
    slug: "axion-ia-paris-ia-reussite-entreprise-sacre-coeur-banniere",
    module: "ville",
    targetCity: "Paris",
    geoPosition: "48.8566;2.3522",
    geoPlacename: "Paris, Île-de-France, France",
    keywordsPrimary: "IA réussite entreprise Paris Sacré-Cœur",
  },
  {
    slug: "axion-ia-paris-tour-eiffel-services-ia-carte-france-carre",
    module: "ville",
    targetCity: "Paris",
    geoPosition: "48.8566;2.3522",
    geoPlacename: "Paris, Île-de-France, France",
    keywordsPrimary: "services IA Paris Tour Eiffel France",
  },
  {
    slug: "axion-ia-paris-formation-ia-haussmann-se-former-comprendre-agir-banniere",
    module: "ville",
    targetCity: "Paris",
    geoPosition: "48.8566;2.3522",
    geoPlacename: "Paris, Île-de-France, France",
    keywordsPrimary: "formation IA Paris Haussmann",
  },
  {
    slug: "axion-ia-lyon-formation-ia-presquile-fourviere-se-former-banniere",
    module: "ville",
    targetCity: "Lyon",
    geoPosition: "45.764;4.8357",
    geoPlacename: "Lyon, Auvergne-Rhône-Alpes, France",
    keywordsPrimary: "formation IA Lyon Presqu'île Fourvière",
  },
];

async function main() {
  console.log("🌱 Axion-IA Image Bank — Seeder 72 images\n");
  let upserted = 0;
  let errors = 0;

  for (const entry of IMAGE_ENTRIES) {
    const imageType = detectType(entry.slug);
    const dims = DIMENSIONS[imageType];
    const isLogo = entry.module === "logo";
    const isAiGenerated = entry.isAiGenerated !== undefined ? entry.isAiGenerated : !isLogo;
    const sourceType = entry.sourceType ?? (isLogo ? "original" : "imported");

    const assetData = {
      filePath: `images/${entry.slug}.webp`,
      thumbnailPath: `images/${entry.slug}-thumb.webp`,
      avifPath: `images/${entry.slug}.avif`,
      fileFormat: "webp",
      fileSize: 0,
      width: dims.width,
      height: dims.height,
      orientation: dims.orientation,
      aspectRatio: dims.aspectRatio,
      keywordsPrimary: entry.keywordsPrimary ?? null,
      licenseType: "cc-by-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      copyrightHolder: "Axion-IA OÜ",
      sourceType,
      aiModel: null,
      isAiGenerated,
      isActive: true,
      publishedAt: new Date(),
      isFeatured: false,
      module: entry.module,
      subModule: entry.subModule ?? null,
      targetCity: entry.targetCity ?? null,
      geoPosition: entry.geoPosition ?? null,
      geoPlacename: entry.geoPlacename ?? null,
      targetFormat: entry.targetFormat ?? null,
      requiresHumanReview: false,
      watermarkEnabled: false,
      seoScore: 0,
      targetCountries: ["FR", "BE", "CH", "LU"],
      targetLanguages: ["fr"],
    } as const;

    try {
      const asset = await prisma.imageAsset.upsert({
        where: { slug: entry.slug },
        create: { slug: entry.slug, ...assetData },
        update: assetData,
      });

      const titleFr = `Axion-IA — ${slugToTitle(entry.slug)}`;
      const labelFr = MODULE_LABELS[entry.module] ?? "Axion-IA";
      await prisma.imageAssetTranslation.upsert({
        where: { imageId_languageCode: { imageId: asset.id, languageCode: "fr" } },
        create: {
          imageId: asset.id,
          languageCode: "fr",
          slug: entry.slug,
          title: titleFr,
          alt: `${titleFr}`,
          caption: `${labelFr} — ${slugToTitle(entry.slug)}`,
          isPublished: true,
          publishedAt: new Date(),
        },
        update: {
          slug: entry.slug,
          title: titleFr,
          alt: `${titleFr}`,
          caption: `${labelFr} — ${slugToTitle(entry.slug)}`,
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      console.log(`  ✓ [${entry.module}] ${entry.slug}`);
      upserted++;
    } catch (err) {
      console.error(`  ✗ [${entry.module}] ${entry.slug}`, err);
      errors++;
    }
  }

  console.log(`\n── Récap : ${upserted} upserted, ${errors} erreurs ──`);
  if (errors > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("Erreur fatale :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
