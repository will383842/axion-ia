/**
 * Tests — deck-builder : diaporama de projection 16:9.
 * Vérifie surtout la règle 2026 (texte minimal à l'écran) et le cloisonnement
 * (corrigés + bonnes réponses UNIQUEMENT en notes orateur, jamais à l'écran).
 */

import { describe, it, expect } from "vitest";
import { construireDeck } from "./deck-builder";
import { CONTENU_DETAILLE_VERSION, type ContenuDetaille } from "../../engine/content-schema";

const CONTENU: ContenuDetaille = {
  version: CONTENU_DETAILLE_VERSION,
  modalite: "presentiel",
  modules: [
    {
      moduleId: "M1",
      titre: "La méthode CRFE : demander pour obtenir",
      introduction: "Apprendre à structurer une demande à l'IA pour un résultat fiable.",
      sequences: [
        {
          titre: "Structurer un prompt",
          dureeMin: 30,
          concepts: [
            { titre: "Contexte", explication: "Donner le rôle et le but cadre la réponse." },
          ],
          exempleConcret: "Rédiger un compte-rendu de réunion pour un client.",
          pointsVigilance: ["Éviter les consignes vagues"],
          exercice: {
            consigne: "Écrire un prompt de synthèse.",
            dureeMin: 15,
            corrige: "CORRIGE_SECRET : rôle + objectif + format.",
            criteresReussite: ["Le prompt précise le format"],
          },
          noteFormateur: "Faire comparer deux prompts.",
        },
      ],
      synthese: "Un bon prompt = contexte + objectif + format.",
      quiz: [
        {
          question: "Que doit contenir un bon prompt ?",
          options: ["Un contexte", "Rien de particulier"],
          bonneReponseIndex: 0,
          explication: "REPONSE_SECRETE : le contexte cadre la réponse.",
        },
      ],
    },
  ],
};

describe("deck-builder", () => {
  const deck = construireDeck({
    titreFormation: "IA Express",
    contenuDetaille: CONTENU,
    filRouge: "Cas réel de chaque stagiaire en PME de services",
    livrables: { j0: ["Rédiger un email avec l'IA"], j1: [], j30: ["Utiliser l'IA 3×/semaine"] },
  });

  it("produit une couverture, un agenda et une clôture", () => {
    expect(deck.slides[0]?.kind).toBe("cover");
    expect(deck.slides.some((s) => s.kind === "agenda")).toBe(true);
    expect(deck.slides.at(-1)?.kind).toBe("closing");
  });

  it("crée une slide de section + contenu + synthèse + quiz par module", () => {
    const kinds = deck.slides.map((s) => s.kind);
    expect(kinds).toContain("section");
    expect(kinds).toContain("content");
    expect(kinds).toContain("synthese");
    expect(kinds).toContain("quiz");
  });

  it("NE MET JAMAIS les corrigés ni les bonnes réponses à l'ÉCRAN (puces)", () => {
    const ecran = JSON.stringify(deck.slides.map((s) => ({ titre: s.titre, puces: s.puces })));
    expect(ecran).not.toContain("CORRIGE_SECRET");
    expect(ecran).not.toContain("REPONSE_SECRETE");
  });

  it("met les corrigés et bonnes réponses dans les NOTES orateur", () => {
    const notes = deck.slides.map((s) => s.notes ?? "").join("\n");
    expect(notes).toContain("CORRIGE_SECRET");
    expect(notes).toContain("REPONSE_SECRETE");
  });

  it("respecte le texte minimal à l'écran (≤ 6 puces, titres courts)", () => {
    for (const s of deck.slides) {
      if (s.puces) expect(s.puces.length).toBeLessThanOrEqual(6);
      expect(s.titre.length).toBeLessThanOrEqual(101);
    }
  });

  it("affiche le fil rouge et les livrables", () => {
    const all = JSON.stringify(deck.slides);
    expect(all).toContain("Ce que vous saurez faire");
    // fil rouge présent dans les notes (agenda/cover)
    expect(deck.slides.some((s) => (s.notes ?? "").includes("PME de services"))).toBe(true);
  });
});
