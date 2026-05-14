/**
 * KB V4 (Sprint KB-15) — Tests parser Markdown.
 */

import { describe, expect, it } from "vitest";
import { markdownToHtml, markdownToPlainText, parseFrontMatter } from "./markdown-import";

describe("parseFrontMatter", () => {
  it("retourne body intact si pas de front-matter", () => {
    const r = parseFrontMatter("# Titre\n\nContenu.");
    expect(r.frontMatter).toEqual({});
    expect(r.body).toBe("# Titre\n\nContenu.");
  });

  it("parse clés/valeurs simples", () => {
    const r = parseFrontMatter(`---
title: Article test
domain: ia_strategy
---

# Body`);
    expect(r.frontMatter.title).toBe("Article test");
    expect(r.frontMatter.domain).toBe("ia_strategy");
    expect(r.body).toBe("# Body");
  });

  it("trim quotes", () => {
    const r = parseFrontMatter(`---
title: "Avec espaces"
slug: 'kebab-case'
---

Body`);
    expect(r.frontMatter.title).toBe("Avec espaces");
    expect(r.frontMatter.slug).toBe("kebab-case");
  });
});

describe("markdownToHtml", () => {
  it("convertit h1/h2/h3", () => {
    const html = markdownToHtml("# H1\n## H2\n### H3");
    expect(html).toContain("<h1>H1</h1>");
    expect(html).toContain("<h2>H2</h2>");
    expect(html).toContain("<h3>H3</h3>");
  });

  it("convertit paragraphes simples", () => {
    expect(markdownToHtml("Phrase un.\n\nPhrase deux.")).toContain("<p>Phrase un.</p>");
  });

  it("convertit liste ul", () => {
    const html = markdownToHtml("- item 1\n- item 2");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item 1</li>");
    expect(html).toContain("</ul>");
  });

  it("convertit liste ol", () => {
    const html = markdownToHtml("1. premier\n2. deuxième");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>premier</li>");
  });

  it("convertit bold et italic", () => {
    const html = markdownToHtml("texte **gras** et *italique*");
    expect(html).toContain("<strong>gras</strong>");
    expect(html).toContain("<em>italique</em>");
  });

  it("convertit code inline et code block", () => {
    const html = markdownToHtml("inline `foo` puis\n```ts\nconst x = 1;\n```");
    expect(html).toContain("<code>foo</code>");
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).toContain("const x = 1;");
  });

  it("convertit liens en https", () => {
    const html = markdownToHtml("Voir [Axion-IA](https://axion-ia.com).");
    expect(html).toContain('href="https://axion-ia.com"');
  });

  it("neutralise liens javascript:", () => {
    const html = markdownToHtml("Bad [click](javascript:alert(1))");
    expect(html).toContain('href="#"');
    expect(html).not.toContain("javascript:");
  });

  it("escape HTML angles", () => {
    const html = markdownToHtml("Texte avec <script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("markdownToPlainText", () => {
  it("strip headings + listes + code", () => {
    const txt = markdownToPlainText("# Titre\n\n- item\n\n```\ncode\n```\n\nFin.");
    expect(txt).toContain("Titre");
    expect(txt).toContain("item");
    expect(txt).toContain("Fin");
    expect(txt).not.toContain("```");
    expect(txt).not.toContain("#");
  });

  it("strip bold/italic markers", () => {
    expect(markdownToPlainText("**fort** et *léger*")).toBe("fort et léger");
  });

  it("strip front-matter", () => {
    const txt = markdownToPlainText("---\ntitle: X\n---\n\nCorps.");
    expect(txt).toBe("Corps.");
  });
});
