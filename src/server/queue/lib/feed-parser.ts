/**
 * Content Generator — Universal feed parser (Sprint S+4-E, P1-21 audit fix).
 *
 * Replaces the naïve regex parser in `content-rss-fetch-worker.ts` (V1) which
 * only supported RSS 2.0 and silently ignored Atom 1.0 feeds (Substack, Ghost,
 * Hugo blogs, GitHub releases, etc.). This module supports the 3 canonical
 * syndication formats and normalises them to a single `FeedItem` shape.
 *
 * ## Supported formats
 *
 * - **RSS 2.0** — `<rss version="2.0"><channel><item>` — RSS Advisory Board spec
 *   https://www.rssboard.org/rss-specification
 * - **Atom 1.0** — `<feed xmlns="http://www.w3.org/2005/Atom"><entry>` — RFC 4287
 *   https://datatracker.ietf.org/doc/html/rfc4287
 * - **RDF (RSS 1.0)** — `<rdf:RDF xmlns="http://purl.org/rss/1.0/"><item>` —
 *   https://web.resource.org/rss/1.0/spec
 *
 * ## Design notes
 *
 * - **SSRF-safe** : ce module ne fait AUCUN fetch réseau, il parse uniquement
 *   un XML déjà téléchargé en amont (via `ssrfSafeFetch` côté worker).
 * - **Robuste** : try/catch + fallback gracieux. XML invalide → retourne `[]`
 *   sans throw. Aucune source ne peut faire crasher le worker.
 * - **Encoding-agnostic** : `fast-xml-parser` accepte UTF-8 et Latin1 (le worker
 *   décode via `res.text()` qui respecte l'en-tête Content-Type).
 * - **HTML-safe** : le contenu HTML dans `content:encoded` / `<content>` est
 *   préservé tel quel (la sanitisation est responsabilité du generator qui
 *   utilise `isomorphic-dompurify`).
 *
 * @see _AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/13-TYPE-2-ACTUALITES-RSS.md
 */

import { XMLParser } from "fast-xml-parser";

/** Item normalisé cross-format. */
export interface FeedItem {
  /** GUID (RSS) ou id (Atom) — fallback sur link si absent. */
  readonly id: string;
  readonly title: string;
  readonly link: string;
  /** description (RSS) ou summary (Atom). */
  readonly summary: string;
  /** content:encoded (RSS) ou content (Atom). HTML brut, à sanitiser en aval. */
  readonly content?: string;
  /** pubDate (RSS) ou published (Atom). */
  readonly published?: Date;
  /** Atom only — date de dernière modification. */
  readonly updated?: Date;
  readonly author?: string;
  readonly tags?: ReadonlyArray<string>;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Preserve CDATA content (HTML in content:encoded).
  cdataPropName: "#cdata",
  // Always treat these as arrays even when a single instance is present.
  isArray: (name) => ["item", "entry", "category", "link"].includes(name),
  // Trim whitespace around text nodes.
  trimValues: true,
  // Keep namespaces stripped for portability (rss:item vs item).
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

/**
 * Parse a syndication feed XML string into normalised `FeedItem[]`.
 *
 * Detects format automatically (RSS 2.0 / Atom 1.0 / RDF) and dispatches.
 * Returns `[]` on any parse error (invalid XML, unknown root, etc.) — never
 * throws.
 */
export function parseFeed(xml: string): ReadonlyArray<FeedItem> {
  if (typeof xml !== "string" || xml.length === 0) return [];

  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }

  if (!isRecord(doc)) return [];

  // RSS 2.0 → <rss><channel><item>
  if (isRecord(doc.rss)) {
    const channel = doc.rss.channel;
    if (isRecord(channel) && Array.isArray(channel.item)) {
      return channel.item.map((it) => parseRssItem(it)).filter((it): it is FeedItem => it !== null);
    }
  }

  // Atom 1.0 → <feed><entry>
  if (isRecord(doc.feed) && Array.isArray(doc.feed.entry)) {
    return doc.feed.entry
      .map((it) => parseAtomEntry(it))
      .filter((it): it is FeedItem => it !== null);
  }

  // RDF / RSS 1.0 → <RDF><item> (siblings of channel, not nested)
  if (isRecord(doc.RDF)) {
    const items = doc.RDF.item;
    if (Array.isArray(items)) {
      return items.map((it) => parseRssItem(it)).filter((it): it is FeedItem => it !== null);
    }
  }

  return [];
}

// ─── RSS 2.0 + RDF (RSS 1.0) ────────────────────────────────────────────────

function parseRssItem(node: unknown): FeedItem | null {
  if (!isRecord(node)) return null;
  const title = textOf(node.title);
  const link = textOf(node.link);
  if (!title || !link) return null;

  const guid = textOf(node.guid) || link;
  const description = textOf(node.description);
  const contentEncoded = textOf(node["content:encoded"]) || textOf(node.encoded);
  const pubDate = textOf(node.pubDate) || textOf(node["dc:date"]) || textOf(node.date);
  const author =
    textOf(node.author) || textOf(node["dc:creator"]) || textOf(node.creator) || undefined;
  const tags = extractCategories(node.category);
  const publishedDate = pubDate ? safeDate(pubDate) : undefined;

  return {
    id: guid,
    title,
    link,
    summary: description ?? "",
    ...(contentEncoded ? { content: contentEncoded } : {}),
    ...(publishedDate ? { published: publishedDate } : {}),
    ...(author ? { author } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };
}

// ─── Atom 1.0 ───────────────────────────────────────────────────────────────

function parseAtomEntry(node: unknown): FeedItem | null {
  if (!isRecord(node)) return null;
  const title = textOf(node.title);
  const link = extractAtomLink(node.link);
  if (!title || !link) return null;

  const id = textOf(node.id) || link;
  const summary = textOf(node.summary) ?? "";
  const content = textOf(node.content);
  const published = textOf(node.published);
  const updated = textOf(node.updated);
  const author = extractAtomAuthor(node.author);
  const tags = extractCategories(node.category);
  const publishedDate = published ? safeDate(published) : undefined;
  const updatedDate = updated ? safeDate(updated) : undefined;

  return {
    id,
    title,
    link,
    summary,
    ...(content ? { content } : {}),
    ...(publishedDate ? { published: publishedDate } : {}),
    ...(updatedDate ? { updated: updatedDate } : {}),
    ...(author ? { author } : {}),
    ...(tags.length > 0 ? { tags } : {}),
  };
}

/**
 * Atom links are <link href="..." rel="alternate"/> elements (parsed as
 * array of objects with @_href / @_rel). Pick the first `rel="alternate"`
 * (or no rel = default alternate per RFC 4287 §4.2.7.2), fall back to the
 * first link.
 */
function extractAtomLink(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  for (const l of value) {
    if (!isRecord(l)) continue;
    const rel = l["@_rel"];
    if (rel === undefined || rel === "alternate") {
      const href = l["@_href"];
      if (typeof href === "string" && href.length > 0) return href;
    }
  }
  // Fallback: first href encountered.
  for (const l of value) {
    if (isRecord(l) && typeof l["@_href"] === "string") return l["@_href"];
  }
  return "";
}

function extractAtomAuthor(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (isRecord(value)) {
    const name = textOf(value.name);
    if (name) return name;
  }
  if (Array.isArray(value) && value.length > 0) {
    return extractAtomAuthor(value[0]);
  }
  return undefined;
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function extractCategories(value: unknown): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const c of arr) {
    if (typeof c === "string" && c.trim().length > 0) {
      out.push(c.trim());
    } else if (isRecord(c)) {
      // Atom: <category term="foo"/>
      const term = c["@_term"];
      if (typeof term === "string" && term.length > 0) {
        out.push(term);
        continue;
      }
      const text = textOf(c);
      if (text) out.push(text);
    }
  }
  return out;
}

/**
 * Extract text from a fast-xml-parser node. Handles:
 * - string directly
 * - { #text: "...", #cdata: "..." } (mixed content)
 * - { #cdata: "..." } (CDATA-only)
 * - number → coerced to string
 *
 * Returns empty string if no usable text content.
 */
function textOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    // Take first textual element.
    for (const v of value) {
      const t = textOf(v);
      if (t) return t;
    }
    return "";
  }
  if (isRecord(value)) {
    const cdata = value["#cdata"];
    if (typeof cdata === "string" && cdata.trim().length > 0) return cdata.trim();
    if (Array.isArray(cdata)) {
      const joined = cdata
        .filter((c) => typeof c === "string")
        .join("")
        .trim();
      if (joined) return joined;
    }
    const text = value["#text"];
    if (typeof text === "string" && text.trim().length > 0) return text.trim();
    if (typeof text === "number") return String(text);
  }
  return "";
}

function safeDate(s: string): Date | undefined {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
