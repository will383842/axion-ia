/**
 * GEO V2-09 : la page /fr/cartographie reprend les sources uniques, porte Service + FAQPage,
 * figure dans le sitemap et dans llms.txt, sans prix en dur ni mot interdit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEROULE_JOURNEE_IA, RAPPORT_COMPLET } from "@/content/journee-ia-commun";
import { MOTS_INTERDITS_LLMS } from "@/app/_llms/faits-communs";
import { routing } from "@/i18n/routing";

import { CONTENU as ACCUEIL } from "../../_accueil/contenu";
import { DEFINITION, FAQ, TEXTES, DESCRIPTION_META, TITRE } from "../contenu";
import { jsonLdCartographie } from "../jsonld";

const DOSSIER = path.join(process.cwd(), "src/app/[locale]/cartographie");
const page = readFileSync(path.join(DOSSIER, "page.tsx"), "utf8");
const tout = JSON.stringify({ TEXTES, FAQ, DEFINITION, DESCRIPTION_META, TITRE });

describe("contenu /cartographie", () => {
  it("ouvre sur la définition en une phrase", () => {
    expect(DEFINITION).toMatch(/matin de la Journée IA/);
    expect(DEFINITION).toMatch(/service par service/);
    expect(DEFINITION).toMatch(/en heures et en euros/);
    expect(page.indexOf("{DEFINITION}")).toBeLessThan(page.indexOf("h-pour-qui"));
  });

  it("reprend mot pour mot les sources uniques", () => {
    expect(TEXTES.deroule.intro).toBe(DEROULE_JOURNEE_IA);
    expect(TEXTES.recu.elements).toContain(RAPPORT_COMPLET);
    expect(TEXTES.principe).toBe("Par vos tâches, pas par un outil.");
    const accueil = ACCUEIL.faq.questions.find((q) => q.id === "faq-commencer")!.reponse;
    expect(FAQ.find((f) => f.id === "faq-commencer")!.reponse).toBe(accueil);
    expect(TEXTES.deroule.etapes[1].texte).toContain(ACCUEIL.blocJournee.tuiles[0].texte);
  });

  it("ne contient aucun prix, jeton résiduel ni mot interdit", () => {
    expect(tout).not.toMatch(/\d[  .]?\d*\s?€\s?HT/);
    expect(tout).not.toContain("{{PRIX}}");
    expect(tout).not.toMatch(/Grenoble|Qualiopi|OPCO|prise en charge|certifi|n°\s?1|référence du marché|témoign/i);
    expect(page).not.toMatch(/\d[  ]?€/);
    // `no-code` et `financ…` sont filtrés dans llms ; ici on réutilise le même motif.
    expect(tout).not.toMatch(MOTS_INTERDITS_LLMS);
  });

  it("présente l'exemple comme fictif, sans garantie de résultat", () => {
    expect(TEXTES.exemple.titre).toMatch(/fictif/);
    expect(TEXTES.exemple.total).toMatch(/pas un résultat client/);
    expect(tout).not.toMatch(/garanti/i);
  });

  it("renvoie vers la Journée IA et le diagnostic gratuit", () => {
    expect(page).toContain('href="/journee-ia"');
    expect(page).toContain("lienDiagnostic(");
    expect(JSON.stringify(FAQ)).toContain("diagnostic IA gratuit de 45 minutes");
  });
});

describe("JSON-LD /cartographie", () => {
  const [service, webPage, faq] = jsonLdCartographie();

  it("émet Service, WebPage et FAQPage (questions visibles mot pour mot)", () => {
    expect(service["@type"]).toBe("Service");
    expect(webPage["@type"]).toBe("WebPage");
    expect(faq["@type"]).toBe("FAQPage");
    const questions = (faq as { mainEntity: { name: string }[] }).mainEntity.map((q) => q.name);
    expect(questions).toEqual(FAQ.map((f) => f.question));
  });

  it("n'émet aucune offre ni prix", () => {
    expect(JSON.stringify(service)).not.toContain('"offers"');
  });

  it("est émis dans le HTML serveur (composant sans « use client »)", () => {
    expect(page).not.toContain("use client");
    expect(page.match(/<JsonLd /g)).toHaveLength(3);
  });
});

describe("sitemap et llms", () => {
  it("la route est déclarée, donc dans pages.xml", () => {
    expect(Object.keys(routing.pathnames)).toContain("/cartographie");
    const sitemap = readFileSync(path.join(process.cwd(), "src/app/sitemap.ts"), "utf8");
    expect(sitemap).not.toMatch(/"\/cartographie"/); // non exclue
  });

  it("figure dans llms.txt et llms-full.txt", () => {
    for (const f of ["llms.txt", "llms-full.txt"]) {
      const src = readFileSync(path.join(process.cwd(), "src/app", f, "route.ts"), "utf8");
      expect(src).toContain("/fr/cartographie");
    }
  });
});
