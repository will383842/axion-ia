/**
 * Qualiopi — Enregistrement des polices PDF (@react-pdf/renderer).
 *
 * Idempotent : le flag `_fontsRegistered` évite les double-registrations.
 * Fail-safe : si les .ttf sont introuvables, warn + fallback Helvetica/Courier.
 * NE bloque jamais le rendu.
 *
 * Polices cherchées dans `public/fonts/*` (chemin process.cwd()).
 */

import { Font } from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs";
import { QUALIOPI_BRAND_FONTS } from "@/server/qualiopi/brand/brand-tokens";

/**
 * Résout un fallback TTF depuis node_modules (Geist bundlé par @vercel/og).
 * Utilisé uniquement quand les polices de marque sont absentes (dev sans assets,
 * CI, tests Vitest) pour enregistrer les noms de familles sous @react-pdf.
 * En production les vraies polices remplacent ce fallback.
 */
function resolveFallbackFont(): string | null {
  const candidates = [
    // @vercel/og bundle Geist qui est toujours présent dans axionia
    path.join(
      process.cwd(),
      "node_modules/.pnpm/@vercel+og@0.11.1/node_modules/@vercel/og/dist/Geist-Regular.ttf",
    ),
    path.join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return null;
}

let _fontsRegistered = false;

function resolveFont(filename: string): string | null {
  const candidate = path.join(process.cwd(), "public", "fonts", filename);
  try {
    if (fs.existsSync(candidate)) return candidate;
  } catch {
    // fs.existsSync peut lancer dans certains envs sandboxés
  }
  return null;
}

/**
 * Enregistre Fraunces / Manrope / Inconsolata pour @react-pdf/renderer.
 * Idempotent (flag module-level). Si les .ttf sont absents → warn + skip
 * (le renderer utilisera Helvetica/Courier par défaut). NE throw jamais.
 */
export function registerQualiopiPdfFonts(): void {
  if (_fontsRegistered) return;
  _fontsRegistered = true;

  const fraunces = resolveFont("Fraunces-Regular.ttf");
  const frauncesItalic = resolveFont("Fraunces-Italic.ttf");
  const frauncesBold = resolveFont("Fraunces-Bold.ttf");

  const manrope = resolveFont("Manrope-Regular.ttf");
  const manropeMedium = resolveFont("Manrope-Medium.ttf");
  const manropeBold = resolveFont("Manrope-Bold.ttf");

  const inconsolata = resolveFont("Inconsolata-Regular.ttf");
  const inconsolataBold = resolveFont("Inconsolata-Bold.ttf");

  try {
    if (fraunces) {
      Font.register({
        family: QUALIOPI_BRAND_FONTS.serif,
        fonts: [
          { src: fraunces, fontWeight: "normal" },
          ...(frauncesItalic ? [{ src: frauncesItalic, fontStyle: "italic" as const }] : []),
          ...(frauncesBold ? [{ src: frauncesBold, fontWeight: "bold" as const }] : []),
        ],
      });
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[qualiopi-pdf-fonts] ${QUALIOPI_BRAND_FONTS.serif} introuvable dans public/fonts/ — fallback Geist`,
        );
      }
      // Enregistre le nom de famille sous un TTF fallback pour éviter
      // "Font family not registered" lors des tests / builds sans assets.
      const fb = resolveFallbackFont();
      if (fb) {
        try {
          Font.register({
            family: QUALIOPI_BRAND_FONTS.serif,
            fonts: [
              { src: fb, fontWeight: "normal" },
              { src: fb, fontWeight: "bold" },
              { src: fb, fontStyle: "italic" as const },
              { src: fb, fontWeight: "bold", fontStyle: "italic" as const },
            ],
          });
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn("[qualiopi-pdf-fonts] Font.register Fraunces échoué :", err);
  }

  try {
    if (manrope) {
      Font.register({
        family: QUALIOPI_BRAND_FONTS.sans,
        fonts: [
          { src: manrope, fontWeight: "normal" },
          ...(manropeMedium ? [{ src: manropeMedium, fontWeight: 500 as const }] : []),
          ...(manropeBold ? [{ src: manropeBold, fontWeight: "bold" as const }] : []),
        ],
      });
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[qualiopi-pdf-fonts] ${QUALIOPI_BRAND_FONTS.sans} introuvable dans public/fonts/ — fallback Geist`,
        );
      }
      const fb = resolveFallbackFont();
      if (fb) {
        try {
          Font.register({
            family: QUALIOPI_BRAND_FONTS.sans,
            fonts: [
              { src: fb, fontWeight: "normal" },
              { src: fb, fontWeight: 500 as const },
              { src: fb, fontWeight: "bold" },
              { src: fb, fontStyle: "italic" as const },
              { src: fb, fontWeight: "bold", fontStyle: "italic" as const },
            ],
          });
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn("[qualiopi-pdf-fonts] Font.register Manrope échoué :", err);
  }

  try {
    if (inconsolata) {
      Font.register({
        family: QUALIOPI_BRAND_FONTS.mono,
        fonts: [
          { src: inconsolata, fontWeight: "normal" },
          ...(inconsolataBold ? [{ src: inconsolataBold, fontWeight: "bold" as const }] : []),
        ],
      });
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[qualiopi-pdf-fonts] ${QUALIOPI_BRAND_FONTS.mono} introuvable dans public/fonts/ — fallback Geist`,
        );
      }
      const fb = resolveFallbackFont();
      if (fb) {
        try {
          Font.register({
            family: QUALIOPI_BRAND_FONTS.mono,
            fonts: [
              { src: fb, fontWeight: "normal" },
              { src: fb, fontWeight: "bold" },
              { src: fb, fontStyle: "italic" as const },
            ],
          });
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn("[qualiopi-pdf-fonts] Font.register Inconsolata échoué :", err);
  }
}
