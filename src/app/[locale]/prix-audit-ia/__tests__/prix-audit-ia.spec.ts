/**
 * GEO V2-28 : la page /fr/prix-audit-ia n'affiche qu'un seul montant (celui de la Journée IA, lu
 * dans `pricing.ts`), aucun mot interdit, porte Service (Offer, TVA en sus) + FAQPage, figure dans
 * le sitemap et dans llms.txt.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { remplacerJetons } from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER } from "@/content/pricing";
import { MOTS_INTERDITS_LLMS } from "@/app/_llms/faits-communs";
import { PHRASE_AUDIT_APPROFONDI, reponseReference } from "@/content/questions-reference";
import { routing } from "@/i18n/routing";

import { DESCRIPTION_META, FAQ, OG_IMAGE_ALT, REPONSE_DIRECTE, TEXTES, TITRE } from "../contenu";
import { jsonLdPrixAuditIa } from "../jsonld";

const DOSSIER = path.join(process.cwd(), "src/app/[locale]/prix-audit-ia");
const page = readFileSync(path.join(DOSSIER, "page.tsx"), "utf8");
const sourceContenu = readFileSync(path.join(DOSSIER, "contenu.ts"), "utf8");
const rendu = remplacerJetons(
  JSON.stringify({ TEXTES, FAQ, REPONSE_DIRECTE, DESCRIPTION_META, TITRE, OG_IMAGE_ALT }),
);

const MOTS_INTERDITS =
  /Qualiopi|OPCO|CPF|France Travail|financ|prise en charge|Grenoble|Aucun gain garanti|garanti|appel de cadrage|témoign/i;

describe("contenu /prix-audit-ia", () => {
  it("ne contient aucun mot interdit", () => {
    expect(rendu).not.toMatch(MOTS_INTERDITS);
    expect(rendu).not.toMatch(MOTS_INTERDITS_LLMS);
  });

  it("le seul montant en euros est 1 490 (jamais écrit en dur)", () => {
    expect(JOURNEE_IA_TIER.priceFlat).toBe(1490);
    const montants = rendu.match(/\d[\d\s  .,]*\s*(€|euros?\b|EUR\b)/gi) ?? [];
    expect(montants.length).toBeGreaterThan(0);
    for (const m of montants) {
      expect(m.replace(/[\s  .,]/g, "")).toMatch(/^1490(€|euros?|EUR)$/i);
    }
    // Rien d'écrit en dur : le prix passe par le jeton, jamais par la source.
    expect(sourceContenu).not.toMatch(/\d[\s  ]?€/);
    expect(page).not.toMatch(/\d[\s  ]?€/);
    expect(rendu).not.toContain("{{");
  });

  it("répond en trois phrases, en tête, avec le prix et ce qui est compris", () => {
    const reponse = remplacerJetons(REPONSE_DIRECTE);
    expect(reponse.match(/\.(\s|$)/g)).toHaveLength(3);
    expect(reponse).toContain("1 490");
    expect(reponse).toMatch(/Journée IA/);
    expect(reponse).toMatch(/audit/);
    expect(reponse).toMatch(/formation/);
    expect(reponse).toMatch(/3 jours ouvrés/);
    expect(page.indexOf("REPONSE_DIRECTE")).toBeLessThan(page.indexOf("h-compris"));
  });

  it("aucun pourcentage, chiffre de gain, jeton de gain ni « k€ » (texte rendu et source)", () => {
    expect(rendu).not.toMatch(/%|pour\s?cent|k€|\bROI\b/i);
    for (const j of ["{{GAIN_EXEMPLE}}", "{{TAUX_HORAIRE}}", "{{HEURES_EXEMPLE}}"]) {
      expect(sourceContenu).not.toContain(j);
    }
  });

  it("dit la TVA en sus et l'absence de prix d'audit séparé", () => {
    expect(TEXTES.tva).toMatch(/hors taxes/);
    expect(JSON.stringify(FAQ)).toMatch(/hors taxes/);
    expect(TEXTES.compris.intro).toContain(PHRASE_AUDIT_APPROFONDI);
    expect(FAQ.find((q) => q.id === "prix-audit-ia-separe")?.reponse).toContain(
      PHRASE_AUDIT_APPROFONDI,
    );
    expect(reponseReference("ref-audit-prix")).toContain(PHRASE_AUDIT_APPROFONDI);
    expect(rendu).toContain(PHRASE_AUDIT_APPROFONDI);
    expect(JSON.stringify(FAQ)).not.toMatch(/pas de prix d’audit séparé|Aucun prix d’audit/);
  });

  it("formation et automatisation : sur devis écrit, sans chiffre de prix", () => {
    expect(TEXTES.surDevis.formation.texte).toMatch(/sur devis écrit/i);
    expect(TEXTES.surDevis.formation.texte).toMatch(/2 à 15 personnes/);
    expect(TEXTES.surDevis.automatisation.texte).toMatch(/forfait est fixé avant de commencer/);
  });

  it("le bouton principal dit « Réserver un Diagnostic IA »", () => {
    expect(TEXTES.cta).toBe("Réserver un Diagnostic IA");
  });

  it("compte de 5 à 7 questions, liens internes et bouton vers le Diagnostic IA", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(5);
    expect(FAQ.length).toBeLessThanOrEqual(7);
    for (const href of ['href="/tarifs"', 'href="/audit"', 'href="/journee-ia"']) {
      expect(page).toContain(href);
    }
    expect(page).toContain("lienDiagnostic(");
    expect(page).not.toMatch(/stripe|checkout|<form/i);
  });
});

describe("JSON-LD /prix-audit-ia", () => {
  const [service, webPage, faq] = jsonLdPrixAuditIa();

  it("émet Service, WebPage et FAQPage (questions visibles mot pour mot)", () => {
    expect(service["@type"]).toBe("Service");
    expect(webPage["@type"]).toBe("WebPage");
    expect(faq["@type"]).toBe("FAQPage");
    const questions = (faq as { mainEntity: { name: string }[] }).mainEntity.map((q) => q.name);
    expect(questions).toEqual(FAQ.map((f) => f.question));
  });

  it("le Service porte l'offre à 1490 EUR, TVA en sus, provider #organization", () => {
    const s = JSON.parse(JSON.stringify(service));
    expect(s.provider).toEqual({ "@id": expect.stringMatching(/\/#organization$/) });
    const offre = JSON.stringify(s.offers);
    expect(offre).toContain('"price":1490');
    expect(offre).toContain('"priceCurrency":"EUR"');
    expect(offre).toContain('"valueAddedTaxIncluded":false');
  });

  it("aucun autre montant dans le JSON-LD", () => {
    const tout = JSON.stringify([service, webPage, faq]);
    const prix = [...tout.matchAll(/"price":\s*"?([\d.]+)/g)].map((m) => m[1]);
    for (const p of prix) expect(p).toBe("1490");
    expect(tout).not.toMatch(MOTS_INTERDITS);
    // Texte des réponses FAQ : seul 1 490 € en euros, ni pourcentage ni chiffre de gain.
    const texteFaq = remplacerJetons(JSON.stringify((faq as { mainEntity: unknown[] }).mainEntity));
    expect(texteFaq).not.toMatch(/%|pour\s?cent|k€|\bROI\b|\{\{/i);
    for (const m of texteFaq.match(/\d[\d\s  .,]*\s*(€|euros?\b|EUR\b)/gi) ?? []) {
      expect(m.replace(/[\s  .,]/g, "")).toMatch(/^1490(€|euros?|EUR)$/i);
    }
  });

  it("est émis dans le HTML serveur (composant sans « use client »)", () => {
    expect(page).not.toContain("use client");
    expect(page.match(/<JsonLd /g)).toHaveLength(3);
  });
});

describe("sitemap et llms", () => {
  it("la route est déclarée, donc dans pages.xml", () => {
    expect(Object.keys(routing.pathnames)).toContain("/prix-audit-ia");
    const sitemap = readFileSync(path.join(process.cwd(), "src/app/sitemap.ts"), "utf8");
    expect(sitemap).not.toMatch(/"\/prix-audit-ia"/); // non exclue
  });

  it("figure dans llms.txt", () => {
    const src = readFileSync(path.join(process.cwd(), "src/app/llms.txt/route.ts"), "utf8");
    expect(src).toContain("/fr/prix-audit-ia");
  });
});
