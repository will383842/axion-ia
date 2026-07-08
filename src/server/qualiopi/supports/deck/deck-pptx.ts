/**
 * Qualiopi — Supports : rendu PowerPoint (.pptx) ÉDITABLE du diaporama.
 *
 * Utilise `pptxgenjs` (import DYNAMIQUE + fail-soft : si la lib n'est pas
 * installée localement — worktree à node_modules jonctionné — la fonction
 * retourne null et seul le PDF est produit ; en prod la lib est installée par le
 * build Docker). Format 16:9, design aligné charte, NOTES ORATEUR par slide
 * (le formateur les voit en mode présentateur ; jamais projetées).
 *
 * Les corrigés et bonnes réponses sont déjà cantonnés aux notes par le builder.
 */

import { QUALIOPI_BRAND_COLORS as C } from "@/server/qualiopi/brand/brand-tokens";
import type { DeckModel, Slide } from "./deck-model";

// ── Interface minimale de pptxgenjs (typée localement, cf. import dynamique) ──
type PptxTextOpts = Record<string, unknown>;
interface PptxSlide {
  background?: { color: string };
  addText(text: unknown, opts: PptxTextOpts): void;
  addImage(opts: Record<string, unknown>): void;
  addNotes(notes: string): void;
}
interface PptxInstance {
  defineLayout(opts: { name: string; width: number; height: number }): void;
  layout: string;
  author: string;
  company: string;
  title: string;
  addSlide(): PptxSlide;
  write(opts: { outputType: string }): Promise<unknown>;
}

/** Retire le '#' (pptxgenjs veut des hex sans dièse). */
const hex = (c: string): string => c.replace("#", "");

function isDark(kind: Slide["kind"]): boolean {
  return kind === "cover" || kind === "section" || kind === "closing";
}

function slideBg(kind: Slide["kind"]): string {
  switch (kind) {
    case "cover":
    case "closing":
      return hex(C.mocha);
    case "section":
      return hex(C.primary);
    case "quiz":
      return hex(C.sand);
    case "synthese":
      return hex(C["terracotta-soft"]);
    default:
      return hex(C.paper);
  }
}

/**
 * Génère le .pptx du deck. Retourne un Buffer, ou null si pptxgenjs indisponible.
 * @param images data URI PNG par clé (cover/section) — optionnel.
 */
export async function renderDeckPptx(
  deck: DeckModel,
  images?: Record<string, string>,
): Promise<Buffer | null> {
  // Import via spécifieur NON littéral : TypeScript ne résout pas statiquement le
  // module (absent localement via la jonction node_modules) → pas d'erreur tsc ;
  // en prod la lib est installée (lockfile) et l'import réussit. Fail-soft sinon.
  let PptxGenJS: new () => PptxInstance;
  try {
    const spec = "pptxgenjs";
    const mod = (await import(spec)) as { default: new () => PptxInstance };
    PptxGenJS = mod.default;
  } catch {
    return null; // lib absente (dev local) → fail-soft, PDF seul
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "AXION_16x9", width: 10, height: 5.625 });
  pptx.layout = "AXION_16x9";
  pptx.author = "Axion-IA";
  pptx.company = "Axion-IA";
  pptx.title = deck.titreFormation;

  for (const slide of deck.slides) {
    const sl = pptx.addSlide();
    const dark = isDark(slide.kind);
    sl.background = { color: slideBg(slide.kind) };
    const textColor = dark ? hex(C.paper) : hex(C.fg);
    const titleColor = dark ? hex(C.paper) : hex(C.mocha);

    if (slide.kind === "section" && images?.section) {
      sl.addImage({ data: images.section, x: 6.0, y: 0, w: 4.0, h: 5.625 });
    }

    if (slide.eyebrow) {
      sl.addText(slide.eyebrow.toUpperCase(), {
        x: 0.6,
        y: 0.5,
        w: 8.5,
        h: 0.4,
        fontSize: 12,
        bold: true,
        color: dark ? hex(C["mocha-fg"]) : hex(C.terracotta),
        charSpacing: 2,
      });
    }

    sl.addText(slide.titre, {
      x: 0.6,
      y: slide.kind === "cover" ? 2.0 : 1.0,
      w: slide.kind === "section" && images?.section ? 5.2 : 8.8,
      h: 1.4,
      fontSize: slide.kind === "cover" ? 40 : 30,
      bold: true,
      fontFace: "Georgia",
      color: titleColor,
    });

    if (slide.puces && slide.puces.length > 0) {
      const isQuiz = slide.kind === "quiz";
      sl.addText(
        slide.puces.map((p) => ({
          text: p,
          options: { bullet: !isQuiz, fontSize: 18, color: textColor, breakLine: true },
        })),
        { x: 0.7, y: 2.4, w: 8.6, h: 2.6, valign: "top", lineSpacingMultiple: 1.3 },
      );
    }

    if (slide.notes && slide.notes.trim()) {
      sl.addNotes(slide.notes);
    }
  }

  const data = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return data;
}
