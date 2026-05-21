/**
 * Public route — `/[locale]/galerie/[slug]/telecharger/route.ts`
 *
 * Download avec watermark on-the-fly via Sharp composite.
 * Rate-limit Redis 10 downloads/min/IP (anti-abus).
 * Track `image_download_logs` (RGPD : IP SHA-256 hashée avec IP_HASH_SALT).
 *
 * Deux familles de stockage :
 *   - Slug-based  : filePath = "images/axion-ia-*.webp" → lu depuis public/ (Next.js)
 *   - UUID-based  : filePath = "/image-bank/{uuid}/…"   → lu depuis Docker volume
 *
 * Query param `?format=jpeg` → conversion WebP → JPEG via Sharp.
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { imageWatermarkService } from "@/server/image-bank/services/image-watermark.service";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_KEY_PREFIX = "image-bank:download:ip:";

const ALLOWED_VARIANTS = ["sm", "md", "lg", "xl", "original"] as const;
type VariantKey = (typeof ALLOWED_VARIANTS)[number];

function hashIp(ip: string): string {
  const salt = env.IP_HASH_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: "fr" | "en"; slug: string }> },
) {
  const { locale, slug } = await params;
  const url = new URL(request.url);
  const variantParam = url.searchParams.get("variant") ?? "lg";
  const withWatermark = url.searchParams.get("watermark") !== "false";
  const format = url.searchParams.get("format"); // "jpeg"/"jpg" → JPEG conversion

  if (!ALLOWED_VARIANTS.includes(variantParam as VariantKey)) {
    return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
  }
  const variant = variantParam as VariantKey;

  const reqHeaders = await headers();
  const ip = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip);

  const rate = await checkRateLimit(`${RATE_LIMIT_KEY_PREFIX}${ipHash}`, {
    limit: RATE_LIMIT_MAX,
    windowSec: RATE_LIMIT_WINDOW_SEC,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many downloads. Try again in a minute." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rate.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  }

  const image = await prisma.imageAsset.findFirst({
    where: {
      translations: { some: { slug, languageCode: locale } },
      deletedAt: null,
      publishedAt: { not: null },
      isActive: true,
    },
    include: { translations: { where: { languageCode: locale }, take: 1 } },
  });

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // ── Résolution du fichier selon le type de stockage ─────────────────────────
  const isSlugBased = image.filePath && !image.filePath.startsWith("/image-bank");

  let buffer: Buffer;
  if (isSlugBased) {
    // Images seedées dans public/ — lecture directe depuis le filesystem Next.js
    const relativePath = image.filePath.replace(/^\//, "");
    const fullPath = path.join(process.cwd(), "public", relativePath);
    try {
      buffer = await fs.readFile(fullPath);
    } catch {
      return NextResponse.json({ error: "Image file not found" }, { status: 404 });
    }
  } else {
    // Images admin uploadées dans Docker volume
    const storageBasePath = process.env.IMAGE_BANK_STORAGE_PATH ?? "/data/image-bank";
    const variantFilename = variant === "original" ? "original" : `image-${variant}.webp`;
    const variantPath = path.join(storageBasePath, image.id, variantFilename);
    try {
      buffer = await fs.readFile(variantPath);
    } catch {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }
  }

  // ── Watermark (WebP uniquement, avant conversion éventuelle) ──────────────────
  let outputBuffer: Buffer = buffer;
  if (image.watermarkEnabled && withWatermark && format !== "jpeg" && format !== "jpg") {
    outputBuffer = await imageWatermarkService.apply(buffer, {
      position: "bottom-right",
      opacity: 0.65,
    });
  }

  // ── Conversion JPEG on-the-fly si demandée ────────────────────────────────────
  let contentType = "image/webp";
  let fileExtension = "webp";

  if (format === "jpeg" || format === "jpg") {
    const sharp = (await import("sharp")).default;
    outputBuffer = await sharp(buffer).jpeg({ quality: 92 }).toBuffer();
    contentType = "image/jpeg";
    fileExtension = "jpg";
  }

  // ── Tracking download (non-blocking) ─────────────────────────────────────────
  void prisma.imageDownloadLog
    .create({
      data: {
        imageId: image.id,
        variant,
        ipHash,
        userAgent: reqHeaders.get("user-agent")?.slice(0, 255) ?? "",
        downloadedAt: new Date(),
      },
    })
    .catch((err) => console.error("[telecharger] track failed:", err));

  void prisma.imageAsset
    .update({
      where: { id: image.id },
      data: { downloadCount: { increment: 1 } },
    })
    .catch(() => undefined);

  const t = image.translations[0];
  const filename = `${t?.slug ?? image.id}-${variant}.${fileExtension}`;

  return new NextResponse(new Uint8Array(outputBuffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(outputBuffer.length),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ locale: "fr" | "en"; slug: string }> },
) {
  const response = await GET(request, context);
  return new NextResponse(null, { status: response.status, headers: response.headers });
}
