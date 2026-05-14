/**
 * Content Generator — URL extractor (Sprint 11.5 V2).
 *
 * Fetch une URL externe et extrait le contenu éditorial principal (article).
 * Stratégie sans dépendance externe (pas de @mozilla/readability + jsdom qui
 * pèse ~600 KB) :
 *   1. fetch URL avec timeout 8s + User-Agent identifié Axion-IA
 *   2. Strip <script>, <style>, <noscript>, <iframe>, <svg>
 *   3. Préfère le contenu de <main>, <article>, <[role=main]> si présent
 *   4. Sinon body entier minus chrome (<nav>, <header>, <footer>, <aside>)
 *   5. Extract <title>, <meta name="description">, premier <h1>
 *
 * Pour 90 % des sites WordPress / Ghost / Webflow, cette stratégie suffit.
 * Cas pathologiques (SPA full JS) → Readability + jsdom Sprint 11.6.
 */

const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = "Mozilla/5.0 (compatible; Axion-IA-KB-Ingest/1.0; +https://axion-ia.com/bot)";
const MAX_BYTES = 2_000_000; // 2 MB max — évite OOM sur pages géantes

export interface ExtractedArticle {
  readonly url: string;
  readonly title: string;
  readonly description: string | null;
  readonly h1: string | null;
  readonly bodyText: string;
  readonly wordCount: number;
  /** Domaine de l'URL — utilisé comme tag KB. */
  readonly domain: string;
}

function stripTags(html: string, tags: ReadonlyArray<string>): string {
  let out = html;
  for (const tag of tags) {
    const re = new RegExp(`<${tag}[\\s\\S]*?</${tag}>`, "gi");
    out = out.replace(re, " ");
  }
  return out;
}

function extractTagContent(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = html.match(re);
  return m && m[1] ? m[1].trim() : null;
}

function extractMetaContent(html: string, name: string): string | null {
  const re = new RegExp(`<meta\\s+[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  if (m && m[1]) return m[1].trim();
  // Reverse order : content="..." name="..."
  const re2 = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, "i");
  const m2 = html.match(re2);
  return m2 && m2[1] ? m2[1].trim() : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMainContent(html: string): string {
  // Try <main>...</main> first
  const main = extractTagContent(html, "main");
  if (main && main.length > 500) return main;
  // Try <article>
  const article = extractTagContent(html, "article");
  if (article && article.length > 500) return article;
  // Fallback body sans chrome
  const body = extractTagContent(html, "body") ?? html;
  return stripTags(body, ["nav", "header", "footer", "aside", "form"]);
}

export async function extractArticleFromUrl(url: string): Promise<ExtractedArticle | null> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!resp.ok) return null;

    const contentType = resp.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return null;

    const contentLength = Number(resp.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BYTES) return null;

    const html = await resp.text();
    if (html.length > MAX_BYTES) return null;

    // Strip non-editorial tags
    const cleaned = stripTags(html, ["script", "style", "noscript", "iframe", "svg"]);

    const titleRaw = extractTagContent(cleaned, "title");
    const title = titleRaw ? htmlToText(titleRaw) : parsedUrl.hostname;

    const description = extractMetaContent(cleaned, "description");

    const h1Raw = extractTagContent(cleaned, "h1");
    const h1 = h1Raw ? htmlToText(h1Raw) : null;

    const mainHtml = pickMainContent(cleaned);
    const bodyText = htmlToText(mainHtml);
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;

    if (wordCount < 100) return null; // page trop pauvre, skip

    return {
      url,
      title,
      description: description ? htmlToText(description) : null,
      h1,
      bodyText,
      wordCount,
      domain: parsedUrl.hostname,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
