/**
 * KB-10 — Validation alt text bloquante avant publication.
 *
 * Scrape le body HTML d'une translation pour détecter les <img> sans alt
 * (ou alt vide). Si trouvé, la publication est REFUSÉE (sauf override admin).
 *
 * Critère WCAG 2.2 AA 1.1.1 Non-text Content (level A).
 */

export interface AltTextValidationResult {
  readonly valid: boolean;
  readonly imagesWithoutAlt: number;
  readonly totalImages: number;
  readonly violations: readonly { readonly src: string; readonly index: number }[];
}

const IMG_REGEX = /<img\s+([^>]+)>/gi;
const ALT_ATTR_REGEX = /\balt\s*=\s*(["'])([^"']*)\1/i;
const SRC_ATTR_REGEX = /\bsrc\s*=\s*(["'])([^"']*)\1/i;

/**
 * Valide le alt text des images dans un body HTML.
 * Retourne `valid: true` si toutes les <img> ont un alt non vide.
 */
export function validateAltText(bodyHtml: string): AltTextValidationResult {
  const violations: { src: string; index: number }[] = [];
  let totalImages = 0;
  let imagesWithoutAlt = 0;

  let match: RegExpExecArray | null;
  let index = 0;
  IMG_REGEX.lastIndex = 0;
  while ((match = IMG_REGEX.exec(bodyHtml)) !== null) {
    totalImages++;
    const attrs = match[1] ?? "";
    const altMatch = ALT_ATTR_REGEX.exec(attrs);
    const alt = altMatch?.[2]?.trim() ?? "";
    if (!alt) {
      imagesWithoutAlt++;
      const srcMatch = SRC_ATTR_REGEX.exec(attrs);
      violations.push({ src: srcMatch?.[2] ?? "(no src)", index });
    }
    index++;
  }

  return {
    valid: imagesWithoutAlt === 0,
    imagesWithoutAlt,
    totalImages,
    violations,
  };
}
