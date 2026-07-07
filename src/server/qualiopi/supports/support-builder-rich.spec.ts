/**
 * Tests — support-builder-rich.ts : supports RICHES depuis le contenu détaillé.
 * Tests purs. Vérifie surtout le cloisonnement formateur/stagiaire (corrigés,
 * réponses de quiz JAMAIS exposés aux stagiaires).
 */

import { describe, it, expect } from "vitest";
import { construireSupportRiche } from "./support-builder-rich";
import { construireSupport } from "./support-builder";
import type { FormationInput } from "./types";
import { CONTENU_DETAILLE_VERSION, type ContenuDetaille } from "../engine/content-schema";

const CONTENU: ContenuDetaille = {
  version: CONTENU_DETAILLE_VERSION,
  modalite: "distanciel",
  modules: [
    {
      moduleId: "M1",
      titre: "Prompt efficace",
      introduction: "Apprendre à formuler des instructions claires pour l'IA.",
      sequences: [
        {
          titre: "Structure d'un bon prompt",
          dureeMin: 30,
          concepts: [
            { titre: "Contexte", explication: "Donner le rôle et le but améliore la réponse." },
          ],
          exempleConcret: "Demander une synthèse de réunion en précisant le destinataire.",
          pointsVigilance: ["Éviter les consignes ambiguës"],
          exercice: {
            consigne: "Rédiger un prompt pour résumer un compte-rendu.",
            dureeMin: 15,
            corrige: "CORRIGE_SECRET : rôle + objectif + format attendu.",
            criteresReussite: ["Le prompt précise le format"],
          },
          noteFormateur: "NOTE_ANIMATION : faire comparer deux prompts.",
          adaptationDistanciel: "Exercice en breakout room.",
        },
      ],
      synthese: "Un bon prompt = contexte + objectif + format.",
      quiz: [
        {
          question: "Que doit contenir un bon prompt ?",
          options: ["Un contexte", "Rien"],
          bonneReponseIndex: 0,
          explication: "REPONSE_SECRETE : le contexte cadre la réponse.",
        },
      ],
    },
  ],
};

const objectifs = ["Rédiger des prompts efficaces"];

describe("support-builder-rich", () => {
  it("slides_formateur expose corrigés et notes d'animation", () => {
    const s = construireSupportRiche("slides_formateur", {
      titre: "IA Express",
      objectifsPedagogiques: objectifs,
      contenuDetaille: CONTENU,
    });
    const flat = JSON.stringify(s);
    expect(flat).toContain("CORRIGE_SECRET");
    expect(flat).toContain("NOTE_ANIMATION");
    expect(flat).toContain("REPONSE_SECRETE");
  });

  it("slides_stagiaire NE FUITE PAS corrigés ni réponses de quiz", () => {
    const s = construireSupportRiche("slides_stagiaire", {
      titre: "IA Express",
      objectifsPedagogiques: objectifs,
      contenuDetaille: CONTENU,
    });
    const flat = JSON.stringify(s);
    expect(flat).not.toContain("CORRIGE_SECRET");
    expect(flat).not.toContain("REPONSE_SECRETE");
    expect(flat).not.toContain("NOTE_ANIMATION");
    // mais bien le contenu pédagogique
    expect(flat).toContain("Structure d'un bon prompt");
  });

  it("cahier d'exercices stagiaire ne contient pas les corrigés", () => {
    const s = construireSupportRiche("exercices", {
      titre: "IA Express",
      objectifsPedagogiques: objectifs,
      contenuDetaille: CONTENU,
    });
    const flat = JSON.stringify(s);
    expect(flat).not.toContain("CORRIGE_SECRET");
    expect(flat).toContain("Réponse :");
  });

  it("guide_animation contient timing, corrigés et adaptation distanciel", () => {
    const s = construireSupportRiche("guide_animation", {
      titre: "IA Express",
      objectifsPedagogiques: objectifs,
      contenuDetaille: CONTENU,
    });
    const flat = JSON.stringify(s);
    expect(flat).toContain("CORRIGE_SECRET");
    expect(flat).toContain("breakout room");
  });

  it("construireSupport délègue au chemin riche quand contenuDetaille est présent", () => {
    const input: FormationInput = {
      titre: "IA Express",
      objectifsPedagogiques: objectifs,
      programmeDetaille: [],
      dureeHeures: 4,
      contenuDetaille: CONTENU,
    };
    const s = construireSupport("slides_stagiaire", input);
    expect(s.meta?.source).toBe("contenu_detaille");
    expect(JSON.stringify(s)).toContain("Structure d'un bon prompt");
  });

  it("construireSupport garde le fallback squelette sans contenuDetaille", () => {
    const input: FormationInput = {
      titre: "IA Express",
      objectifsPedagogiques: objectifs,
      programmeDetaille: [{ moduleId: "M1", titre: "Module A", sequences: [{ titre: "Seq 1" }] }],
      dureeHeures: 4,
    };
    const s = construireSupport("slides_stagiaire", input);
    expect(s.meta?.source).toBeUndefined();
    expect(JSON.stringify(s)).toContain("Module A");
  });
});
