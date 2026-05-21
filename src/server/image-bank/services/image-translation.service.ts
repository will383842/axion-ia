// Template : src/server/image-bank/services/image-translation.service.ts
//
// Claude Sonnet 4.6 vision pour traduire FR ↔ EN (metadata + descriptions).
// Constants (modèle, max tokens) centralisées dans `../constants`.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { revalidateTag } from "next/cache";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";

import {
  ALT_LENGTH_MAX,
  ALT_LENGTH_MIN,
  CACHE_TAGS,
  CLAUDE_MAX_TOKENS_TRANSLATE,
  CLAUDE_VISION_MODEL,
  type ImageBankLocale,
} from "../constants";
import { variantPathFor, absoluteUrl } from "../utils/paths";
import { ensureAsciiSlug, isAsciiSlug } from "../utils/slug";
import type { TranslateInput, TranslateResult } from "../types";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es un traducteur expert SEO/AEO pour la banque d'images d'Axion-IA (cabinet IA opérationnel B2B français).

Contraintes :
1. Traduis FR ↔ EN.
2. Garde la voix éditoriale Axion-IA : sobre, premium, opérationnel. Pas de superlatifs ("incredible", "amazing"). Pas de marketing creux.
3. ALT TEXT (30-125 caractères) décrit factuellement ce qui est SUR l'image (humains, objets, lieu) — pas une opinion ni un message commercial.
4. SLUGS ASCII romanisé, minuscules, tirets (pas d'underscores). Pas d'apostrophes ni d'accents.
5. META TITLE ≤ 60 char, META DESCRIPTION 140-160 char.
6. AI SUMMARY : 1 phrase qui résume l'image pour un LLM qui voudrait la citer comme source.
7. Naming : toujours "Axion-IA" (avec tiret), jamais "AxionIA" ni "Axion IA".
8. Si l'image montre un lieu identifiable, mentionne-le.
9. Pas de pléonasme en début d'alt ("image of this picture", "photo de cette image").
10. Si image AI-generated, le mentionner factuellement.

Retourne UNIQUEMENT un JSON valide avec : title, slug, alt, caption, description, meta_title, meta_description, og_title, og_description, ai_summary, embed_title.`;

export class ImageTranslationService {
  async translate(input: TranslateInput): Promise<TranslateResult> {
    const image = await prisma.imageAsset.findUnique({
      where: { id: input.imageId },
      include: { translations: true },
    });
    if (!image) throw new Error(`[image-translation] Image ${input.imageId} not found`);

    const source = image.translations.find((t) => t.languageCode === input.sourceLang);
    if (!source) {
      throw new Error(`[image-translation] No source translation in ${input.sourceLang}`);
    }

    // Build image source pour Claude vision : URL en prod, base64 en dev.
    const mdPath = variantPathFor(image.filePath, "md");
    const isProd = env.NODE_ENV === "production";
    const imageSource =
      input.imageUrl || isProd
        ? {
            type: "url" as const,
            url: input.imageUrl ?? absoluteUrl(env.NEXT_PUBLIC_SITE_URL, mdPath),
          }
        : await readLocalImageAsBase64Source(mdPath);

    const response = await client.messages.create({
      model: CLAUDE_VISION_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS_TRANSLATE,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: imageSource },
            { type: "text", text: buildUserPrompt(image, source, input.targetLang) },
          ],
        },
      ],
    });

    const firstBlock = response.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      throw new Error("[image-translation] Claude returned non-text response");
    }
    const jsonMatch = firstBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("[image-translation] Claude returned non-JSON");

    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return normalizeAndValidate(raw, input.targetLang);
  }

  async translateAndSave(input: TranslateInput): Promise<void> {
    const translation = await this.translate(input);

    await prisma.imageAssetTranslation.upsert({
      where: {
        imageId_languageCode: {
          imageId: input.imageId,
          languageCode: input.targetLang,
        },
      },
      update: translation,
      create: {
        imageId: input.imageId,
        languageCode: input.targetLang,
        ...translation,
        isPublished: false,
      },
    });

    const image = await prisma.imageAsset.findUnique({ where: { id: input.imageId } });
    const langs = new Set([
      ...((image?.targetLanguages as string[] | null) ?? []),
      input.targetLang,
    ]);
    await prisma.imageAsset.update({
      where: { id: input.imageId },
      data: { targetLanguages: [...langs] },
    });

    revalidateTag(CACHE_TAGS.image(translation.slug), "default");
    revalidateTag(CACHE_TAGS.byLang(input.targetLang), "default");
  }
}

function buildUserPrompt(
  image: {
    sourceType: string;
    aiModel: string | null;
    targetCountries: unknown;
    geoPlacename: string | null;
    keywordsPrimary: string | null;
  },
  source: {
    languageCode: string;
    title: string;
    alt: string;
    caption: string | null;
    description: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    aiSummary: string | null;
  },
  targetLang: string,
): string {
  const countries = (image.targetCountries as string[] | null) ?? [];
  return [
    `Image source (langue ${source.languageCode}) :`,
    `- title: ${source.title}`,
    `- alt: ${source.alt}`,
    `- caption: ${source.caption ?? "—"}`,
    `- description: ${source.description ?? "—"}`,
    `- meta_title: ${source.metaTitle ?? "—"}`,
    `- meta_description: ${source.metaDescription ?? "—"}`,
    `- ai_summary: ${source.aiSummary ?? "—"}`,
    ``,
    `Contexte :`,
    `- Source type: ${image.sourceType}`,
    `- AI model (si applicable): ${image.aiModel ?? "—"}`,
    `- Target countries: ${countries.join(", ") || "—"}`,
    `- Geo placename: ${image.geoPlacename ?? "—"}`,
    `- Keywords primary: ${image.keywordsPrimary ?? "—"}`,
    ``,
    `Traduis ces métadonnées vers ${targetLang} en respectant les contraintes du prompt système.`,
  ].join("\n");
}

function normalizeAndValidate(
  raw: Record<string, unknown>,
  lang: ImageBankLocale,
): TranslateResult {
  const title = String(raw.title ?? "");
  if (title.length < 10 || title.length > 100) {
    throw new Error(`[image-translation] Title length out of bounds: ${title.length}`);
  }

  const slug = ensureAsciiSlug(String(raw.slug ?? title), lang);
  if (!isAsciiSlug(slug)) {
    throw new Error(`[image-translation] Slug not ASCII safe: ${slug}`);
  }

  let alt = String(raw.alt ?? "");
  if (alt.length > ALT_LENGTH_MAX) alt = alt.slice(0, ALT_LENGTH_MAX - 3) + "...";
  if (alt.length < ALT_LENGTH_MIN) {
    throw new Error(
      `[image-translation] Alt too short (${alt.length} char, need ≥ ${ALT_LENGTH_MIN})`,
    );
  }

  return {
    title,
    slug,
    alt,
    caption: raw.caption ? String(raw.caption) : null,
    description: raw.description ? String(raw.description) : null,
    metaTitle: raw.meta_title ? String(raw.meta_title) : null,
    metaDescription: raw.meta_description ? String(raw.meta_description) : null,
    ogTitle: raw.og_title ? String(raw.og_title) : null,
    ogDescription: raw.og_description ? String(raw.og_description) : null,
    aiSummary: raw.ai_summary ? String(raw.ai_summary) : null,
    embedTitle: raw.embed_title ? String(raw.embed_title) : null,
  };
}

async function readLocalImageAsBase64Source(relativePath: string) {
  const abs = join(process.cwd(), "public", relativePath.replace(/^\/?(public\/)?/, ""));
  const buf = await readFile(abs);
  // Anthropic vision n'accepte que jpeg/png/gif/webp — pas d'AVIF.
  // Pour AVIF on bascule en URL absolue (rendue par le serveur) ; ici on
  // mappe l'extension à un media_type supporté ou on fallback WebP.
  const mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" = relativePath.endsWith(
    ".png",
  )
    ? "image/png"
    : relativePath.endsWith(".jpg") || relativePath.endsWith(".jpeg")
      ? "image/jpeg"
      : relativePath.endsWith(".gif")
        ? "image/gif"
        : "image/webp";
  return {
    type: "base64" as const,
    media_type: mediaType,
    data: buf.toString("base64"),
  };
}
