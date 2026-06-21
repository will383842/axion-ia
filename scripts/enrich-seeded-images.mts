/**
 * Enrichissement SEO/AEO/GEO (FR) — batch pour toutes les images sans metaTitle.
 *
 * Usage (dans le terminal Coolify de l'app, après le seed) :
 *   npx tsx scripts/enrich-seeded-images.mts
 *
 * Options :
 *   --force        Re-enrichit même les images déjà enrichies
 *   --slug <slug>  Traite uniquement ce slug
 *   --limit <n>    Limite à n images (pratique pour tester)
 *
 * Env requis : DATABASE_URL, ANTHROPIC_API_KEY, NEXT_PUBLIC_SITE_URL
 * Env optionnel : ENRICH_DELAY_MS (défaut 2500ms entre chaque appel Anthropic)
 */
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "../prisma/generated/client";

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const SLUG_FILTER = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;
const LIMIT = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1] ?? "999", 10) : 999;
const DELAY_MS = parseInt(process.env.ENRICH_DELAY_MS ?? "2500", 10);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com").replace(/\/$/, "");

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Prompt système ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert SEO/AEO/GEO 2026 pour la banque d'images d'Axion-IA (cabinet IA opérationnel B2B, France).

Axion-IA propose : Interventions & Formations IA · Audits IA (490 € PME) · Implémentations/Automatisations · Accompagnement 1-to-1.
Audience cible : dirigeants PME/ETI, responsables RH, DAF, Ops, commerciaux en France.
Ton éditorial : professionnel, concret, sobre, orienté ROI. Jamais de superlatifs (incroyable, révolutionnaire, génial). Pas de marketing creux.
Naming : toujours "Axion-IA" (avec tiret). Entité juridique : "Axion-IA SAS".

Objectifs des métadonnées :
1. Google Images — alt factuellement descriptif, embedded_text_caption exhaustif.
2. AEO (Answer Engine Optimization) — ai_summary est une phrase citable par Perplexity, ChatGPT, Claude.
3. GEO (Generative Engine Optimization) — description riche pour que les LLM sourcent l'image.
4. Open Graph / social — og_title + og_description accrocheurs mais sobres.
5. SEO on-page — meta_title + meta_description avec intent keyword + CTA.

Contraintes strictes :
- alt         : 30-125 char, décrit FACTUELLEMENT ce qui est VISIBLE (humains, objets, textes, diagrammes). Jamais commercial. Pas de "Image de" ni "Photo de" en début.
- caption     : 80-200 char, contexte éditorial bref.
- description : 150-500 char, richement informative (bénéfice métier + contexte + cas d'usage).
- meta_title  : ≤ 60 char, keyword principal, suffixe " | Axion-IA".
- meta_description : 140-160 char, bénéfice mesurable + verbe d'action (Découvrez, Téléchargez, Consultez).
- og_title    : ≤ 90 char, percutant pour partage LinkedIn/Twitter.
- og_description : ≤ 200 char.
- ai_summary  : 1 phrase complète, citable par un LLM comme source. Commence par "Axion-IA".
- embed_title : ≤ 60 char (Pinterest, widget, embed).
- keywords_primary   : 1-4 mots séparés par virgule.
- keywords_secondary : tableau JSON de 5-10 mots ou expressions courtes.
Retourne UNIQUEMENT un objet JSON valide, sans backticks, sans commentaire :
{
  "alt": "...",
  "caption": "...",
  "description": "...",
  "meta_title": "...",
  "meta_description": "...",
  "og_title": "...",
  "og_description": "...",
  "ai_summary": "...",
  "embed_title": "...",
  "keywords_primary": "...",
  "keywords_secondary": ["...", "..."]
}`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawClaude {
  alt?: unknown;
  caption?: unknown;
  description?: unknown;
  meta_title?: unknown;
  meta_description?: unknown;
  og_title?: unknown;
  og_description?: unknown;
  ai_summary?: unknown;
  embed_title?: unknown;
  keywords_primary?: unknown;
  keywords_secondary?: unknown;
}

interface EnrichResult {
  alt: string;
  caption: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  aiSummary: string;
  embedTitle: string;
  keywordsPrimary: string;
  keywordsSecondary: string[];
}

// ─── Core enrichment ──────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  audit: "Audit IA",
  interventions: "Formation IA",
  implementations: "Automatisation / Implémentation IA",
  "un-a-un": "Accompagnement 1-to-1",
  graphique: "Graphique / Dataviz",
  logo: "Logo Axion-IA",
  proposition: "Proposition de valeur",
  ville: "Présence locale",
};

async function enrichOne(asset: {
  id: string;
  slug: string;
  filePath: string;
  module: string | null;
  subModule: string | null;
  keywordsPrimary: string | null;
}): Promise<EnrichResult> {
  const imageUrl = asset.filePath.startsWith("http")
    ? asset.filePath
    : `${SITE_URL}/${asset.filePath.replace(/^\/+/, "")}`;

  const moduleLabel = MODULE_LABELS[asset.module ?? ""] ?? asset.module ?? "Axion-IA";

  const userPrompt = [
    `Analyse cette image Axion-IA et génère ses métadonnées SEO/AEO/GEO optimisées en FRANÇAIS.`,
    ``,
    `Contexte :`,
    `- Slug technique : ${asset.slug}`,
    `- Module métier  : ${moduleLabel}`,
    ...(asset.subModule ? [`- Sous-module    : ${asset.subModule}`] : []),
    ...(asset.keywordsPrimary ? [`- Mots-clés SEO  : ${asset.keywordsPrimary}`] : []),
    ``,
    `Toute la réponse doit être en FRANÇAIS. JSON uniquement.`,
  ].join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: imageUrl },
          },
          { type: "text", text: userPrompt },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") throw new Error("Claude: réponse non-texte");

  const jsonMatch = block.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Claude: pas de JSON dans la réponse — "${block.text.slice(0, 120)}"`);

  const raw = JSON.parse(jsonMatch[0]) as RawClaude;

  const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).map(String).slice(0, 10) : [];

  return {
    alt: str(raw.alt, 125),
    caption: str(raw.caption, 200),
    description: str(raw.description, 500),
    metaTitle: str(raw.meta_title, 60),
    metaDescription: str(raw.meta_description, 160),
    ogTitle: str(raw.og_title, 90),
    ogDescription: str(raw.og_description, 200),
    aiSummary: str(raw.ai_summary, 500),
    embedTitle: str(raw.embed_title, 60),
    keywordsPrimary: str(raw.keywords_primary, 120),
    keywordsSecondary: arr(raw.keywords_secondary),
  };
}

// ─── Upsert DB ────────────────────────────────────────────────────────────────

async function saveEnriched(imageId: string, slug: string, e: EnrichResult): Promise<void> {
  const titleFr = e.metaTitle || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  await prisma.$transaction(async (tx) => {
    // Translation FR — update uniquement les champs SEO, préserve isPublished
    await tx.imageAssetTranslation.upsert({
      where: { imageId_languageCode: { imageId, languageCode: "fr" } },
      update: {
        alt: e.alt,
        caption: e.caption,
        description: e.description,
        metaTitle: e.metaTitle || null,
        metaDescription: e.metaDescription || null,
        ogTitle: e.ogTitle || null,
        ogDescription: e.ogDescription || null,
        aiSummary: e.aiSummary || null,
        embedTitle: e.embedTitle || null,
      },
      create: {
        imageId,
        languageCode: "fr",
        slug,
        title: titleFr,
        alt: e.alt,
        caption: e.caption,
        description: e.description,
        metaTitle: e.metaTitle || null,
        metaDescription: e.metaDescription || null,
        ogTitle: e.ogTitle || null,
        ogDescription: e.ogDescription || null,
        aiSummary: e.aiSummary || null,
        embedTitle: e.embedTitle || null,
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    // Asset — mise à jour keywords + seoScore
    await tx.imageAsset.update({
      where: { id: imageId },
      data: {
        ...(e.keywordsPrimary ? { keywordsPrimary: e.keywordsPrimary } : {}),
        ...(e.keywordsSecondary.length ? { keywordsSecondary: e.keywordsSecondary } : {}),
        seoScore: 90, // enrichi par Claude Vision → score élevé par défaut
      },
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌  ANTHROPIC_API_KEY manquante");
    process.exit(1);
  }

  console.log(`\n🔍 Recherche des images à enrichir…`);
  console.log(`   Mode : ${FORCE ? "FORCE (re-enrichit tout)" : "normal (skip déjà enrichies)"}`);
  if (SLUG_FILTER) console.log(`   Filtre : --slug ${SLUG_FILTER}`);
  if (LIMIT < 999) console.log(`   Limite : ${LIMIT} images`);
  console.log();

  const whereClause = FORCE
    ? {}
    : {
        NOT: {
          translations: {
            some: { languageCode: "fr", metaTitle: { not: null } },
          },
        },
      };

  const images = await prisma.imageAsset.findMany({
    where: {
      isActive: true,
      ...(SLUG_FILTER ? { slug: SLUG_FILTER } : {}),
      ...whereClause,
    },
    select: {
      id: true,
      slug: true,
      filePath: true,
      module: true,
      subModule: true,
      keywordsPrimary: true,
    },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
  });

  const total = images.length;

  if (total === 0) {
    console.log("✅  Toutes les images sont déjà enrichies. Rien à faire.\n");
    return;
  }

  console.log(`📸  ${total} image(s) à enrichir (Claude Vision → FR)\n`);
  console.log("─".repeat(80));

  let ok = 0;
  let failed = 0;
  const errors: { slug: string; error: string }[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    const prefix = `  [${String(i + 1).padStart(3)}/${total}]`;

    process.stdout.write(`${prefix} ${img.slug.slice(0, 55).padEnd(55)} … `);

    try {
      const enriched = await enrichOne(img);
      await saveEnriched(img.id, img.slug, enriched);
      console.log("✓");
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 100) : String(err);
      console.log(`✗  ${msg}`);
      errors.push({ slug: img.slug, error: msg });
      failed++;
    }

    if (i < images.length - 1) await sleep(DELAY_MS);
  }

  console.log("─".repeat(80));
  console.log(`\n📊  Récap : ${ok} enrichis ✓  |  ${failed} erreurs ✗\n`);

  if (errors.length > 0) {
    console.log("Erreurs :");
    for (const e of errors) console.log(`  - ${e.slug}: ${e.error}`);
    console.log();
  }

  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("Erreur fatale :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
