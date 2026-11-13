/**
 * R5a — la page /journee-ia lit le prix dans pricing.ts, renvoie vers /appel, et n'affiche
 * ni paiement, ni acompte, ni frais de déplacement, ni prix de formation.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { remplacerJetons } from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER, formatAmount } from "@/content/pricing";
import { SITE_URL } from "@/lib/seo";
import { CONTENU, JETON_PRIX, TEXTES_ANNEXES, TITRE } from "../contenu";
import { jsonLdJourneeIa } from "../jsonld";
import { prixDeLaJournee, remplacerLePrix } from "../prix";

const DOSSIER = path.join(process.cwd(), "src/app/[locale]/journee-ia");
const page = readFileSync(path.join(DOSSIER, "page.tsx"), "utf8");
const jsonld = readFileSync(path.join(DOSSIER, "jsonld.ts"), "utf8");

describe("page /journee-ia", () => {
  it("affiche 1 490 € HT, lu dans JOURNEE_IA_TIER", () => {
    expect(prixDeLaJournee("fr")).toBe(formatAmount(JOURNEE_IA_TIER.priceFlat!, "fr"));
    expect(prixDeLaJournee("fr")).toContain("1");
    expect(prixDeLaJournee("fr").replace(/\s/g, " ")).toMatch(/1.490 € HT/);
    // La première réponse de la FAQ porte le jeton de prix.
    const reponsePrix = CONTENU.faq[0].reponse;
    expect(reponsePrix).toContain(JETON_PRIX);
    expect(remplacerLePrix(reponsePrix).replace(/\s/g, " ")).toMatch(/^1.490 € HT la journée/);
    expect(remplacerLePrix(reponsePrix)).not.toContain(JETON_PRIX);
  });

  it("n'écrit aucun montant en dur dans page.tsx", () => {
    expect(page).not.toMatch(/\b1[  .]?490\b/);
    expect(page).not.toMatch(/\d[  ]?€/);
    expect(page).toContain("JOURNEE_IA_TIER");
  });

  it("design v4 : surtitres numérotés 01 à 09, numéro décoratif (aria-hidden), fonds alternés", () => {
    for (let i = 1; i <= 9; i++)
      expect(page).toContain(`<Surtitre n="${String(i).padStart(2, "0")}"`);
    expect(page).toMatch(/aria-hidden="true"\s+className="[^"]*tabular-nums/);
    expect(page).toContain("bg-mocha text-mocha-fg");
    expect(page).not.toContain("bg-mocha-rich");
    expect(page).toContain("bg-terracotta text-mocha-fg");
  });

  it("carte des gains : largeurs des barres en style inline serveur, aucune règle `.js` qui les met à 0", () => {
    const carte = readFileSync(path.join(DOSSIER, "_composants/CarteDesGains.tsx"), "utf8");
    const css = readFileSync(path.join(DOSSIER, "journee-ia.module.css"), "utf8");
    expect(carte).toContain("style={{ width:");
    expect(carte).not.toContain("use client");
    expect(css).not.toMatch(/\.js\b/);
    expect(css).not.toMatch(/width:\s*0\b/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("a le rendez-vous gratuit de 45 minutes comme prochaine étape, vers /appel", () => {
    expect(page).toContain("/appel");
    expect(JSON.stringify(CONTENU)).toContain("45 minutes");
    expect(page).not.toMatch(/\b(15|30) minutes\b/);
  });

  it("n'affiche ni paiement, ni acompte, ni frais de déplacement, ni prix de formation", () => {
    const tout = (page + JSON.stringify(CONTENU) + JSON.stringify(TEXTES_ANNEXES)).toLowerCase();
    for (const interdit of [
      "acompte",
      "paiement",
      "déplacement",
      "deplacement",
      "qualiopi",
      "grenoble",
      "cpf",
      "certifi",
      "eti",
      "grands groupes",
      "tpe/pme",
    ]) {
      // « eti » est cherché comme mot entier : « mettre », « journée » en contiennent.
      const motif = interdit === "eti" ? /\beti\b/ : new RegExp(interdit.replace(/[/]/g, "\\/"));
      expect(tout, interdit).not.toMatch(motif);
    }
    expect(page).not.toContain("FORMATION_PRICE_MATRIX");
  });

  it("est une page statique, canonique /journee-ia, sans Review ni AggregateRating", () => {
    expect(page).toContain('const PATH = "/journee-ia"');
    expect(page).toMatch(/export const revalidate = 3600/);
    expect(page).not.toMatch(/AggregateRating|"Review"|\bReview\b/);
    expect(page.startsWith('"use client"')).toBe(false);
  });

  it("renvoie les locales non françaises vers /fr/journee-ia (308)", () => {
    expect(page).toMatch(/permanentRedirect\(\s*["'`]\/fr\/journee-ia["'`]\s*\)/);
  });

  it("le bouton mène au Diagnostic IA gratuit de 45 minutes : /appel?rdv=diagnostic", () => {
    expect(page).toContain("/appel?rdv=diagnostic&depuis=");
    expect(page).not.toContain("rdv=projet");
    expect(page).not.toContain("rdv=journee");
    // Chaque lien a sa propre origine : le « Déjà décidé » du bloc prix n'est pas le bouton du bloc prix.
    const origines = [...page.matchAll(/lien(?:Direct)?\("(journee-ia-[a-z-]+)"\)/g)].map(
      (m) => m[1],
    );
    expect(origines).toContain("journee-ia-prix-decide");
    expect(origines.filter((o) => o === "journee-ia-prix")).toHaveLength(1);
  });

  it("annonce le plafond de 15 personnes, et rien d'autre de chiffré", () => {
    expect(JSON.stringify(CONTENU)).toContain("jusqu’à 15 personnes");
    expect(JSON.stringify(CONTENU)).not.toContain("précisé dans votre devis");
  });

  it("déclare la France comme zone desservie via le nœud Service partagé", () => {
    expect(jsonld).toContain("buildJourneeIaServiceJsonLd(");
    expect(page).not.toContain("formatAmount");
    expect(jsonld).not.toContain("formatAmount");
    expect(jsonld).toMatch(/name: TITRE/);
    const [service] = jsonLdJourneeIa();
    expect(JSON.stringify(service)).toContain('"name":"France"');
  });
});

describe("jsonLdJourneeIa()", () => {
  const [service, webPage, faq] = jsonLdJourneeIa();

  it("émet un Service, une WebPage et une FAQPage, et rien d'autre", () => {
    expect([service["@type"], webPage["@type"], faq["@type"]]).toEqual([
      "Service",
      "WebPage",
      "FAQPage",
    ]);
    const json = JSON.stringify([service, webPage, faq]);
    // Organization, WebSite et Person restent émis par le layout.
    expect(json).not.toMatch(/"@type":"(Organization|WebSite|Person)"/);
    expect(json).not.toMatch(/AggregateRating|"Review"|"Course"|"Product"|"Event"/);
    expect(json).not.toContain("{{");
  });

  it("la WebPage porte le titre et la description de la meta, et désigne le Service", () => {
    expect(webPage.name).toBe(TITRE);
    expect(webPage.description).toContain(prixDeLaJournee("fr"));
    expect(webPage.about).toEqual({ "@id": service["@id"] });
    expect(webPage.dateModified).toBe("2026-11-09");
    expect(JSON.stringify(webPage)).toContain("primaryImageOfPage");
    expect(JSON.stringify(webPage)).toContain("#primaryimage");
  });

  it("la WebPage désigne le fil d'Ariane émis par Breadcrumbs, et la FAQPage s'y rattache", () => {
    expect(webPage.breadcrumb).toEqual({ "@id": `${SITE_URL}/fr/journee-ia#breadcrumb` });
    expect(faq["@id"]).toBe(`${SITE_URL}/fr/journee-ia#faq`);
    expect(faq.isPartOf).toEqual({ "@id": webPage["@id"] });
  });

  it("la FAQPage reprend les 13 questions et réponses visibles, mot pour mot", () => {
    expect(faq.mainEntity.map((q) => q.name)).toEqual(CONTENU.faq.map((f) => f.question));
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(
      CONTENU.faq.map((f) => remplacerJetons(f.reponse)),
    );
    expect(faq.dateModified).toBe("2026-11-09");
    // Williams signe la page : la FAQ ne crédite pas la persona éditoriale.
    expect(JSON.stringify(faq.author)).not.toContain("manon");
  });
});
