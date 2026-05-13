/**
 * KB-12 — Tests sanitization Tiptap. Pure.
 */

import { describe, expect, it } from "vitest";
import { isUrlSafe, sanitizeTiptapHtml } from "./tiptap-sanitize";

describe("sanitizeTiptapHtml", () => {
  it("conserve les tags whitelistés", () => {
    const html = "<p>texte <strong>gras</strong> <em>italique</em></p>";
    const out = sanitizeTiptapHtml(html);
    expect(out).toContain("<p>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<em>");
  });

  it("strip <script> entièrement", () => {
    const html = '<p>safe</p><script>alert("xss")</script><p>aussi safe</p>';
    const out = sanitizeTiptapHtml(html);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>");
  });

  it("strip <style>", () => {
    const out = sanitizeTiptapHtml("<style>body{color:red}</style><p>texte</p>");
    expect(out).not.toContain("<style");
  });

  it("strip <iframe>", () => {
    const out = sanitizeTiptapHtml('<iframe src="evil.com"></iframe><p>safe</p>');
    expect(out).not.toContain("<iframe");
  });

  it("strip handlers JS inline (onclick, onerror, etc.)", () => {
    const html = '<p onclick="alert(1)">texte</p><img src="/a" onerror="evil()">';
    const out = sanitizeTiptapHtml(html);
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
  });

  it("strip javascript: dans href", () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    const out = sanitizeTiptapHtml(html);
    expect(out).not.toContain("javascript:");
  });

  it("strip tags non whitelistées (script, custom)", () => {
    const html = "<my-custom-tag>contenu</my-custom-tag><p>safe</p>";
    const out = sanitizeTiptapHtml(html);
    expect(out).not.toContain("my-custom-tag");
    expect(out).toContain("<p>");
  });
});

describe("isUrlSafe", () => {
  it("accepte http(s)", () => {
    expect(isUrlSafe("https://example.com")).toBe(true);
    expect(isUrlSafe("http://example.com")).toBe(true);
  });

  it("accepte mailto / tel / hash / relative", () => {
    expect(isUrlSafe("mailto:a@b.com")).toBe(true);
    expect(isUrlSafe("tel:+33123456789")).toBe(true);
    expect(isUrlSafe("#anchor")).toBe(true);
    expect(isUrlSafe("/blog/article")).toBe(true);
  });

  it("refuse javascript:", () => {
    expect(isUrlSafe("javascript:alert(1)")).toBe(false);
  });

  it("refuse data:", () => {
    expect(isUrlSafe("data:text/html;base64,...")).toBe(false);
  });

  it("refuse strings malformées", () => {
    expect(isUrlSafe("not a url")).toBe(false);
  });
});
