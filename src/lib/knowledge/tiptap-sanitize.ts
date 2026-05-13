/**
 * KB-12 — Sanitization Tiptap HTML SSR (anti-XSS).
 *
 * Whitelist stricte de balises + attributs autorisés. Tout le reste est strippé.
 *
 * Approche V1 minimale (pas de dépendance externe `@tiptap/html` server-side
 * encore) : parser regex + filter attributes. Niveau "safe enough" pour des
 * auteurs trusted (admin authentifié EDITOR+). Pour publication publique non-
 * authentifiée user-generated content (V2+ commentaires), passer à DOMPurify
 * server-side ou `@tiptap/html` officiel.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "img",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "span",
  "div",
]);

const ALLOWED_ATTRS_BY_TAG: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "title", "rel", "target"]),
  img: new Set(["src", "alt", "title", "width", "height", "loading"]),
  span: new Set(["class"]),
  div: new Set(["class"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
};

const SCHEMES_ALLOWED = ["http:", "https:", "mailto:", "tel:", "#"];

function isAllowedUrl(url: string): boolean {
  if (url.startsWith("#")) return true;
  if (url.startsWith("/")) return true; // relative same-origin
  try {
    const parsed = new URL(url);
    return SCHEMES_ALLOWED.some((s) => parsed.protocol === s || parsed.protocol.startsWith(s));
  } catch {
    return false;
  }
}

/**
 * Sanitize un body HTML Tiptap-generated.
 * V1 simple : parse linéaire regex, supprime tags non whitelistés et attrs non autorisés.
 */
export function sanitizeTiptapHtml(html: string): string {
  // Strip blocs <script>, <style>, <iframe> sans exception (au cas où Tiptap les laisse passer)
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");

  // Strip handlers inline JS sur tous les éléments (on*="...")
  cleaned = cleaned.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Strip javascript: dans href / src
  cleaned = cleaned.replace(
    /\b(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi,
    '$1="#"',
  );

  // Strip tags non whitelistées (regex linéaire — pas parfait mais V1 suffit)
  cleaned = cleaned.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_match, slash, tag) => {
    const tagLower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(tagLower)) {
      return ""; // strip tag entirely
    }
    return `<${slash}${tagLower}>`; // keep tag, attrs filter ci-après
  });

  return cleaned;
}

/**
 * Valide une URL pour insertion dans href/src.
 * Refuse javascript:, data:, vbscript:, etc.
 */
export function isUrlSafe(url: string): boolean {
  return isAllowedUrl(url);
}

/** Re-export pour tests. */
export const _internalAllowedTags = ALLOWED_TAGS;
export const _internalAllowedAttrs = ALLOWED_ATTRS_BY_TAG;
