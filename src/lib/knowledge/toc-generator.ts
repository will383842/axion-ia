/**
 * KB V4 (Sprint KB-16) — Générateur Table Of Contents depuis HTML body.
 *
 * Extrait les h2/h3 (h1 réservé au titre de page) avec ID auto-slug.
 * Utilisé pour :
 *  - Sidebar TOC côté `/ressources/[type]/[slug]`
 *  - Anchor links auto-scroll
 *  - JSON-LD `Article.hasPart` (V2)
 */

import { slugify } from "@/lib/slug";

export interface TocEntry {
  readonly level: 2 | 3;
  readonly id: string;
  readonly title: string;
}

const HEADING_REGEX = /<h([23])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;

/**
 * Génère un slug depuis le texte d'un titre.
 * Identique à slugify(title) côté KB pour cohérence.
 */
function slugifyHeading(text: string): string {
  return slugify(text, { stripHtml: true, maxLen: 80 });
}

/**
 * Extrait la TOC d'un HTML Tiptap. Retourne array ordonnée H2/H3.
 */
export function generateToc(html: string): readonly TocEntry[] {
  if (!html || html.trim().length === 0) return [];
  const entries: TocEntry[] = [];
  for (const m of html.matchAll(HEADING_REGEX)) {
    const level = parseInt(m[1]!, 10) as 2 | 3;
    const rawTitle = m[2]!.replace(/<[^>]+>/g, "").trim();
    if (!rawTitle) continue;
    const id = slugifyHeading(rawTitle);
    if (id.length === 0) continue;
    entries.push({ level, id, title: rawTitle });
  }
  return entries;
}

/**
 * Injecte des `id` sur les h2/h3 d'un HTML pour permettre les anchor links.
 * Idempotent : ne réécrit pas un id existant.
 */
export function injectHeadingIds(html: string): string {
  if (!html) return html;
  return html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_match, level, attrs, inner) => {
    const text = String(inner)
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!text) return _match;
    if (/\bid=/.test(attrs)) return _match;
    const id = slugifyHeading(text);
    return `<h${level} id="${id}"${attrs}>${inner}</h${level}>`;
  });
}
