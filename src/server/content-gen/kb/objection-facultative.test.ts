// @vitest-environment node
/**
 * Lot 3 du retrait des promesses de suivi : la paire `objection` / `objectionReply` est
 * facultative. Quand elle manque, les pages secteurs n'affichent ni le bloc « Votre
 * objection, notre réponse » ni l'entrée FAQ correspondante (pas de titre vide, pas de
 * question sans réponse, pas de FAQPage vide).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECTOR_PAIN_MATRIX, getObjectionFaq, getSectorPainContext } from "./sector-pain-matrix";

describe("objection facultative — comptabilite_finance / interventions-formations", () => {
  const pain = getSectorPainContext("comptabilite_finance", "interventions_formations");

  it("l'entrée existe toujours (la page reste indexable)", () => {
    expect(pain).toBeDefined();
    expect(pain!.painStatement.length).toBeGreaterThan(20);
  });

  it("elle ne porte plus de paire objection/réponse", () => {
    expect(pain!.objection).toBeUndefined();
    expect(pain!.objectionReply).toBeUndefined();
    expect(getObjectionFaq(pain!)).toBeNull();
  });

  it("aucune entrée n'a une moitié de paire", () => {
    for (const e of SECTOR_PAIN_MATRIX) {
      expect(Boolean(e.objection), `${e.secteur}/${e.verticale}`).toBe(Boolean(e.objectionReply));
    }
  });

  it("toute entrée avec paire complète produit un item FAQ non vide", () => {
    for (const e of SECTOR_PAIN_MATRIX.filter((x) => x.objection && x.objectionReply)) {
      const item = getObjectionFaq(e);
      expect(item?.question.length).toBeGreaterThan(0);
      expect(item?.answer.length).toBeGreaterThan(0);
    }
  });
});

describe("pages secteurs — lecture gardée de la paire", () => {
  const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const activite = lire("src/app/[locale]/secteurs/[secteur]/[activite]/page.tsx");
  const hub = lire("src/app/[locale]/secteurs/[secteur]/page.tsx");

  it("la page activité n'affiche le bloc objection que si la paire existe", () => {
    expect(activite).toContain("objectionFaq ?");
    expect(activite).not.toMatch(/\{pain\.objection\}/);
  });

  it("le hub filtre les entrées sans paire et masque la section FAQ vide", () => {
    expect(hub).not.toMatch(/a\.pain!\.objection\b/);
    expect(hub).toContain("faqItems.length > 0");
  });
});
