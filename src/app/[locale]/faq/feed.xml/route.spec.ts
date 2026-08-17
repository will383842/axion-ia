/**
 * Tests — `/[locale]/faq/feed.xml` (audit GEO/AEO 2026-08-15, LOT 4).
 *
 * Finding couvert : GEO-040, volet « tokens ». Le flux servait 70 gabarits
 * `{{price:…}}` NON RÉSOLUS dans les `<description>` — c'est-à-dire dans le
 * champ précis qu'un agrégateur ou un moteur de réponse recopie.
 *
 * ⚠️ Périmètre volontairement restreint au volet tokens. Les deux autres volets
 * de GEO-040 (cap d'items, `pubDate`) sont livrés séparément : plafonner le flux
 * lui fait perdre des items qu'un agrégateur a déjà indexés, ce qui n'a rien à
 * voir avec un rendu de prix. La sémantique du flux n'est donc PAS touchée ici,
 * et le test ci-dessous le verrouille explicitement.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

// Pas de DB en test : `listFaqs()` retombe sur le SSOT `FAQ_GLOBAL`, qui est
// justement la source porteuse des tokens de prix.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fAQ: { findMany: async () => [] },
    knowledgeEntry: { findMany: async () => [] },
  },
}));

import { GET } from "./route";
import { FAQ_GLOBAL } from "@/content/transversal";

async function flux(locale: string): Promise<string> {
  const res = await GET(new Request(`https://axion-ia.com/${locale}/faq/feed.xml`), {
    params: Promise.resolve({ locale }),
  });
  return res.text();
}

const XML_FR = await flux("fr");

describe("feed FAQ — les descriptions servent des prix, pas des gabarits", () => {
  it("le SSOT porte bien des tokens (garde anti-test-vide)", () => {
    // Si un jour FAQ_GLOBAL n'en portait plus, le test suivant passerait sans
    // rien prouver. On mesure donc d'abord la matière à résoudre.
    const tokens = FAQ_GLOBAL.filter((f) => f.fr.answer.includes("{{price:"));
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("ne contient AUCUN token de prix brut", () => {
    expect(XML_FR).not.toContain("{{price:");
    expect(XML_FR).not.toContain("{{label:");
  });

  it("sert des montants en euros résolus", () => {
    expect(XML_FR).toMatch(/\d[  \s]?\d{3}\s?€/);
  });

  it("ne produit jamais « à partir de à partir de »", () => {
    // Décision actée Will : le mode `|flat` reste `|flat`, la prose porte déjà
    // l'amorce. `collapsePriceProseDuplicates` rattrape les collisions.
    expect(XML_FR.toLowerCase()).not.toMatch(/à\s+partir\s+de\s+à\s+partir\s+de/);
    expect(XML_FR).not.toMatch(/à\s+À\s+partir\s+de/);
  });
});

describe("feed FAQ — la sémantique du flux reste intacte", () => {
  it("émet toujours un item par Q/R, sans cap ni fenêtre", () => {
    // Fix 2026-07-31 : « N derniers items sans fenêtre ». Ce lot ne touche QUE
    // le rendu des prix — si ce compte bouge, c'est qu'un patch a débordé.
    const items = XML_FR.match(/<item>/g) ?? [];
    expect(items.length).toBeGreaterThanOrEqual(FAQ_GLOBAL.length);
  });

  it("échappe toujours le XML après résolution des tokens", () => {
    // La résolution insère du texte ; elle ne doit pas court-circuiter
    // l'échappement (un « & » non échappé rend le flux invalide).
    expect(XML_FR).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
  });

  it("refuse une locale inconnue", async () => {
    const res = await GET(new Request("https://axion-ia.com/de/faq/feed.xml"), {
      params: Promise.resolve({ locale: "de" }),
    });
    expect(res.status).toBe(404);
  });
});
