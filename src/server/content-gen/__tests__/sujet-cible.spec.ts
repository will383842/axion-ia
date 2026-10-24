/**
 * Filtre de sujets hors cible (audit blog 24/10/2026).
 * Module pur : aucun mock nécessaire.
 */

import { describe, it, expect } from "vitest";
import { evaluerSujetCible } from "../sujet-cible";
import type { RaisonSujetEcarte } from "../sujet-cible";

const REFUSES: ReadonlyArray<readonly [string, RaisonSujetEcarte]> = [
  ["audit IA stratégique ETI", "eti_hors_cible"],
  ["cabinet IA ETI France programme transformation", "eti_hors_cible"],
  ["faut-il un Chief AI Officer dans une ETI ?", "eti_hors_cible"],
  ["IA pour les entreprises de taille intermédiaire", "eti_hors_cible"],
  ["gouvernance IA dans un grand groupe", "grand_groupe"],
  ["cabinet IA grands comptes France", "grand_groupe"],
  ["automatisation IA pour les entreprises du CAC 40", "grand_groupe"],
  ["stratégie IA d'une multinationale", "grand_groupe"],
  ["IA pour marque de luxe France", "luxe"],
  ["audit IA maison mode luxe", "luxe"],
  ["comment devenir formateur en intelligence artificielle", "devenir_formateur"],
  ["devenir consultant IA freelance", "devenir_formateur"],
  ["créer son organisme de formation IA", "devenir_formateur"],
  ["audit IA Grenoble innovation entreprise", "grenoble"],
  ["recette de tarte aux pommes maison", "sans_lien_ia"],
];

const ACCEPTES: ReadonlyArray<string> = [
  "audit IA pour TPE",
  "formation IA équipe commerce de proximité",
  "par où commencer avec ChatGPT dans ma PME ?",
  "automatiser ses devis avec l'IA quand on est artisan",
  "chatbot pour répondre aux clients d'un petit commerce",
  "conformité AI Act : que doit faire une PME ?",
  "quelles obligations AI Act 2026 pour les PME ?",
  "RAG sur la documentation interne d'une entreprise",
  "agence SEO AEO Nantes Pays de Loire",
  "implémenter schema.org JSON-LD site web PME",
  "gagner du temps sur la facturation grâce à l'automatisation",
  "formation IA pour TPE, PME et ETI",
  "audit IA dirigeant de PME Lyon",
  "n8n ou Zapier pour automatiser une petite entreprise ?",
  "formation IA Paris",
];

describe("evaluerSujetCible — sujets refusés", () => {
  it.each(REFUSES)("refuse « %s » (%s)", (mot, raison) => {
    expect(evaluerSujetCible(mot)).toEqual({ accepte: false, raison });
  });
});

describe("evaluerSujetCible — sujets acceptés", () => {
  it.each(ACCEPTES)("accepte « %s »", (mot) => {
    expect(evaluerSujetCible(mot)).toEqual({ accepte: true });
  });
});

describe("evaluerSujetCible — cas limites", () => {
  it("refuse une chaîne vide", () => {
    expect(evaluerSujetCible("   ").accepte).toBe(false);
  });

  it("ne confond pas « eti » avec un mot qui le contient", () => {
    expect(evaluerSujetCible("formation IA pour un yeti ")).toEqual({ accepte: true });
  });

  it("ignore la casse et les accents", () => {
    expect(evaluerSujetCible("AUDIT IA ÉTI").accepte).toBe(false);
    expect(evaluerSujetCible("Formation IA à GRENOBLE").accepte).toBe(false);
  });

  it("un sujet qui vise explicitement TPE/PME n'est pas écarté pour la seule mention d'ETI", () => {
    expect(evaluerSujetCible("IA : différences entre TPE, PME et ETI")).toEqual({ accepte: true });
  });

  it("le luxe et Grenoble sont écartés même si la TPE/PME est citée", () => {
    expect(evaluerSujetCible("IA pour PME du luxe").accepte).toBe(false);
    expect(evaluerSujetCible("IA pour PME de Grenoble").accepte).toBe(false);
  });
});
