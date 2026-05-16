// Template : src/server/image-bank/services/image-watermark.service.ts
//
// Watermark on-the-fly via Sharp text overlay pour route `/galerie/[slug]/telecharger`.
// Constants Design.md v3 (mocha #2a2520, opacité 0.65) centralisées dans `../constants`.

import sharp from "sharp";

import {
  SHARP_LIMITS,
  WATERMARK_COLOR,
  WATERMARK_DEFAULT_POSITION,
  WATERMARK_DEFAULT_TEXT_FN,
  WATERMARK_OPACITY,
} from "../constants";
import type { WatermarkOptions } from "../types";

const DEFAULTS_FN = (): Required<WatermarkOptions> => ({
  color: WATERMARK_COLOR,
  opacity: WATERMARK_OPACITY,
  text: WATERMARK_DEFAULT_TEXT_FN(new Date().getFullYear()),
  fontSize: 18,
  position: WATERMARK_DEFAULT_POSITION,
});

export class ImageWatermarkService {
  /**
   * Applique un watermark texte SVG sur l'image source.
   * Retourne le buffer WebP prêt à servir (pas de fichier persisté).
   */
  async apply(sourceBuffer: Buffer, options: WatermarkOptions = {}): Promise<Buffer> {
    const opts: Required<WatermarkOptions> = { ...DEFAULTS_FN(), ...options };

    const meta = await sharp(sourceBuffer, SHARP_LIMITS).metadata();
    if (!meta.width || !meta.height) {
      throw new Error("[image-watermark] Image sans dimensions");
    }

    // Font-size adaptatif (~ 2 % de la largeur, clamp 12-32px)
    const adaptiveFontSize =
      options.fontSize ?? Math.max(12, Math.min(32, Math.round(meta.width * 0.018)));

    const padding = Math.round(adaptiveFontSize * 1.2);
    const textWidth = Math.round(opts.text.length * adaptiveFontSize * 0.55);
    const textHeight = Math.round(adaptiveFontSize * 1.4);

    const { x, y, anchor } = computeAnchor(
      opts.position,
      meta.width,
      meta.height,
      textWidth,
      textHeight,
      padding,
    );

    const svg = Buffer.from(
      `<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
        <text
          x="${x}"
          y="${y}"
          text-anchor="${anchor}"
          font-family="Manrope, system-ui, sans-serif"
          font-size="${adaptiveFontSize}"
          font-weight="500"
          fill="${opts.color}"
          fill-opacity="${opts.opacity}"
          stroke="#faf8f3"
          stroke-width="0.5"
          stroke-opacity="0.4"
        >${escapeSvgText(opts.text)}</text>
      </svg>`,
    );

    return sharp(sourceBuffer, SHARP_LIMITS)
      .composite([{ input: svg, top: 0, left: 0 }])
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
  }
}

export const imageWatermarkService = new ImageWatermarkService();

function computeAnchor(
  position: Required<WatermarkOptions>["position"],
  imgW: number,
  imgH: number,
  textW: number,
  textH: number,
  padding: number,
): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  switch (position) {
    case "bottom-left":
      return { x: padding, y: imgH - padding, anchor: "start" };
    case "top-right":
      return { x: imgW - padding, y: padding + textH, anchor: "end" };
    case "top-left":
      return { x: padding, y: padding + textH, anchor: "start" };
    case "bottom-right":
    default:
      return { x: imgW - padding, y: imgH - padding, anchor: "end" };
  }
}

function escapeSvgText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
