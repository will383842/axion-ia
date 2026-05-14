import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractArticleFromUrl } from "../url-extractor";

function mockFetch(html: string, status = 200, contentType = "text/html; charset=utf-8") {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ "content-type": contentType }),
      text: () => Promise.resolve(html),
    } as unknown as Response),
  );
}

describe("extractArticleFromUrl", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns null for invalid URL", async () => {
    expect(await extractArticleFromUrl("not-a-url")).toBeNull();
  });

  it("returns null for non-http(s) URL", async () => {
    expect(await extractArticleFromUrl("ftp://example.com")).toBeNull();
  });

  it("extracts title + description + h1 + body from a simple HTML page", async () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Mon article test</title>
      <meta name="description" content="Description courte de cet article.">
    </head><body>
      <nav>Skip me</nav>
      <main>
        <h1>Titre principal H1</h1>
        <p>${"Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(20)}</p>
      </main>
      <footer>Skip me too</footer>
    </body></html>`;
    globalThis.fetch = mockFetch(html);

    const result = await extractArticleFromUrl("https://example.com/article");
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Mon article test");
    expect(result?.description).toBe("Description courte de cet article.");
    expect(result?.h1).toBe("Titre principal H1");
    expect(result?.domain).toBe("example.com");
    expect(result?.wordCount).toBeGreaterThan(100);
    expect(result?.bodyText).not.toContain("Skip me");
  });

  it("falls back to <article> tag if <main> absent", async () => {
    const html = `<html><head><title>T</title></head><body>
      <article><h1>H</h1>${"<p>word </p>".repeat(150)}</article>
    </body></html>`;
    globalThis.fetch = mockFetch(html);
    const result = await extractArticleFromUrl("https://example.com/x");
    expect(result?.wordCount).toBeGreaterThan(100);
  });

  it("returns null when fetch returns 404", async () => {
    globalThis.fetch = mockFetch("not found", 404);
    expect(await extractArticleFromUrl("https://example.com/404")).toBeNull();
  });

  it("returns null when content-type is not HTML", async () => {
    globalThis.fetch = mockFetch("{}", 200, "application/json");
    expect(await extractArticleFromUrl("https://example.com/api")).toBeNull();
  });

  it("returns null when wordCount < 100 (thin page)", async () => {
    const html = `<html><body><main><h1>X</h1><p>too short</p></main></body></html>`;
    globalThis.fetch = mockFetch(html);
    expect(await extractArticleFromUrl("https://example.com/thin")).toBeNull();
  });

  it("strips script and style tags", async () => {
    const html = `<html><head><title>T</title></head><body>
      <script>alert("xss")</script>
      <style>.x { color: red; }</style>
      <main><h1>Safe</h1>${"<p>word </p>".repeat(150)}</main>
    </body></html>`;
    globalThis.fetch = mockFetch(html);
    const result = await extractArticleFromUrl("https://example.com/x");
    expect(result?.bodyText).not.toContain("alert");
    expect(result?.bodyText).not.toContain("color: red");
  });

  it("handles HTML entities correctly", async () => {
    const html = `<html><head><title>Caf&eacute; &amp; cr&egrave;me</title></head><body>
      <main><h1>D&eacute;tails</h1>${"<p>café </p>".repeat(150)}</main>
    </body></html>`;
    globalThis.fetch = mockFetch(html);
    const result = await extractArticleFromUrl("https://example.com/cafe");
    expect(result?.title).toContain("&");
  });

  it("returns null on fetch error (network)", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("Network error"))) as never;
    expect(await extractArticleFromUrl("https://example.com/down")).toBeNull();
  });
});
