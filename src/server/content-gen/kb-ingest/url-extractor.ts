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
 *
 * Méta-cert 2026-05-15 AGENT 12 P0 OWASP A10 — SSRF mitigation : passage
 * de `fetch()` natif à `ssrfSafeFetch()` qui :
 *   - Refuse les IP privées RFC 1918 / loopback / metadata cloud (169.254/16)
 *   - Resolve le DNS avant chaque hop et valide chaque redirect
 *   - Cap profondeur redirects (5)
 * Cf. `src/lib/ssrf-safe-fetch.ts`. L'input URL provient de l'admin
 * KB ingest qui est trusted, mais le helper protège contre erreurs Will +
 * abus futurs si endpoint exposé public.
 *
 * City Domination 2026-05-18 P0-12 — A13 audit : ajout du respect des
 * directives `robots.txt` Disallow/Crawl-Delay et `ai.txt` opt-out des sources
 * externes avant chaque fetch. Réduit risque légal + bloc IP + pénalité Spam
 * Brain Google sur notre IP Hetzner CPX42.
 * Cf. `robots-respect.ts`.
 */

import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import { checkUrlAllowed } from "./robots-respect";

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

  // P0-12 (2026-05-18) — Respect robots.txt / ai.txt avant fetch.
  // En cas d'erreur réseau sur le fetch robots.txt, `checkUrlAllowed` retombe
  // sur "allowed: true" (cf. fetchTextSoft swallow + EMPTY_RULES) — fail-soft.
  const robotsCheck = await checkUrlAllowed(url);
  if (!robotsCheck.allowed) {
    return null;
  }
  // Si Crawl-Delay est défini, on respecte le delay avant le fetch éditorial.
  // Le cache 10 min de getRobotsRules évite qu'un sitemap de 50K URLs n'introduit
  // 50K × delay_total — chaque appel de checkUrlAllowed ne lit le delay qu'une fois.
  if (robotsCheck.crawlDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, robotsCheck.crawlDelayMs));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await ssrfSafeFetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
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
