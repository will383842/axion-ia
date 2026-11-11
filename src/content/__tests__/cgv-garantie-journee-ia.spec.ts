/**
 * Garantie de la Journée IA, paiement et clause OPCO dans les CGV (lot W3, PR A).
 *
 * Décisions de Williams du 08/11/2026 : n°2 (garantie, texte unique), n°9 (acompte 30 %),
 * n°21 (retrait de la clause OPCO). Le texte de la garantie vient d'UNE constante, lue
 * par les CGV et par les FAQ des pages formations et un-a-un.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { getLegal } from "@/content/legal";
import {
  GARANTIE_JOURNEE_IA_FORMULE,
  GARANTIE_JOURNEE_IA_CONDITION,
  GARANTIE_JOURNEE_IA_FORMULE_EN,
  GARANTIE_JOURNEE_IA_CONDITION_EN,
} from "@/content/garantie-journee-ia";

const CGV = getLegal("conditions-generales");
function section(locale: "fr" | "en", re: RegExp): string {
  const s = CGV[locale].sections.find((x) => re.test(x.title));
  if (!s) throw new Error(`Section ${re} introuvable (${locale})`);
  return s.body;
}

describe("CGV : article de garantie de la Journée IA", () => {
  it("1. FR : l'article existe et porte la formule et la condition mot pour mot", () => {
    const b = section("fr", /^Garantie de la Journée IA$/);
    expect(b).toContain(GARANTIE_JOURNEE_IA_FORMULE);
    expect(b).toContain(GARANTIE_JOURNEE_IA_CONDITION);
    expect(b).toMatch(/gains identifiés dans le rapport, et non sur des gains réalisés/);
    expect(b).toMatch(/Elle ne s'applique à aucune autre prestation/);
  });

  it("1. EN : l'article existe et porte la formule et la condition", () => {
    const b = section("en", /^Journée IA guarantee$/);
    expect(b).toContain(GARANTIE_JOURNEE_IA_FORMULE_EN);
    expect(b).toContain(GARANTIE_JOURNEE_IA_CONDITION_EN);
  });

  it("la formule ne cite aucun montant en euros", () => {
    for (const t of [
      GARANTIE_JOURNEE_IA_FORMULE,
      GARANTIE_JOURNEE_IA_CONDITION,
      GARANTIE_JOURNEE_IA_FORMULE_EN,
      GARANTIE_JOURNEE_IA_CONDITION_EN,
    ]) {
      expect(t).not.toMatch(/€|\beuros?\b|\bEUR\b/i);
    }
  });

  it("2. « Garanties et responsabilité » garde l'obligation de moyens et renvoie à l'article", () => {
    const fr = section("fr", /^Garanties et responsabilité$/);
    expect(fr).toContain("aucune obligation de résultat");
    expect(fr).toContain("Garantie de la Journée IA");
    const en = section("en", /^Warranties and liability$/);
    expect(en).toMatch(/Journée IA guarantee/);
  });
});

describe("CGV : conditions de paiement", () => {
  it("3. FR : échéancier du devis, acompte 30 %, plus de paiement à la commande ni de seuil", () => {
    const b = section("fr", /^Conditions de paiement$/);
    expect(b).not.toContain("à la commande");
    expect(b).not.toContain("5 000");
    expect(b).toContain("échéancier fixé au devis");
    expect(b).toContain("30 %");
  });

  it("3. EN : plus de « at order time », ni de seuil", () => {
    const b = section("en", /^Payment terms$/);
    expect(b).not.toContain("at order time");
    expect(b).not.toContain("5,000");
    expect(b).toMatch(/schedule set out in the quote/);
    expect(b).toContain("30%");
  });
});

describe("CGV : clause OPCO retirée (décision 21)", () => {
  it("4. aucun titre de section ne parle d'OPCO ou d'opérateur de compétences", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const s of CGV[locale].sections) {
        expect(s.title, `${locale} : ${s.title}`).not.toMatch(
          /OPCO|opérateur de compétences|skills operator/i,
        );
      }
    }
  });

  it("« Dédit et abandon » est conservé", () => {
    expect(CGV.fr.sections.some((s) => /^Dédit et abandon/.test(s.title))).toBe(true);
  });
});

describe("Pages formations et un-a-un : une seule garantie", () => {
  for (const chemin of [
    "src/app/[locale]/formations/page.tsx",
    "src/app/[locale]/un-a-un/page.tsx",
  ]) {
    it(`5. ${chemin} : plus d'ancienne réponse, import de la constante`, () => {
      const src = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(src).not.toContain("personne de sérieux ne peut en donner une");
      expect(src).not.toContain("no serious provider");
      expect(src).toContain("garantie-journee-ia");
    });
  }
});

describe("Relecture : texte du brief et réserve du particulier", () => {
  it("la formule et la condition FR sont, au caractère près, celles décidées le 08/11/2026", () => {
    expect(GARANTIE_JOURNEE_IA_FORMULE).toBe(
      "À la fin de la journée, vous recevez votre rapport complet : vos gains chiffrés, les tâches à automatiser classées par rentabilité, et votre plan d'action sur 90 jours. Si les gains annuels identifiés sont inférieurs à 3 fois le prix de la journée, nous vous remboursons, sans discussion, sous 30 jours.",
    );
    expect(GARANTIE_JOURNEE_IA_CONDITION).toBe(
      "Condition : votre équipe est disponible pendant la journée et nous fournit les chiffres demandés.",
    );
  });

  it("FR : l'acompte de 30 % cède devant les dispositions du particulier, qui existent", () => {
    expect(section("fr", /^Conditions de paiement$/)).toMatch(
      /sous réserve des dispositions propres au particulier/,
    );
    expect(
      section("fr", /^Particulier — délai de rétractation et interdiction de paiement$/),
    ).toMatch(
      /Aucune somme ne peut être exigée ni versée avant l'expiration de ce délai de dix jours/,
    );
  });

  it("EN : aucun renvoi à des sections absentes de la version anglaise", () => {
    const b = section("en", /^Payment terms$/);
    expect(b).not.toMatch(/digital products|set out below/);
    expect(b).toMatch(/L\.6353-6/);
  });
});
