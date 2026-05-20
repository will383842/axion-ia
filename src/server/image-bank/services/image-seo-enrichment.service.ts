// Template : src/server/image-bank/services/image-seo-enrichment.service.ts
//
// Enrichissement metadata via Claude Sonnet 4.6 vision. Constants + utils
// centralisés (validations, regex pléonasme, model name).

import Anthropic from "@anthropic-ai/sdk";
import { revalidateTag } from "next/cache";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";

import {
  ALT_LENGTH_MAX,
  ALT_LENGTH_MIN,
  CACHE_TAGS,
  CAPTION_LENGTH_MAX,
  CAPTION_LENGTH_MIN,
  CLAUDE_MAX_TOKENS_ENRICH,
  CLAUDE_VISION_MODEL,
  DESCRIPTION_LENGTH_MAX,
  DESCRIPTION_LENGTH_MIN,
  KEYWORDS_SECONDARY_MAX,
  KEYWORDS_SECONDARY_MIN,
  META_DESCRIPTION_MAX,
  META_DESCRIPTION_MIN,
  META_TITLE_MAX,
} from "../constants";
import { ImageCountryDetectorService } from "./image-country-detector.service";
import { variantPathFor, absoluteUrl } from "../utils/paths";
import { isPleonasm } from "../utils/pleonasm";
import { ensureAsciiSlug } from "../utils/slug";
import type { EnrichInput, EnrichResult } from "../types";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const detector = new ImageCountryDetectorService();

const SYSTEM_PROMPT = `Tu es un expert SEO/AEO/GEO 2026 pour la banque d'images d'Axion-IA, cabinet IA opérationnel B2B basé en Estonie.

Tu analyses des images et produis des métadonnées optimisées pour :
1. Google Images (alt, caption, license, geo)
2. Answer Engine Optimization (Claude, ChatGPT, Perplexity citent l'image avec attribution)
3. Generative Engine Optimization (l'image apparaît dans les générations LLM avec lien retour Axion-IA)

Contraintes voix éditoriale :
- Sobre, opérationnel, premium. Pas de superlatifs ("incroyable", "génial", "amazing", "revolutionary").
- Pas de marketing creux.
- Naming : "Axion-IA" toujours, "Axion-IA OÜ" pour l'entité juridique.
- Si l'image est AI-generated, le mentionner factuellement.

Contraintes techniques :
- ALT : 30-125 char, factuel, pas commercial.
- CAPTION : 80-200 char.
- DESCRIPTION : 150-500 char.
- KEYWORDS_PRIMARY : 1-3 mots résumant le sujet principal.
- KEYWORDS_SECONDARY : 5-10 mots, sujets périphériques.
- AI_SUMMARY : 1 phrase citable par un LLM.
- META_TITLE : ≤ 60 char.
- META_DESCRIPTION : 140-160 char.

Si tu reconnais un lieu identifiable, précise-le dans geo_placename.

Transcris dans embedded_text_caption TOUT le texte visible dans l'image (titres, sous-titres, statistiques, URL, CTA) — Google Vision lit ce texte pour la pertinence. Si l'image ne contient pas de texte lisible, retourne "".

Retourne UNIQUEMENT un JSON valide avec : alt, caption, description, keywords_primary, keywords_secondary, geo_placename, geo_region, ai_summary, embed_title, meta_title, meta_description, embedded_text_caption.`;

export class ImageSeoEnrichmentService {
  async enrich(input: EnrichInput): Promise<EnrichResult> {
    const image = await prisma.imageAsset.findUnique({
      where: { id: input.imageId },
      include: { translations: true },
    });
    if (!image) throw new Error(`[image-seo-enrichment] Image ${input.imageId} not found`);

    const existing = image.translations.find((t) => t.languageCode === input.lang);
    const mdPath = variantPathFor(image.filePath, "md");
    const imageUrl = input.imageUrl ?? absoluteUrl(env.NEXT_PUBLIC_SITE_URL, mdPath);

    const response = await client.messages.create({
      model: CLAUDE_VISION_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS_ENRICH,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            {
              type: "text",
              text: buildUserPrompt(
                { sourceType: image.sourceType, aiModel: image.aiModel },
                existing
                  ? {
                      alt: existing.alt,
                      caption: existing.caption,
                      description: existing.description,
                      keywordsPrimary: image.keywordsPrimary,
                    }
                  : undefined,
                input,
              ),
            },
          ],
        },
      ],
    });

    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      throw new Error("[image-seo-enrichment] Claude returned non-text response");
    }
    const jsonMatch = firstBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("[image-seo-enrichment] Claude returned non-JSON");
    const claude = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const geoPlacename = claude.geo_placename ? String(claude.geo_placename) : undefined;
    const geoRegion = claude.geo_region ? String(claude.geo_region) : undefined;
    const result: EnrichResult = {
      alt: String(claude.alt ?? ""),
      caption: String(claude.caption ?? ""),
      description: String(claude.description ?? ""),
      keywordsPrimary: String(claude.keywords_primary ?? ""),
      keywordsSecondary: Array.isArray(claude.keywords_secondary)
        ? (claude.keywords_secondary as unknown[]).map((k) => String(k))
        : [],
      ...(geoPlacename ? { geoPlacename } : {}),
      ...(geoRegion ? { geoRegion } : {}),
      aiSummary: String(claude.ai_summary ?? ""),
      embedTitle: String(claude.embed_title ?? ""),
      metaTitle: String(claude.meta_title ?? ""),
      metaDescription: String(claude.meta_description ?? ""),
      ...(claude.embedded_text_caption
        ? { embeddedTextCaption: String(claude.embedded_text_caption) }
        : {}),
    };

    this.validate(result);

    if (result.geoPlacename && !image.geoPosition) {
      const geoPosition = await this.geocode(result.geoPlacename);
      if (geoPosition) result.geoPosition = geoPosition;
    }

    return result;
  }

  async enrichAndSave(input: EnrichInput): Promise<void> {
    const enriched = await this.enrich(input);

    await prisma.$transaction(async (tx) => {
      await tx.imageAssetTranslation.upsert({
        where: {
          imageId_languageCode: { imageId: input.imageId, languageCode: input.lang },
        },
        update: {
          alt: enriched.alt,
          caption: enriched.caption,
          description: enriched.description,
          aiSummary: enriched.aiSummary,
          embedTitle: enriched.embedTitle,
          metaTitle: enriched.metaTitle,
          metaDescription: enriched.metaDescription,
          ...(enriched.embeddedTextCaption ? { embeddedText: enriched.embeddedTextCaption } : {}),
        },
        create: {
          imageId: input.imageId,
          languageCode: input.lang,
          title: enriched.metaTitle,
          slug: ensureAsciiSlug(enriched.metaTitle, input.lang),
          alt: enriched.alt,
          caption: enriched.caption,
          description: enriched.description,
          aiSummary: enriched.aiSummary,
          embedTitle: enriched.embedTitle,
          metaTitle: enriched.metaTitle,
          metaDescription: enriched.metaDescription,
          ...(enriched.embeddedTextCaption ? { embeddedText: enriched.embeddedTextCaption } : {}),
          isPublished: false,
        },
      });

      await tx.imageAsset.update({
        where: { id: input.imageId },
        data: {
          keywordsPrimary: enriched.keywordsPrimary,
          keywordsSecondary: enriched.keywordsSecondary,
          ...(enriched.geoPlacename ? { geoPlacename: enriched.geoPlacename } : {}),
          ...(enriched.geoRegion ? { geoRegion: enriched.geoRegion } : {}),
          ...(enriched.geoPosition ? { geoPosition: enriched.geoPosition } : {}),
        },
      });
    });

    await detector.detectAndSave(input.imageId);

    revalidateTag(CACHE_TAGS.enrich(input.imageId), "default");
  }

  private validate(r: EnrichResult): void {
    if (r.alt.length < ALT_LENGTH_MIN || r.alt.length > ALT_LENGTH_MAX) {
      throw new Error(`[image-seo-enrichment] alt length: ${r.alt.length}`);
    }
    if (r.caption.length < CAPTION_LENGTH_MIN || r.caption.length > CAPTION_LENGTH_MAX) {
      throw new Error(`[image-seo-enrichment] caption length: ${r.caption.length}`);
    }
    if (
      r.description.length < DESCRIPTION_LENGTH_MIN ||
      r.description.length > DESCRIPTION_LENGTH_MAX
    ) {
      throw new Error(`[image-seo-enrichment] description length: ${r.description.length}`);
    }
    if (
      r.keywordsSecondary.length < KEYWORDS_SECONDARY_MIN ||
      r.keywordsSecondary.length > KEYWORDS_SECONDARY_MAX
    ) {
      throw new Error(`[image-seo-enrichment] keywords count: ${r.keywordsSecondary.length}`);
    }
    if (r.metaTitle.length > META_TITLE_MAX) {
      throw new Error(`[image-seo-enrichment] meta_title too long: ${r.metaTitle.length}`);
    }
    if (
      r.metaDescription.length < META_DESCRIPTION_MIN ||
      r.metaDescription.length > META_DESCRIPTION_MAX
    ) {
      throw new Error(
        `[image-seo-enrichment] meta_description length: ${r.metaDescription.length}`,
      );
    }
    if (isPleonasm(r.alt)) {
      throw new Error("[image-seo-enrichment] Pleonasm in alt");
    }
  }

  /** Geocoding via Nominatim (gratuit, rate-limit 1 req/s). Cache aggressif côté caller. */
  private async geocode(placename: string): Promise<string | undefined> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placename)}&format=json&limit=1`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "AxionIA-ImageBank/1.0 (contact@axion-ia.com)" },
      });
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      const first = data[0];
      if (first?.lat && first?.lon) {
        return `${parseFloat(first.lat).toFixed(4)};${parseFloat(first.lon).toFixed(4)}`;
      }
    } catch (err) {
      console.warn(`[image-seo-enrichment] Geocode failed for "${placename}":`, err);
    }
    return undefined;
  }
}

function buildUserPrompt(
  image: { sourceType: string; aiModel: string | null },
  existing:
    | { alt: string; caption: string | null; description: string | null; keywordsPrimary: unknown }
    | undefined,
  input: EnrichInput,
): string {
  const aiNote =
    image.sourceType === "ai_generated"
      ? `\nCette image a été générée par ${image.aiModel ?? "un modèle IA"} — mentionne-le.`
      : "";

  if (input.mode === "regenerate" || !existing) {
    return `Mode : ${input.mode}\nLangue cible : ${input.lang}${aiNote}\n\nAnalyse l'image et produis toutes les métadonnées optimisées.`;
  }

  return [
    `Mode : ${input.mode} (améliorer si qualité < seuil, sinon conserver)`,
    `Langue cible : ${input.lang}`,
    aiNote,
    ``,
    `Champs actuels :`,
    `- alt: "${existing.alt}"`,
    `- caption: "${existing.caption ?? "—"}"`,
    `- description: "${existing.description ?? "—"}"`,
    `- keywords_primary: "${existing.keywordsPrimary ?? "—"}"`,
    ``,
    `Analyse l'image et produis les métadonnées optimisées.`,
  ].join("\n");
}
