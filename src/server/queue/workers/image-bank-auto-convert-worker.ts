// Image-bank auto-convert worker.
//
// Consume la queue `image-bank-convert` : prend une image source (PNG/JPG/WebP)
// et produit 7 variants (WebP + AVIF) en nommage slug-based pour le dossier
// public/images/ (distinct du pipeline image-bank-import qui stocke dans
// public/image-bank/{uuid}/).
//
// Déclenché par :
//   imageConvertQueue.add('auto-convert', {
//     sourcePath, targetSlug, category, imageType, isLogo?
//   })
//
// Retourne via job.returnValue : { lqipBase64, slug }

import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { Worker } from "bullmq";
import * as Sentry from "@sentry/nextjs";

import { getBullConnectionOrThrow } from "../connection";
import { SHARP_LIMITS, AUTO_CONVERT_QUEUE_NAME } from "@/server/image-bank/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ImageBankAutoConvertJobData = {
  /** Chemin absolu vers le fichier source (PNG/JPG/WebP/TIFF). */
  sourcePath: string;
  /** Slug de sortie (sans extension). Les 7 variants seront préfixés de ce slug. */
  targetSlug: string;
  /** Catégorie éditoriale (informative). */
  category: string;
  /**
   * Type visuel — influence la logique de recadrage smart.
   * Valeurs : banniere, carre, affiche, infographie, editorial, photo, dataviz, logo.
   */
  imageType: ImageType;
  /** Si true : WebP principal encodé en lossless (logo). */
  isLogo?: boolean;
  /** Coordonnées GPS — inscrites dans EXIF pour les images géolocalisées (villes). */
  geoLat?: number;
  geoLon?: number;
};

export type ImageBankAutoConvertResult = {
  lqipBase64: string;
  slug: string;
};

// ─── Constantes variants ─────────────────────────────────────────────────────

type ImageType =
  | "banniere"
  | "carre"
  | "affiche"
  | "infographie"
  | "editorial"
  | "photo"
  | "dataviz"
  | "logo";

interface VariantDef {
  /** Suffixe ajouté au slug — "" pour le variant pleine largeur. */
  suffix: string;
  format: "webp" | "avif";
  quality: number;
  width: number | null;
  height: number | null;
}

const VARIANTS: ReadonlyArray<VariantDef> = [
  { suffix: "", format: "webp", quality: 85, width: null, height: null },
  { suffix: "", format: "avif", quality: 70, width: null, height: null },
  { suffix: "-og", format: "webp", quality: 90, width: 1200, height: 630 },
  { suffix: "-square", format: "webp", quality: 90, width: 1080, height: 1080 },
  { suffix: "-thumb", format: "webp", quality: 80, width: 400, height: 300 },
  { suffix: "-md", format: "webp", quality: 85, width: 768, height: null },
  { suffix: "-sm", format: "webp", quality: 80, width: 384, height: null },
] as const;

/** Positions de recadrage selon le type visuel. */
const CROP_CONFIG: Record<ImageType, { ogPosition: sharp.Gravity; squarePosition: sharp.Gravity }> =
  {
    banniere: { ogPosition: "centre", squarePosition: "attention" },
    carre: { ogPosition: "centre", squarePosition: "centre" },
    affiche: { ogPosition: "west", squarePosition: "attention" },
    infographie: { ogPosition: "north", squarePosition: "north" },
    editorial: { ogPosition: "centre", squarePosition: "centre" },
    photo: { ogPosition: "attention", squarePosition: "attention" },
    dataviz: { ogPosition: "centre", squarePosition: "centre" },
    logo: { ogPosition: "centre", squarePosition: "centre" },
  };

/** Types qui doivent utiliser `fit: 'contain'` (fond blanc) plutôt que `cover`. */
const CONTAIN_TYPES: ReadonlySet<ImageType> = new Set(["carre", "dataviz", "logo"]);

// ─── Pipeline ─────────────────────────────────────────────────────────────────

async function runConvert(data: ImageBankAutoConvertJobData): Promise<ImageBankAutoConvertResult> {
  const { sourcePath, targetSlug, imageType, isLogo = false } = data;

  const sourceBuffer = await fs.readFile(sourcePath);
  const meta = await sharp(sourceBuffer, SHARP_LIMITS).metadata();

  if (!meta.width || !meta.height) {
    throw new Error(`[image-bank-auto-convert] Image sans dimensions : ${sourcePath}`);
  }

  // Upscale si largeur < 1200 px (gate Google Discover recommandé).
  let input: Buffer = sourceBuffer;
  if (meta.width < 1200) {
    input = (await sharp(sourceBuffer, SHARP_LIMITS)
      .resize(1200, null, { kernel: "lanczos3", withoutEnlargement: false })
      .toBuffer()) as Buffer;
  }

  const outputDir = path.join(process.cwd(), "public", "images");
  await fs.mkdir(outputDir, { recursive: true });

  const crop = CROP_CONFIG[imageType] ?? CROP_CONFIG.banniere;
  const useContain = CONTAIN_TYPES.has(imageType) || isLogo;

  for (const v of VARIANTS) {
    let pipe = sharp(input, SHARP_LIMITS);

    if (v.suffix === "-og" && v.width !== null && v.height !== null) {
      if (useContain) {
        pipe = pipe.resize(v.width, v.height, { fit: "contain", background: "#FFFFFF" });
      } else {
        pipe = pipe.resize(v.width, v.height, { fit: "cover", position: crop.ogPosition });
      }
    } else if (v.suffix === "-square" && v.width !== null && v.height !== null) {
      if (useContain) {
        pipe = pipe.resize(v.width, v.height, { fit: "contain", background: "#FFFFFF" });
      } else {
        pipe = pipe.resize(v.width, v.height, { fit: "cover", position: crop.squarePosition });
      }
    } else if (v.suffix === "-thumb" && v.width !== null && v.height !== null) {
      pipe = pipe.resize(v.width, v.height, { fit: "cover", position: "attention" });
    } else if (v.width !== null) {
      pipe = pipe.resize(v.width, null, { withoutEnlargement: true });
    }

    // EXIF/XMP — copyright + creator inscrits dans le fichier (Google Images lit ces données)
    pipe = pipe.withMetadata({
      exif: {
        IFD0: {
          Copyright: "© 2026 Axion-IA OÜ — CC BY 4.0",
          Artist: "Axion-IA",
          ImageDescription: targetSlug,
          Software: "Axion-IA image pipeline (Sharp)",
          ...(data.geoLat && data.geoLon
            ? {
                GPSLatitude: data.geoLat.toString(),
                GPSLongitude: data.geoLon.toString(),
              }
            : {}),
        },
      },
    });

    if (isLogo && v.format === "webp") {
      pipe = pipe.webp({ lossless: true });
    } else if (v.format === "avif") {
      pipe = pipe.avif({ quality: v.quality });
    } else {
      pipe = pipe.webp({ quality: v.quality });
    }

    const outPath = path.join(outputDir, `${targetSlug}${v.suffix}.${v.format}`);
    await pipe.toFile(outPath);
  }

  // LQIP — 16 px wide, blur, WebP qualité 20 (≤ 1 KB inline)
  const lqipBuffer = await sharp(input, SHARP_LIMITS)
    .resize(16)
    .blur(8)
    .webp({ quality: 20 })
    .toBuffer();

  return {
    lqipBase64: `data:image/webp;base64,${lqipBuffer.toString("base64")}`,
    slug: targetSlug,
  };
}

// ─── Worker BullMQ ────────────────────────────────────────────────────────────

export function startImageBankAutoConvertWorker(): Worker<
  ImageBankAutoConvertJobData,
  ImageBankAutoConvertResult,
  string
> {
  const worker = new Worker<ImageBankAutoConvertJobData, ImageBankAutoConvertResult, string>(
    AUTO_CONVERT_QUEUE_NAME,
    async (job) => runConvert(job.data),
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 2,
      // Bornage retention Redis — aligné sur les autres image-bank workers.
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on("ready", () => console.log("[image-bank-auto-convert-worker] ready"));
  worker.on("completed", (job) =>
    console.log(`[image-bank-auto-convert-worker] done: ${job.data.targetSlug}`),
  );
  worker.on("failed", (job, err) => {
    console.error(
      `[image-bank-auto-convert-worker] failed: ${job?.data?.targetSlug ?? "?"}: ${err.message}`,
    );
    Sentry.captureException(err, {
      tags: { worker: "image-bank-auto-convert" },
      extra: {
        jobId: job?.id,
        targetSlug: job?.data?.targetSlug,
        sourcePath: job?.data?.sourcePath,
        imageType: job?.data?.imageType,
        attemptsMade: job?.attemptsMade,
      },
    });
  });

  return worker;
}
