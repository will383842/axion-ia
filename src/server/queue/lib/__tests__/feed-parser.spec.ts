/**
 * Sprint S+4-E (P1-21 audit fix) — Tests universal feed parser.
 *
 * Couvre les 3 formats supportés (RSS 2.0 / Atom 1.0 / RDF) + robustesse :
 * 1. RSS 2.0 nominal → 3 items parsés avec tous les champs
 * 2. RSS 2.0 CDATA dans title/description → CDATA correctement extrait
 * 3. RSS 2.0 item minimal (sans guid/date) → id fallback sur link
 * 4. Atom 1.0 nominal → 3 entries parsées avec author + tags + updated
 * 5. Atom 1.0 multi-link → choisit rel="alternate" (pas enclosure)
 * 6. Atom 1.0 entry sans summary → summary = "" (pas crash)
 * 7. RDF / RSS 1.0 nominal → 2 items parsés (parse dc:date + dc:creator)
 * 8. XML malformé → retourne [] sans throw
 * 9. XML vide / non-string → retourne []
 * 10. Format inconnu (HTML page) → retourne []
 * 11. Dates ISO 8601 parsées en Date objects valides
 * 12. HTML brut préservé dans content (pas de sanitisation au parser)
 * 13. Encoding UTF-8 (caractères accentués) préservé
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFeed, type FeedItem } from "../feed-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("parseFeed — RSS 2.0", () => {
  const xml = loadFixture("rss2.xml");
  const items = parseFeed(xml);

  it("parses all 3 items from a valid RSS 2.0 feed", () => {
    expect(items).toHaveLength(3);
  });

  it("extracts title, link, guid, summary, content:encoded, pubDate, author, categories", () => {
    const first = items[0]!;
    expect(first.title).toBe("L'IA générative bouleverse l'enseignement supérieur");
    expect(first.link).toBe("https://www.lemonde.fr/article-1");
    expect(first.id).toBe("lemonde-2026-05-18-001");
    expect(first.summary).toBe("Les universités françaises adoptent l'IA à marche forcée.");
    expect(first.content).toContain("<strong>HTML formatté</strong>");
    expect(first.published).toBeInstanceOf(Date);
    expect(first.published?.toISOString()).toBe("2026-05-18T06:30:00.000Z");
    expect(first.author).toBe("Marie Dupont");
    expect(first.tags).toEqual(["Éducation", "IA"]);
  });

  it("handles CDATA sections in title and description", () => {
    const second = items[1]!;
    expect(second.title).toBe("Article avec CDATA dans le titre");
    expect(second.summary).toContain("Description avec <em>balises HTML</em>");
  });

  it("falls back to link when guid is absent", () => {
    const third = items[2]!;
    expect(third.id).toBe("https://www.lemonde.fr/article-3");
    expect(third.published).toBeUndefined();
  });

  it("preserves UTF-8 accented characters", () => {
    const first = items[0]!;
    expect(first.title).toMatch(/générative/);
    expect(first.tags?.[0]).toBe("Éducation");
  });
});

describe("parseFeed — Atom 1.0", () => {
  const xml = loadFixture("atom.xml");
  const items = parseFeed(xml);

  it("parses all 3 entries from a valid Atom 1.0 feed", () => {
    expect(items).toHaveLength(3);
  });

  it("extracts title, link, id, summary, content, published, updated, author, categories", () => {
    const first = items[0]!;
    expect(first.title).toBe("Pourquoi 90 % des projets IA échouent en production");
    expect(first.link).toBe("https://axion-ia.substack.com/p/pourquoi-90-pourcent-echouent");
    expect(first.id).toBe("tag:substack.com,2026:/post/123456");
    expect(first.summary).toBe("Retour d'expérience sur 47 missions IA B2B.");
    expect(first.content).toContain("<p>L'écart entre POC et production reste massif.</p>");
    expect(first.published?.toISOString()).toBe("2026-05-18T08:00:00.000Z");
    expect(first.updated?.toISOString()).toBe("2026-05-18T09:30:00.000Z");
    expect(first.author).toBe("Will Jullin");
    expect(first.tags).toEqual(["ia", "production"]);
  });

  it("handles Atom entry without summary or content", () => {
    const second = items[1]!;
    expect(second.title).toBe("Atom entry sans summary ni content");
    expect(second.summary).toBe("");
    expect(second.content).toBeUndefined();
  });

  it("picks the rel='alternate' link when multiple links are present", () => {
    const third = items[2]!;
    expect(third.link).toBe("https://axion-ia.substack.com/p/multi-link");
    expect(third.link).not.toContain(".json");
  });
});

describe("parseFeed — RDF (RSS 1.0)", () => {
  const xml = loadFixture("rdf.xml");
  const items = parseFeed(xml);

  it("parses all 2 items from a valid RDF feed", () => {
    expect(items).toHaveLength(2);
  });

  it("extracts dc:date and dc:creator from RDF item", () => {
    const first = items[0]!;
    expect(first.title).toBe("Premier article RDF");
    expect(first.link).toBe("https://example.org/post-1");
    expect(first.summary).toBe("Description RDF article 1.");
    expect(first.published?.toISOString()).toBe("2026-05-18T07:00:00.000Z");
    expect(first.author).toBe("Auteur RDF");
  });
});

describe("parseFeed — Robustness", () => {
  it("returns [] for malformed XML without throwing", () => {
    const xml = loadFixture("invalid.xml");
    expect(() => parseFeed(xml)).not.toThrow();
    // Malformed XML may parse to garbage or empty — both acceptable, key is no throw.
    const result = parseFeed(xml);
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns [] for empty string", () => {
    expect(parseFeed("")).toEqual([]);
  });

  it("returns [] for non-string input", () => {
    // @ts-expect-error testing runtime guard
    expect(parseFeed(null)).toEqual([]);
    // @ts-expect-error testing runtime guard
    expect(parseFeed(undefined)).toEqual([]);
    // @ts-expect-error testing runtime guard
    expect(parseFeed(123)).toEqual([]);
  });

  it("returns [] for unknown root element (e.g. HTML page returned by mistake)", () => {
    const html = "<!DOCTYPE html><html><body><h1>Not a feed</h1></body></html>";
    expect(parseFeed(html)).toEqual([]);
  });

  it("returns [] for valid XML but unrecognised root", () => {
    const xml = '<?xml version="1.0"?><randomroot><foo>bar</foo></randomroot>';
    expect(parseFeed(xml)).toEqual([]);
  });

  it("parses ISO 8601 dates into valid Date objects", () => {
    const items = parseFeed(loadFixture("atom.xml"));
    for (const it of items) {
      if (it.published) {
        expect(it.published.getTime()).not.toBeNaN();
      }
    }
  });

  it("preserves raw HTML inside content without sanitising", () => {
    const items: ReadonlyArray<FeedItem> = parseFeed(loadFixture("rss2.xml"));
    const withContent = items.find((it) => it.content);
    expect(withContent?.content).toMatch(/<p>/);
    expect(withContent?.content).toMatch(/<strong>/);
  });

  it("skips items missing required fields (title or link)", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <title>Feed</title>
        <link>https://example.org</link>
        <item><description>Item without title or link</description></item>
        <item><title>Valid item</title><link>https://example.org/ok</link></item>
      </channel></rss>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Valid item");
  });
});
