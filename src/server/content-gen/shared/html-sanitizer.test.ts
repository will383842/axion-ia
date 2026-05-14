/**
 * Tests sanitizer HTML output LLM (Pass B fix P0-5).
 *
 * Vérifie qu'un attaquant ne peut pas injecter de XSS persistant via
 * le pipeline LLM → DB → render dangerouslySetInnerHTML.
 */

import { describe, it, expect } from "vitest";
import { sanitizeContentGenHtml } from "./html-sanitizer";

describe("sanitizeContentGenHtml — anti-XSS LLM output", () => {
  it("strippe <script>", () => {
    const dirty = '<p>Texte légitime <script>alert("xss")</script> suite</p>';
    const clean = sanitizeContentGenHtml(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("alert");
    expect(clean).toContain("Texte légitime");
  });

  it("strippe <iframe>", () => {
    const dirty = '<p>OK</p><iframe src="https://evil.com"></iframe>';
    const clean = sanitizeContentGenHtml(dirty);
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("evil.com");
  });

  it("strippe event handlers onerror/onclick/onload", () => {
    const dirty = '<img src="x" onerror="alert(1)" /><p onclick="bad()">text</p>';
    const clean = sanitizeContentGenHtml(dirty);
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("alert(1)");
  });

  it("strippe javascript: URI", () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const clean = sanitizeContentGenHtml(dirty);
    expect(clean).not.toContain("javascript:");
  });

  it("strippe data:text/html URI", () => {
    const dirty = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
    const clean = sanitizeContentGenHtml(dirty);
    expect(clean).not.toContain("data:text/html");
  });

  it("strippe <svg onload=>", () => {
    const dirty = '<svg onload="alert(1)"><circle r="5"/></svg>';
    const clean = sanitizeContentGenHtml(dirty);
    // svg n'est pas whitelisté → tag entier strippé
    expect(clean).not.toContain("<svg");
    expect(clean).not.toContain("onload");
  });

  it("strippe <object> et <embed>", () => {
    const dirty = '<object data="evil.swf"></object><embed src="bad.swf"/>';
    const clean = sanitizeContentGenHtml(dirty);
    expect(clean).not.toContain("<object");
    expect(clean).not.toContain("<embed");
  });

  it("strippe style attribute (CSS injection)", () => {
    const dirty = '<p style="background:url(javascript:alert(1))">x</p>';
    const clean = sanitizeContentGenHtml(dirty);
    expect(clean).not.toContain("style=");
    expect(clean).not.toContain("javascript:");
  });

  it("conserve les tags éditoriaux légitimes (whitelist)", () => {
    const html =
      "<h2>Titre</h2><p>Para <strong>strong</strong> <em>em</em></p><ul><li>item</li></ul>";
    const clean = sanitizeContentGenHtml(html);
    expect(clean).toContain("<h2");
    expect(clean).toContain("<p");
    expect(clean).toContain("<strong");
    expect(clean).toContain("<em");
    expect(clean).toContain("<ul");
    expect(clean).toContain("<li");
  });

  it("conserve les classes éditoriales Speakable (.faq-answer, data-aeo)", () => {
    const html = '<div class="faq-answer" data-aeo="answer">La réponse Axion-IA</div>';
    const clean = sanitizeContentGenHtml(html);
    // div n'est pas dans la whitelist → strippé. C'est OK : les pages FAQ
    // doivent utiliser <article> ou <section> avec class+data-attr.
    expect(clean).not.toContain("<div");
    const html2 = '<section class="faq-answer" data-aeo="answer">La réponse Axion-IA</section>';
    const clean2 = sanitizeContentGenHtml(html2);
    expect(clean2).toContain("faq-answer");
    expect(clean2).toContain('data-aeo="answer"');
    expect(clean2).toContain("La réponse Axion-IA");
  });

  it("sécurise <a target='_blank'> (rel noopener OU target strippé)", () => {
    const html = '<a href="https://example.com" target="_blank">link</a>';
    const clean = sanitizeContentGenHtml(html);
    // DOMPurify peut strippe target="_blank" (sécurisé d'office) OU le
    // conserver. Dans le 2e cas, notre post-process force rel="noopener
    // noreferrer". Les deux comportements sont safe — l'important est que
    // si target=_blank survit, rel est présent.
    if (clean.includes('target="_blank"')) {
      expect(clean).toContain("noopener");
      expect(clean).toContain("noreferrer");
    } else {
      expect(clean).not.toContain('target="_blank"');
    }
  });

  it("retourne string vide si input non-string", () => {
    // @ts-expect-error — test intentionnel : runtime input non-string
    expect(sanitizeContentGenHtml(null)).toBe("");
    // @ts-expect-error — test intentionnel : runtime input non-string
    expect(sanitizeContentGenHtml(undefined)).toBe("");
    // @ts-expect-error — test intentionnel : runtime input non-string
    expect(sanitizeContentGenHtml(123)).toBe("");
  });

  it("conserve les liens internes /interventions/...", () => {
    const html = '<a href="/fr/interventions/essentielle">CTA</a>';
    const clean = sanitizeContentGenHtml(html);
    expect(clean).toContain('href="/fr/interventions/essentielle"');
  });

  it("conserve les images avec alt + dimensions (loading optionnel)", () => {
    const html =
      '<img src="https://images.unsplash.com/foo.jpg" alt="Bureau Paris" loading="lazy" width="800" height="600" />';
    const clean = sanitizeContentGenHtml(html);
    expect(clean).toContain("<img");
    expect(clean).toContain('alt="Bureau Paris"');
    // `loading="lazy"` peut être strippé par DOMPurify selon version
    // (acceptable — c'est un attr de performance, pas de sécurité). Les
    // appelants peuvent re-injecter `loading="lazy"` via Next/Image côté
    // render si nécessaire.
  });
});
