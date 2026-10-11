// @vitest-environment node

/**
 * Lot L16b-1 (ADR 0066) — la politique de confidentialité décrit le traitement
 * des données des FORMATEURS INDÉPENDANTS, avant l'allumage du dossier en ligne
 * (dont le premier écran renvoie à cette section, par son ancre).
 *
 * Test ROUGE d'abord : la notice ne disait rien des formateurs indépendants.
 * Garde de FORME et de faits vérifiables, pas de rédaction.
 */

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";

const ANCRE = "formateurs-independants";

function section(locale: "fr" | "en") {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  return page?.[locale].sections.find((s) => s.anchor === ANCRE);
}

const FR = () => section("fr")?.body ?? "";
const EN = () => section("en")?.body ?? "";

describe("la notice dit vrai sur les formateurs indépendants", () => {
  it("🔴 la section existe en français ET en anglais, à une ancre stable", () => {
    expect(section("fr"), "section FR absente").toBeDefined();
    expect(section("en"), "section EN absente").toBeDefined();
  });

  it("le miroir anglais porte les mêmes faits clés", () => {
    for (const fait of ["6.1.b", "6.1.c", "6.1.f", "L.8222-1", "IBAN", "Telegram", "Calendly"]) {
      expect(EN()).toContain(fait);
    }
    expect(EN()).toMatch(/five years after the end/);
  });

  it("nomme les bases légales (6.1.b, 6.1.c, 6.1.f) et l'obligation de vigilance", () => {
    for (const base of ["6.1.b", "6.1.c", "6.1.f"]) expect(FR()).toContain(base);
    expect(FR()).toMatch(/L\.?\s?8222-1/);
  });

  it("dit le registre public consulté et la preuve conservée", () => {
    expect(FR()).toMatch(/registre/i);
    expect(FR()).toMatch(/liste publique des organismes de formation/i);
  });

  it("dit que l'IBAN est chiffré et jamais réaffiché en entier", () => {
    expect(FR()).toMatch(/IBAN/);
    expect(FR()).toMatch(/chiffr/);
    expect(FR()).toMatch(/jamais réaffiché en entier/);
  });

  it("dit la décision humaine (G1) et le fil interne sans nom (G2)", () => {
    expect(FR()).toMatch(/décidés par une personne/i);
    expect(FR()).toMatch(/ne concluent jamais seuls/);
    expect(FR()).toMatch(/Telegram/);
    expect(FR()).toMatch(/ni votre nom/);
  });

  it("dit la conservation par critères, vigilance 5 ans après la fin (G5), sans purge annoncée", () => {
    expect(FR()).toMatch(/cinq ans après la fin/);
    expect(FR()).toMatch(/dix ans/);
    // La candidature, elle, EST purgée à 2 ans (retention-purge-worker) : la notice le dit.
    expect(FR()).toMatch(/candidature[^.]*effacée automatiquement deux ans/);
    expect(FR()).toMatch(/Hors candidature, vos données ne sont pas supprimées automatiquement/);
  });

  it("dit « données personnelles » même en entreprise individuelle (G4)", () => {
    expect(FR()).toMatch(/données personnelles/);
    expect(FR()).toMatch(/entreprise individuelle/);
  });

  it("cite Calendly et la messagerie qui reçoit les réponses, comme les sections voisines", () => {
    expect(FR()).toMatch(/Calendly/);
    expect(FR()).toMatch(/Zoho Mail/);
  });

  it("aucun mot du contrat de travail ni du mandat d'agence", () => {
    const interdits =
      /\b(poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial)\b/i;
    expect(FR()).not.toMatch(interdits);
    expect(section("fr")?.title ?? "").not.toMatch(interdits);
  });
});
