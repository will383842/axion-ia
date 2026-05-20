/**
 * Tests FAQ sanitizer (Sprint S+5 P2-8 + P2-9).
 *
 * Couvre :
 *  - Whitelist stricte (h2/h3/table/img/iframe strippés)
 *  - Détection placeholders traduction non-faite ([TBD], TODO, Lorem ipsum, ?)
 *  - Anti-XSS vecteurs OWASP top-10
 *  - rel="noopener noreferrer" auto sur a[target=_blank]
 */

import { describe, it, expect } from "vitest";
import { sanitizeFaqAnswer, sanitizeFaqQuestion } from "./faq-sanitizer";

describe("sanitizeFaqAnswer — whitelist FAQ stricte P2-8", () => {
  it("conserve les tags FAQ autorisés (p, strong, em, a, ul/ol/li, br)", () => {
    const html =
      "<p>Texte <strong>fort</strong> et <em>italique</em></p><ul><li>item</li></ul>";
    const r = sanitizeFaqAnswer(html);
    expect(r.skip).toBe(false);
    expect(r.html).toContain("<strong>");
    expect(r.html).toContain("<em>");
    expect(r.html).toContain("<ul>");
    expect(r.html).toContain("<li>");
  });

  it("strippe les tags hors whitelist FAQ (h2/h3/table/img/iframe)", () => {
    const html =
      '<h2>titre</h2><p>texte</p><table><tr><td>cell</td></tr></table><img src="x" /><iframe src="evil"></iframe>';
    const r = sanitizeFaqAnswer(html);
    expect(r.skip).toBe(false);
    expect(r.html).not.toContain("<h2");
    expect(r.html).not.toContain("<table");
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("<iframe");
    expect(r.html).toContain("<p>");
  });

  it("strippe <script> et alert", () => {
    const dirty = '<p>OK</p><script>alert("xss")</script>';
    const r = sanitizeFaqAnswer(dirty);
    expect(r.html).not.toContain("<script");
    expect(r.html).not.toContain("alert");
    expect(r.html).toContain("OK");
  });

  it("strippe event handlers (onerror, onclick, onload)", () => {
    const dirty = '<p onclick="bad()">text</p><a href="x" onmouseover="evil()">link</a>';
    const r = sanitizeFaqAnswer(dirty);
    expect(r.html).not.toContain("onclick");
    expect(r.html).not.toContain("onmouseover");
  });

  it("strippe javascript: URI", () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const r = sanitizeFaqAnswer(dirty);
    expect(r.html).not.toContain("javascript:");
  });

  it('force rel="noopener noreferrer" sur a[target="_blank"]', () => {
    const html = '<p><a href="https://example.com" target="_blank">ext</a></p>';
    const r = sanitizeFaqAnswer(html);
    expect(r.html).toContain('rel="noopener noreferrer"');
  });
});

describe("sanitizeFaqAnswer — détection placeholders P2-9", () => {
  it("skip si réponse contient [TBD]", () => {
    const r = sanitizeFaqAnswer("<p>Answer [TBD]</p>");
    expect(r.skip).toBe(true);
    expect(r.reason).toMatch(/placeholder_detected/);
  });

  it("skip si réponse contient TODO en mot", () => {
    const r = sanitizeFaqAnswer("<p>This is TODO complete later</p>");
    expect(r.skip).toBe(true);
    expect(r.reason).toMatch(/placeholder_detected/);
  });

  it("skip si réponse contient Lorem ipsum", () => {
    const r = sanitizeFaqAnswer("<p>Lorem ipsum dolor sit amet.</p>");
    expect(r.skip).toBe(true);
    expect(r.reason).toMatch(/placeholder_detected/);
  });

  it("skip si réponse contient placeholder", () => {
    const r = sanitizeFaqAnswer("<p>This is a placeholder text.</p>");
    expect(r.skip).toBe(true);
    expect(r.reason).toMatch(/placeholder_detected/);
  });

  it("skip si réponse contient XXXX", () => {
    const r = sanitizeFaqAnswer("<p>Price = XXXX €</p>");
    expect(r.skip).toBe(true);
  });

  it("skip si réponse contient ???", () => {
    const r = sanitizeFaqAnswer("<p>Réponse ???</p>");
    expect(r.skip).toBe(true);
  });

  it("skip si réponse vide ou null", () => {
    expect(sanitizeFaqAnswer("").skip).toBe(true);
    expect(sanitizeFaqAnswer(null).skip).toBe(true);
    expect(sanitizeFaqAnswer("   ").skip).toBe(true);
  });

  it("passe une vraie réponse FR sans placeholder", () => {
    const r = sanitizeFaqAnswer(
      "<p>Un audit IA opérationnel coûte à partir de 490 € HT et dure une demi-journée.</p>",
    );
    expect(r.skip).toBe(false);
    expect(r.html).toContain("490");
  });
});

describe("sanitizeFaqQuestion — strict text + placeholders", () => {
  it("strippe tout HTML", () => {
    const r = sanitizeFaqQuestion("<strong>Combien coûte un audit ?</strong>");
    expect(r.skip).toBe(false);
    expect(r.html).not.toContain("<strong>");
    expect(r.html).toContain("Combien coûte un audit");
  });

  it("skip placeholder", () => {
    const r = sanitizeFaqQuestion("[TBD] Question");
    expect(r.skip).toBe(true);
  });

  it("accepte question normale", () => {
    const r = sanitizeFaqQuestion("Quelle est la durée d'une intervention IA ?");
    expect(r.skip).toBe(false);
    expect(r.html).toContain("durée");
  });
});
