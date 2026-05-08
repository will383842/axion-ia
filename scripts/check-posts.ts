// Validation qualité content factory blog (Sprint 14.10, 2026-05-08).
//
// Vérifications anti-doorway HCU 2024 + format I/O outil de génération :
//   - slug unique
//   - body ≥ word count minimum (article 600, guide 2000)
//   - directAnswer 40-80 mots si présent
//   - faq ≥ 4 si tier-1
//   - relatedCities slugs valides (vérif contre VILLES)
//   - category dans les 8 valeurs autorisées
//   - sectors / companySizes / serviceTypes dans valeurs autorisées
//   - qualityScore 0-100
//   - mots bannis (anti-siren géré ailleurs, ici on flag les spammy)
//
// Usage : `pnpm posts:check`. Exit code 1 si défaut bloquant détecté.

import {
  BLOG_POSTS,
  resolveTier,
  type BlogSector,
  type BlogCompanySize,
  type BlogServiceType,
} from "../src/content/blog";
import { VILLES } from "../src/content/villes";
import { REGIONS } from "../src/content/regions";

const ALLOWED_CATEGORIES = new Set([
  "Audit IA",
  "Interventions",
  "Implémentation",
  "Cas d'usage",
  "Méthodologie",
  "Stratégie",
  "Outils",
  "Tendances",
]);

const ALLOWED_SECTORS: ReadonlyArray<BlogSector> = [
  "industrie",
  "comptabilite",
  "juridique",
  "banque-finance",
  "conseil",
  "sante",
  "retail",
  "ecommerce",
  "logistique",
  "agro-alimentaire",
  "tech",
  "saas",
  "tourisme",
  "education",
  "immobilier",
  "autre",
];
// Classification INSEE officielle (4 tailles) — cf. src/content/blog/types.ts.
const ALLOWED_SIZES: ReadonlyArray<BlogCompanySize> = ["tpe", "pme", "eti", "grande-entreprise"];
const ALLOWED_SERVICES: ReadonlyArray<BlogServiceType> = [
  "audit",
  "interventions",
  "implementation",
];

const SPAMMY_WORDS = ["unique", "le meilleur", "révolutionnaire", "incroyable", "magique"];
const BANNED_WORDS = ["siren", "siret", "rcs"]; // doublon avec anti-siren mais on confirme

const VILLE_SLUGS = new Set(VILLES.map((v) => v.slug));
const REGION_SLUGS = new Set(REGIONS.map((r) => r.slug));

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface Issue {
  slug: string;
  level: "error" | "warning";
  message: string;
}

const issues: Issue[] = [];

// 1. Slug unicité
const slugCounts = new Map<string, number>();
for (const p of BLOG_POSTS) slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1);
for (const [slug, count] of slugCounts) {
  if (count > 1)
    issues.push({ slug, level: "error", message: `Slug dupliqué (${count}× occurrences)` });
}

// 2-N. Vérifications par article
for (const post of BLOG_POSTS) {
  const wordCountFr = countWords(post.fr.body);
  const wordCountEn = countWords(post.en.body);
  const tier = resolveTier(post);

  // Catégorie autorisée
  if (!ALLOWED_CATEGORIES.has(post.category)) {
    issues.push({
      slug: post.slug,
      level: "error",
      message: `category "${post.category}" non autorisée (8 valeurs autorisées : ${[...ALLOWED_CATEGORIES].join(" / ")})`,
    });
  }

  // Sectors valides
  for (const s of post.sectors ?? []) {
    if (!ALLOWED_SECTORS.includes(s)) {
      issues.push({ slug: post.slug, level: "error", message: `sector "${s}" non autorisé` });
    }
  }

  // Sizes valides
  for (const s of post.companySizes ?? []) {
    if (!ALLOWED_SIZES.includes(s)) {
      issues.push({ slug: post.slug, level: "error", message: `companySize "${s}" non autorisé` });
    }
  }

  // Services valides
  for (const s of post.serviceTypes ?? []) {
    if (!ALLOWED_SERVICES.includes(s)) {
      issues.push({ slug: post.slug, level: "error", message: `serviceType "${s}" non autorisé` });
    }
  }

  // RelatedCities valides
  for (const c of post.relatedCities ?? []) {
    if (!VILLE_SLUGS.has(c)) {
      issues.push({
        slug: post.slug,
        level: "error",
        message: `relatedCity "${c}" inexistante (vérif contre ${VILLE_SLUGS.size} villes)`,
      });
    }
  }

  // RelatedRegions valides
  for (const r of post.relatedRegions ?? []) {
    if (!REGION_SLUGS.has(r)) {
      issues.push({ slug: post.slug, level: "error", message: `relatedRegion "${r}" inexistante` });
    }
  }

  // Word count minimum (anti-doorway HCU 2024)
  const minWords = post.format === "guide" ? 2000 : 600;
  if (wordCountFr < minWords && tier === "tier-1-indexable") {
    issues.push({
      slug: post.slug,
      level: "error",
      message: `body FR ${wordCountFr} mots < ${minWords} requis pour tier-1 (format ${post.format})`,
    });
  }
  if (wordCountEn < minWords && tier === "tier-1-indexable") {
    issues.push({
      slug: post.slug,
      level: "warning",
      message: `body EN ${wordCountEn} mots < ${minWords} (tier-1 mais EN sous le minimum)`,
    });
  }

  // DirectAnswer 40-80 mots si tier-1
  if (post.fr.directAnswer) {
    const daWords = countWords(post.fr.directAnswer);
    if (daWords < 40 || daWords > 80) {
      issues.push({
        slug: post.slug,
        level: "warning",
        message: `directAnswer FR ${daWords} mots (recommandé 40-80 pour AEO Perplexity/Claude.ai)`,
      });
    }
  } else if (tier === "tier-1-indexable") {
    issues.push({
      slug: post.slug,
      level: "warning",
      message: `directAnswer FR absent — recommandé pour tier-1 (signal AEO)`,
    });
  }

  // FAQ minimum si tier-1
  const faqCount = post.fr.faq?.length ?? 0;
  if (tier === "tier-1-indexable" && faqCount < 4 && post.format !== "veille") {
    issues.push({
      slug: post.slug,
      level: "warning",
      message: `faq ${faqCount} items < 4 recommandés pour tier-1 (FAQPage Speakable JSON-LD)`,
    });
  }

  // QualityScore validité
  if (post.qualityScore !== undefined && (post.qualityScore < 0 || post.qualityScore > 100)) {
    issues.push({
      slug: post.slug,
      level: "error",
      message: `qualityScore ${post.qualityScore} hors plage 0-100`,
    });
  }

  // Mots bannis (siren, siret, rcs — déjà géré par anti-siren mais double-check)
  const lowerBody = `${post.fr.body} ${post.fr.title} ${post.fr.excerpt}`.toLowerCase();
  for (const banned of BANNED_WORDS) {
    if (lowerBody.includes(banned)) {
      issues.push({ slug: post.slug, level: "error", message: `mot banni détecté : "${banned}"` });
    }
  }

  // Mots spammy (warning seulement)
  for (const spammy of SPAMMY_WORDS) {
    if (lowerBody.includes(spammy)) {
      issues.push({
        slug: post.slug,
        level: "warning",
        message: `mot spammy détecté : "${spammy}" (à éviter)`,
      });
    }
  }

  // Au moins 1 dimension taxonomie remplie pour tier-1
  if (tier === "tier-1-indexable") {
    const hasTaxonomy =
      (post.sectors?.length ?? 0) > 0 ||
      (post.companySizes?.length ?? 0) > 0 ||
      (post.serviceTypes?.length ?? 0) > 0;
    if (!hasTaxonomy) {
      issues.push({
        slug: post.slug,
        level: "warning",
        message: `tier-1 mais aucune dimension taxonomie (sectors / companySizes / serviceTypes) — risque sous-classification`,
      });
    }
  }

  // ReadingTime format
  if (!/^\d+\s*(min|min\.?|minutes?)$/i.test(post.readingTime)) {
    issues.push({
      slug: post.slug,
      level: "warning",
      message: `readingTime "${post.readingTime}" — format attendu "X min"`,
    });
  }
}

// === Output ===

const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");

console.warn(`[posts:check] ${BLOG_POSTS.length} articles vérifiés`);
console.warn(`[posts:check] ${errors.length} erreurs · ${warnings.length} warnings`);
console.warn("");

const tierCounts = {
  "tier-1-indexable": 0,
  "tier-2-noindex-follow": 0,
  "tier-3-noindex-nofollow": 0,
};
for (const p of BLOG_POSTS) tierCounts[resolveTier(p)]++;
console.warn(`[posts:check] répartition tiers :`);
console.warn(
  `  tier-1 (indexable)        : ${tierCounts["tier-1-indexable"].toString().padStart(5)} (${((tierCounts["tier-1-indexable"] / BLOG_POSTS.length) * 100).toFixed(0)}%)`,
);
console.warn(
  `  tier-2 (noindex follow)   : ${tierCounts["tier-2-noindex-follow"].toString().padStart(5)} (${((tierCounts["tier-2-noindex-follow"] / BLOG_POSTS.length) * 100).toFixed(0)}%)`,
);
console.warn(
  `  tier-3 (noindex nofollow) : ${tierCounts["tier-3-noindex-nofollow"].toString().padStart(5)} (${((tierCounts["tier-3-noindex-nofollow"] / BLOG_POSTS.length) * 100).toFixed(0)}%)`,
);
console.warn("");

if (errors.length > 0) {
  console.error("[posts:check] ERREURS :");
  for (const e of errors) console.error(`  ✗ ${e.slug} : ${e.message}`);
}
if (warnings.length > 0) {
  console.warn("[posts:check] WARNINGS :");
  for (const w of warnings) console.warn(`  ⚠ ${w.slug} : ${w.message}`);
}
if (errors.length === 0 && warnings.length === 0) {
  console.warn("[posts:check] ✓ all clear");
}

process.exit(errors.length > 0 ? 1 : 0);
