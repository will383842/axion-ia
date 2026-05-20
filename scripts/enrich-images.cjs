/**
 * Enrichissement SEO/AEO/GEO (FR) — script CJS pur pour container prod.
 * - fetch() natif Node.js 22 (pas de @anthropic-ai/sdk)
 * - require('/app/prisma/generated/client') (pas de tsx)
 * - Exécution : node /tmp/enrich-images.cjs
 * - Env requis : ANTHROPIC_API_KEY, DATABASE_URL, NEXT_PUBLIC_SITE_URL
 */
"use strict";

const { PrismaClient } = require("/app/prisma/generated/client");
const prisma = new PrismaClient();

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://axion-ia.com").replace(/\/$/, "");
const API_KEY = process.env.ANTHROPIC_API_KEY;
const DELAY_MS = parseInt(process.env.ENRICH_DELAY_MS || "2500", 10);
const FORCE = process.argv.includes("--force");
const SLUG_FILTER = (() => {
  const i = process.argv.indexOf("--slug");
  return i >= 0 ? process.argv[i + 1] : null;
})();
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : 999;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MODULE_LABELS = {
  audit: "Audit IA",
  interventions: "Formation IA",
  implementations: "Automatisation / Implémentation IA",
  "un-a-un": "Accompagnement 1-to-1",
  graphique: "Graphique / Dataviz",
  logo: "Logo Axion-IA",
  proposition: "Proposition de valeur",
  ville: "Présence locale",
};

const SYSTEM_PROMPT = `Tu es un expert SEO/AEO/GEO 2026 pour la banque d'images d'Axion-IA (cabinet IA B2B, France).

Axion-IA : Formations IA · Audits IA 490€ · Implémentations IA · 1-to-1.
Audience : dirigeants PME/ETI, RH, DAF, Ops France.
Ton : professionnel, concret, sobre. Pas de superlatifs. Pas de marketing creux.

Objectifs :
1. Google Images — alt factuellement descriptif.
2. AEO — ai_summary citable par Perplexity/ChatGPT/Claude.
3. GEO — description riche pour sources LLM.
4. Social — og_title + og_description sobres mais percutants.
5. SEO — meta_title + meta_description avec intent keyword.

Contraintes :
- alt : 30-125 chars, factuel, décrit CE QUI EST VISIBLE. Pas "Image de".
- caption : 80-200 chars.
- description : 150-500 chars.
- meta_title : ≤60 chars, keyword + " | Axion-IA".
- meta_description : 140-160 chars, bénéfice + verbe d'action.
- og_title : ≤90 chars.
- og_description : ≤200 chars.
- ai_summary : 1 phrase commençant par "Axion-IA", citable par LLM.
- embed_title : ≤60 chars (Pinterest).
- keywords_primary : 1-4 mots.
- keywords_secondary : tableau 5-10 mots.

JSON uniquement, sans backticks :
{"alt":"...","caption":"...","description":"...","meta_title":"...","meta_description":"...","og_title":"...","og_description":"...","ai_summary":"...","embed_title":"...","keywords_primary":"...","keywords_secondary":["..."]}`;

async function callClaude(imageUrl, slug, module, subModule, kw) {
  const userPrompt = [
    `Analyse cette image Axion-IA — génère les métadonnées SEO/AEO/GEO en FRANÇAIS.`,
    `Slug : ${slug}`,
    `Module : ${MODULE_LABELS[module] || module}`,
    subModule ? `Sous-module : ${subModule}` : "",
    kw ? `Mots-clés : ${kw}` : "",
    `JSON uniquement.`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1100,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Anthropic: réponse vide");

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Pas de JSON: "${text.slice(0, 120)}"`);

  const raw = JSON.parse(match[0]);
  const s = (v, max) => String(v || "").trim().slice(0, max);
  const a = (v) => (Array.isArray(v) ? v.map(String).slice(0, 10) : []);

  return {
    alt: s(raw.alt, 125),
    caption: s(raw.caption, 200),
    description: s(raw.description, 500),
    metaTitle: s(raw.meta_title, 60),
    metaDescription: s(raw.meta_description, 160),
    ogTitle: s(raw.og_title, 90),
    ogDescription: s(raw.og_description, 200),
    aiSummary: s(raw.ai_summary, 500),
    embedTitle: s(raw.embed_title, 60),
    keywordsPrimary: s(raw.keywords_primary, 120),
    keywordsSecondary: a(raw.keywords_secondary),
  };
}

async function saveEnriched(imageId, slug, e) {
  const title = e.metaTitle || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  await prisma.$transaction(async (tx) => {
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
        title,
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

    await tx.imageAsset.update({
      where: { id: imageId },
      data: {
        ...(e.keywordsPrimary ? { keywordsPrimary: e.keywordsPrimary } : {}),
        ...(e.keywordsSecondary.length ? { keywordsSecondary: e.keywordsSecondary } : {}),
        seoScore: 90,
      },
    });
  });
}

async function main() {
  if (!API_KEY) {
    console.error("❌  ANTHROPIC_API_KEY manquante");
    process.exit(1);
  }

  const whereClause = FORCE
    ? {}
    : { NOT: { translations: { some: { languageCode: "fr", metaTitle: { not: null } } } } };

  const images = await prisma.imageAsset.findMany({
    where: {
      isActive: true,
      ...(SLUG_FILTER ? { slug: SLUG_FILTER } : {}),
      ...whereClause,
    },
    select: { id: true, slug: true, filePath: true, module: true, subModule: true, keywordsPrimary: true },
    orderBy: { createdAt: "asc" },
    take: LIMIT,
  });

  const total = images.length;
  if (total === 0) {
    console.log("✅  Toutes les images sont déjà enrichies.\n");
    return;
  }

  console.log(`\n📸  ${total} image(s) à enrichir via Claude Vision (FR)\n${"─".repeat(72)}`);

  let ok = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const prefix = `  [${String(i + 1).padStart(3)}/${total}]`;
    const shortSlug = img.slug.slice(0, 52).padEnd(52);
    process.stdout.write(`${prefix} ${shortSlug} … `);

    try {
      const imageUrl = img.filePath.startsWith("http")
        ? img.filePath
        : `${SITE_URL}/${img.filePath.replace(/^\/+/, "")}`;

      const enriched = await callClaude(imageUrl, img.slug, img.module || "implementations", img.subModule, img.keywordsPrimary);
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

  console.log(`${"─".repeat(72)}\n📊  Récap : ${ok} enrichis ✓  |  ${failed} erreurs ✗\n`);
  if (errors.length) {
    errors.forEach((e) => console.log(`  ✗ ${e.slug}: ${e.error}`));
  }
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => { console.error("Erreur fatale:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
