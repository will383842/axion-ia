/**
 * Helper de test — filet de sécurité polices PDF Qualiopi.
 *
 * Garantit que les familles de marque (Fraunces / Manrope / Inconsolata) sont
 * enregistrées pour @react-pdf/renderer même si TOUT échoue côté assets :
 *   - les .ttf de marque sont absents de public/fonts/, ET
 *   - le fallback Geist (node_modules) est introuvable.
 *
 * Les variantes sont mappées sur les polices built-in de @react-pdf
 * (Times / Helvetica / Courier) qui ne nécessitent aucun fichier disque, en
 * couvrant les 4 combinaisons (normal/bold × normal/italic) — les templates
 * appliquent `fontStyle:"italic"` sur la famille sans par défaut.
 *
 * ⚠️ FALLBACK UNIQUEMENT : si une famille est DÉJÀ enregistrée (vraies polices
 * via `registerQualiopiPdfFonts()`, ou fallback Geist), on NE l'écrase PAS.
 * Sinon les specs ne testeraient plus jamais le vrai rendu de marque et
 * re-masqueraient les bugs de variantes (cf. italique Manrope absent du chemin
 * réel, découvert en ajoutant les vraies polices). À appeler dans un `beforeAll`.
 */
import { Font } from "@react-pdf/renderer";
import { QUALIOPI_BRAND_FONTS } from "@/server/qualiopi/brand/brand-tokens";

/** True si la famille a déjà été enregistrée auprès de @react-pdf. */
function isRegistered(family: string): boolean {
  try {
    const families = (
      Font as unknown as { getRegisteredFontFamilies?: () => string[] }
    ).getRegisteredFontFamilies?.();
    return Array.isArray(families) ? families.includes(family) : false;
  } catch {
    return false;
  }
}

/**
 * Enregistre un filet built-in pour les 3 familles de marque si — et seulement
 * si — elles ne sont pas déjà enregistrées. Idempotent et fail-safe.
 */
export function registerPdfTestFontsFallback(): void {
  if (!isRegistered(QUALIOPI_BRAND_FONTS.serif)) {
    try {
      Font.register({
        family: QUALIOPI_BRAND_FONTS.serif,
        fonts: [
          { src: "Times-Roman", fontWeight: "normal", fontStyle: "normal" },
          { src: "Times-Bold", fontWeight: "bold", fontStyle: "normal" },
          { src: "Times-Italic", fontWeight: "normal", fontStyle: "italic" },
          { src: "Times-BoldItalic", fontWeight: "bold", fontStyle: "italic" },
        ],
      });
    } catch {
      /* ignoré */
    }
  }

  if (!isRegistered(QUALIOPI_BRAND_FONTS.sans)) {
    try {
      Font.register({
        family: QUALIOPI_BRAND_FONTS.sans,
        fonts: [
          { src: "Helvetica", fontWeight: "normal", fontStyle: "normal" },
          { src: "Helvetica-Bold", fontWeight: "bold", fontStyle: "normal" },
          { src: "Helvetica-Oblique", fontWeight: "normal", fontStyle: "italic" },
          { src: "Helvetica-BoldOblique", fontWeight: "bold", fontStyle: "italic" },
        ],
      });
    } catch {
      /* ignoré */
    }
  }

  if (!isRegistered(QUALIOPI_BRAND_FONTS.mono)) {
    try {
      Font.register({
        family: QUALIOPI_BRAND_FONTS.mono,
        fonts: [
          { src: "Courier", fontWeight: "normal", fontStyle: "normal" },
          { src: "Courier-Bold", fontWeight: "bold", fontStyle: "normal" },
          { src: "Courier-Oblique", fontWeight: "normal", fontStyle: "italic" },
          { src: "Courier-BoldOblique", fontWeight: "bold", fontStyle: "italic" },
        ],
      });
    } catch {
      /* ignoré */
    }
  }
}
