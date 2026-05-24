// Phase C — Tests worker inspection
// Sprint Site Explorer Admin 2026-05-22

import { describe, it, expect } from "vitest";

// ─── Helpers purs du worker (extracteurs HTML) ────────────────────────────────

function extractMetaTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  return match?.[1]?.trim() ?? null;
}

function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null;
}

function countWords(html: string): number {
  const mainMatch = html.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  const content = mainMatch?.[1] ?? html;
  const text = content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(" ").filter((w) => w.length > 0).length;
}

function countJsonLd(html: string): number {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi);
  return [...matches].length;
}

function detectAiDisclaimer(html: string): boolean {
  return (
    html.includes("data-ai-disclaimer") ||
    html.includes("AiContentDisclaimer") ||
    html.includes("assisté par l'IA") ||
    html.includes("Claude Sonnet") ||
    html.includes("ai-disclaimer")
  );
}

// ─── HTML de test ─────────────────────────────────────────────────────────────

const SAMPLE_HTML = `
<html>
<head>
  <title>Formation IA Paris — Axion-IA</title>
  <meta name="description" content="Formez vos equipes avec Axion-IA.">
  <script type="application/ld+json">{"@type":"Article"}</script>
  <script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
</head>
<body>
  <h1>Formation Intelligence Artificielle Paris</h1>
  <main>
    <p>Nous proposons des formations IA pour les entreprises. Ce contenu a été assisté par l'IA Claude Sonnet pour améliorer la qualité éditoriale.</p>
    <a href="/fr/blog">Blog</a>
    <a href="/fr/contact">Contact</a>
    <a href="https://example.com">Lien externe</a>
  </main>
</body>
</html>
`;

describe("Site Route Inspector — extracteurs HTML", () => {
  it("extrait le metaTitle correctement", () => {
    expect(extractMetaTitle(SAMPLE_HTML)).toBe("Formation IA Paris — Axion-IA");
  });

  it("extrait la metaDescription correctement", () => {
    expect(extractMetaDescription(SAMPLE_HTML)).toBe("Formez vos equipes avec Axion-IA.");
  });

  it("extrait le H1 correctement", () => {
    expect(extractH1(SAMPLE_HTML)).toBe("Formation Intelligence Artificielle Paris");
  });

  it("compte les mots dans <main>", () => {
    const count = countWords(SAMPLE_HTML);
    expect(count).toBeGreaterThan(10);
  });

  it("compte les scripts JSON-LD", () => {
    expect(countJsonLd(SAMPLE_HTML)).toBe(2);
  });

  it("détecte l'AiContentDisclaimer via Claude Sonnet", () => {
    expect(detectAiDisclaimer(SAMPLE_HTML)).toBe(true);
  });

  it("ne détecte pas AiDisclaimer dans HTML sans mention IA", () => {
    const cleanHtml = "<html><body><h1>Page sans IA</h1></body></html>";
    expect(detectAiDisclaimer(cleanHtml)).toBe(false);
  });

  it("retourne null si pas de metaTitle", () => {
    const html = "<html><head></head><body></body></html>";
    expect(extractMetaTitle(html)).toBeNull();
  });
});
