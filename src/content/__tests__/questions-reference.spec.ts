import { describe, it, expect } from "vitest";
import { QUESTIONS_REFERENCE, faqItems } from "../questions-reference";

const INTERDITS =
  /qualiopi|opco|prise en charge|financement|subvention|grenoble|aucun gain garanti|faites-le vous-m|le faire seul|formation obligatoire|niveau suffisant|conformité garantie|attestation de conformité|amende|fondateur|williams|rembours/i;

const toutes = faqItems(Object.keys(QUESTIONS_REFERENCE));
const mots = (t: string) => t.trim().split(/\s+/).length;
const premierePhrase = (t: string) => t.match(/^(.+?[.!?])(\s|$)/)?.[1] ?? t;

describe("questions-reference", () => {
  it("chaque réponse fait de 40 à 80 mots, jetons résolus", () => {
    for (const q of toutes) {
      const n = mots(q.answer);
      expect(n, q.id).toBeGreaterThanOrEqual(40);
      expect(n, q.id).toBeLessThanOrEqual(80);
    }
  });

  it("le sujet figure dans la 1re phrase", () => {
    for (const q of Object.values(QUESTIONS_REFERENCE)) {
      const phrase = premierePhrase(faqItems([q.id])[0].answer).toLowerCase();
      expect(phrase, q.id).toContain(q.sujet.toLowerCase());
    }
  });

  it("aucun mot interdit, aucun jeton restant", () => {
    for (const q of toutes) {
      expect(`${q.question} ${q.answer}`, q.id).not.toMatch(INTERDITS);
      expect(q.answer, q.id).not.toContain("{{");
    }
  });

  it("aucun montant hors prix de la Journée IA", () => {
    for (const q of toutes) {
      const sansPrix = q.answer.replace(/1[\s  ]490[\s  ]€[\s  ]HT/g, "");
      expect(sansPrix, q.id).not.toMatch(/€|\d\s?EUR/);
    }
  });

  it("questions et identifiants uniques", () => {
    const qs = toutes.map((q) => q.question.toLowerCase());
    expect(new Set(qs).size).toBe(qs.length);
    expect(new Set(toutes.map((q) => q.id)).size).toBe(toutes.length);
    for (const [cle, q] of Object.entries(QUESTIONS_REFERENCE)) expect(q.id).toBe(cle);
  });

  it("faqItems refuse un identifiant inconnu", () => {
    expect(() => faqItems(["ref-inconnue"])).toThrow();
  });
});
