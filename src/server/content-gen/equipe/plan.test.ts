import { describe, it, expect } from "vitest";
import { verifierPlan, planVersHtml, type Plan } from "./plan";
import type { Brief } from "./brief";

const ACTIF = { CONTENT_EQUIPE_EDITORIALE: "true" };
const Q = [
  "Combien coûte une formation ?",
  "Quelle durée ?",
  "Qui peut la suivre ?",
  "Quel financement ?",
  "Quels résultats ?",
  "Comment démarrer ?",
];
const brief: Brief = {
  motCle: "formation IA",
  intention: "information",
  requetesSecondaires: [],
  champSemantique: [],
  entites: [],
  questions: Q.map((question) => ({
    question,
    origine: "autre-source" as const,
    reference: "interne",
  })),
  urlCible: "https://axion-ia.com/fr/blog/formation-ia",
  cluster: "/journee-ia",
  type: "neuf",
};
const mots = (n: number, tete = "La formation IA vise") =>
  [
    ...tete.split(" "),
    ...Array.from({ length: n - tete.split(" ").length }, (_, i) => `mot${i}`),
  ].join(" ");

const planValide = (): Plan => ({
  h1: "Que faut-il savoir sur la formation IA ?",
  reponseDirecte: mots(50),
  sections: Q.slice(0, 5).map((q) => ({ h2: `Section ${q}`, questionCouverte: q })),
  faq: [{ q: Q[5]! }],
});

describe("verifierPlan", () => {
  it("accepte un plan conforme", () => {
    const r = verifierPlan(planValide(), brief, ACTIF);
    expect(r.issues).toEqual([]);
    expect(r.bloque).toBe(false);
  });

  it("refuse un saut de niveau (H2 → H4)", () => {
    const p = planValide();
    p.sections[0] = { ...p.sections[0]!, titresSuivants: [{ niveau: 4, texte: "Trop profond" }] };
    const r = verifierPlan(p, brief, ACTIF);
    expect(r.bloque).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("heading_level_skip");
  });

  it("refuse une réponse directe hors 40-60 mots", () => {
    for (const n of [39, 61]) {
      const r = verifierPlan({ ...planValide(), reponseDirecte: mots(n) }, brief, ACTIF);
      expect(r.bloque).toBe(true);
      expect(r.issues.map((i) => i.code)).toContain("answer_length");
    }
    for (const n of [40, 60]) {
      expect(verifierPlan({ ...planValide(), reponseDirecte: mots(n) }, brief, ACTIF).bloque).toBe(
        false,
      );
    }
  });

  it("refuse une réponse directe sans le mot-clé principal", () => {
    const r = verifierPlan(
      { ...planValide(), reponseDirecte: mots(50, "Elle vise") },
      brief,
      ACTIF,
    );
    expect(r.bloque).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("keyword_missing");
  });

  it("refuse une couverture incomplète", () => {
    const p = { ...planValide(), faq: [] };
    const r = verifierPlan(p, brief, ACTIF);
    expect(r.bloque).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("coverage_missing");
  });

  it("refuse une question répétée entre H2 et FAQ", () => {
    const p = { ...planValide(), faq: [{ q: Q[5]! }, { q: Q[0]! }] };
    const r = verifierPlan(p, brief, ACTIF);
    expect(r.bloque).toBe(true);
    expect(r.issues.map((i) => i.code)).toContain("coverage_duplicate");
  });

  it("refuse moins de 5 ou plus de 8 H2, et un H3 isolé", () => {
    const peu = verifierPlan(
      { ...planValide(), sections: planValide().sections.slice(0, 3) },
      brief,
      ACTIF,
    );
    expect(peu.issues.map((i) => i.code)).toContain("h2_count");
    const p = planValide();
    p.sections[0] = { ...p.sections[0]!, titresSuivants: [{ niveau: 3, texte: "Seul" }] };
    expect(verifierPlan(p, brief, ACTIF).issues.map((i) => i.code)).toContain("lone_h3");
  });

  it("refuse un H2 dont la question n'est pas au brief", () => {
    const p = planValide();
    p.sections[0] = { ...p.sections[0]!, questionCouverte: "Question inventée ?" };
    expect(verifierPlan(p, brief, ACTIF).issues.map((i) => i.code)).toContain(
      "question_hors_brief",
    );
  });

  it("interrupteur éteint : avertissement comme avant, jamais bloquant, contrôles neufs ignorés", () => {
    const p = {
      ...planValide(),
      reponseDirecte: "trop court",
      faq: [],
      sections: planValide().sections.slice(0, 1),
    };
    for (const env of [{}, { CONTENT_EQUIPE_EDITORIALE: "1" }]) {
      const r = verifierPlan(p, brief, env);
      expect(r.bloque).toBe(false);
      expect(r.issues.map((i) => i.code)).toEqual(["missing_h2"]);
    }
  });

  it("planVersHtml produit une hiérarchie H1 puis H2", () => {
    expect(planVersHtml(planValide())).toMatch(/^<h1>.*<\/h1><p>.*<\/p><h2>/);
  });
});
