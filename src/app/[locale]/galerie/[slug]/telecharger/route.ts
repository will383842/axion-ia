/**
 * Public route — `/[locale]/galerie/[slug]/telecharger/route.ts`
 *
 * Download avec watermark on-the-fly via Sharp composite.
 * Rate-limit Redis 10 downloads/min/IP (anti-abus).
 * Track `image_download_logs` (RGPD : IP SHA-256 hashée avec IP_HASH_SALT).
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

  const storageBasePath = process.env.IMAGE_BANK_STORAGE_PATH ?? "/data/image-bank";
  const variantFilename = variant === "original" ? "original" : `image-${variant}.webp`;
  const variantPath = path.join(storageBasePath, image.id, variantFilename);

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(variantPath);
  } catch {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  let outputBuffer = buffer;
  if (image.watermarkEnabled && withWatermark) {
    outputBuffer = await imageWatermarkService.apply(buffer, {
      position: "bottom-right",
      opacity: 0.65,
    });
  }

  // Track download (non-blocking)
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
  const filename = `${t?.slug ?? image.id}-${variant}.webp`;

  return new NextResponse(new Uint8Array(outputBuffer), {
    status: 200,
    headers: {
      "Content-Type": variant === "original" ? `image/${image.fileFormat}` : "image/webp",
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
