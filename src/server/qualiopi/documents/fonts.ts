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
import { createRequire } from "node:module";
import { QUALIOPI_BRAND_FONTS } from "@/server/qualiopi/brand/brand-tokens";

/**
 * Résout un fallback TTF depuis node_modules (Geist bundlé par @vercel/og).
 * Utilisé uniquement quand les polices de marque sont absentes (dev sans assets,
 * CI, tests Vitest) pour enregistrer les noms de familles sous @react-pdf.
 * En production les vraies polices remplacent ce fallback.
 *
 * Résolution robuste (insensible à la version) : on localise d'abord le package
 * `@vercel/og` réellement installé via `require.resolve`, puis on retombe sur
 * des chemins connus. ⚠️ Ne JAMAIS coder en dur un chemin pnpm versionné
 * comme seul candidat : un bump de @vercel/og (ou de Next) le casserait et
 * referait échouer tout le rendu PDF (« Font family not registered »).
 */
function resolveFallbackFont(): string | null {
  const candidates: string[] = [];

  // 1) Package @vercel/og réellement installé (robuste aux changements de version).
  try {
    const req = createRequire(import.meta.url);
    let pkgDir: string | null = null;
    try {
      pkgDir = path.dirname(req.resolve("@vercel/og/package.json"));
    } catch {
      try {
        pkgDir = path.dirname(req.resolve("@vercel/og"));
      } catch {
        pkgDir = null;
      }
    }
    if (pkgDir) {
      candidates.push(path.join(pkgDir, "dist", "Geist-Regular.ttf"));
      candidates.push(path.join(pkgDir, "Geist-Regular.ttf"));
    }
  } catch {
    // createRequire indisponible (env exotique) — on passe aux chemins connus.
  }

  // 2) Bundle interne Next.js.
  candidates.push(
    path.join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"),
  );

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
          // italique : fichier dédié si dispo, sinon synthétique (fichier upright).
          { src: frauncesItalic ?? fraunces, fontStyle: "italic" as const },
          ...(frauncesBold ? [{ src: frauncesBold, fontWeight: "bold" as const }] : []),
          // bold-italic synthétique pour couvrir toutes les combinaisons.
          {
            src: frauncesBold ?? fraunces,
            fontWeight: "bold" as const,
            fontStyle: "italic" as const,
          },
        ],
      });
    } else {
      // 🔴 Bruyant EN PRODUCTION AUSSI. Ce garde-fou était tu là où il
      // comptait : le worker n'embarquait pas `public/fonts`, retombait sur
      // Geist, et sortait des attestations hors charte avec des caractères
      // PERDUS — sans une ligne de journal. Le silence a fait passer
      // quatre mois de PDF dégradés pour un fonctionnement normal.
      console.warn(
        `[qualiopi-pdf-fonts] ${QUALIOPI_BRAND_FONTS.serif} introuvable dans public/fonts/ — fallback Geist. Les PDF sortiront HORS CHARTE.`,
      );
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
          // Manrope n'a pas d'italique dédié → italique synthétique (fichier
          // upright). Les templates appliquent fontStyle:"italic" sur la famille
          // sans par défaut (legalNote, signatureLu, notes…) : sans ces variantes
          // @react-pdf throw "Could not resolve font for Manrope … italic".
          { src: manrope, fontStyle: "italic" as const },
          {
            src: manropeBold ?? manrope,
            fontWeight: "bold" as const,
            fontStyle: "italic" as const,
          },
        ],
      });
    } else {
      // 🔴 Bruyant EN PRODUCTION AUSSI. Ce garde-fou était tu là où il
      // comptait : le worker n'embarquait pas `public/fonts`, retombait sur
      // Geist, et sortait des attestations hors charte avec des caractères
      // PERDUS — sans une ligne de journal. Le silence a fait passer
      // quatre mois de PDF dégradés pour un fonctionnement normal.
      console.warn(
        `[qualiopi-pdf-fonts] ${QUALIOPI_BRAND_FONTS.sans} introuvable dans public/fonts/ — fallback Geist. Les PDF sortiront HORS CHARTE.`,
      );
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
          // Inconsolata sans italique dédié → italique synthétique (upright).
          { src: inconsolata, fontStyle: "italic" as const },
          {
            src: inconsolataBold ?? inconsolata,
            fontWeight: "bold" as const,
            fontStyle: "italic" as const,
          },
        ],
      });
    } else {
      // 🔴 Bruyant EN PRODUCTION AUSSI. Ce garde-fou était tu là où il
      // comptait : le worker n'embarquait pas `public/fonts`, retombait sur
      // Geist, et sortait des attestations hors charte avec des caractères
      // PERDUS — sans une ligne de journal. Le silence a fait passer
      // quatre mois de PDF dégradés pour un fonctionnement normal.
      console.warn(
        `[qualiopi-pdf-fonts] ${QUALIOPI_BRAND_FONTS.mono} introuvable dans public/fonts/ — fallback Geist. Les PDF sortiront HORS CHARTE.`,
      );
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
