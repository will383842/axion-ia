/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { reponsesSchema, REGIONS_QUESTIONNAIRE } from "../schema";
import { NON_UTILISATEUR, UTILISATEUR } from "./_commun";

const ok = (x: unknown) => reponsesSchema.safeParse(x).success;
const avec = (base: object, patch: Record<string, unknown>) => ({ ...base, ...patch });
const sans = (base: Record<string, unknown>, ...cles: string[]) => {
  const c = { ...base };
  for (const k of cles) delete c[k];
  return c;
};

describe("schéma du questionnaire", () => {
  it("accepte une réponse complète, avec ou sans usage de l'IA", () => {
    expect(ok(UTILISATEUR)).toBe(true);
    expect(ok(NON_UTILISATEUR)).toBe(true);
  });

  it("régions : 13 métropolitaines + Outre-mer", () => {
    expect(REGIONS_QUESTIONNAIRE).toHaveLength(14);
    expect(REGIONS_QUESTIONNAIRE).toContain("outre-mer");
    expect(ok(avec(UTILISATEUR, { q3: "atlantide" }))).toBe(false);
    for (const r of REGIONS_QUESTIONNAIRE) expect(ok(avec(UTILISATEUR, { q3: r }))).toBe(true);
  });

  it("refuse toute clé inconnue (email, ip, nom)", () => {
    for (const cle of ["email", "ip", "nom", "userAgent"]) {
      expect(ok(avec(UTILISATEUR, { [cle]: "x" })), cle).toBe(false);
    }
  });

  it("valeurs hors liste refusées", () => {
    expect(ok(avec(UTILISATEUR, { q1: "12" }))).toBe(false);
    expect(ok(avec(UTILISATEUR, { q2: "peche" }))).toBe(false);
    expect(ok(avec(UTILISATEUR, { q6: "tout" }))).toBe(false);
  });

  describe("filtre q4 : « non » ⇒ q5 à q9 ABSENTS", () => {
    it("q4 non + q5 présent : refusé", () => {
      for (const k of ["q5", "q6", "q7", "q8", "q9"] as const) {
        expect(ok(avec(NON_UTILISATEUR, { [k]: UTILISATEUR[k] })), k).toBe(false);
      }
    });
    it("q4 non-j-y-pense : mêmes règles", () => {
      expect(ok(avec(NON_UTILISATEUR, { q4: "non-j-y-pense" }))).toBe(true);
      expect(ok(avec(NON_UTILISATEUR, { q4: "non-j-y-pense", q6: "payantes" }))).toBe(false);
    });
    it("q4 oui : q5 à q9 obligatoires", () => {
      for (const k of ["q5", "q6", "q7", "q8", "q9"]) {
        expect(ok(sans(UTILISATEUR, k)), k).toBe(false);
      }
    });
  });

  describe("réponses exclusives et doublons", () => {
    it("q5 : « ne-sais-pas » seul", () => {
      expect(ok(avec(UTILISATEUR, { q5: ["ne-sais-pas"] }))).toBe(true);
      expect(ok(avec(UTILISATEUR, { q5: ["ne-sais-pas", "autre"] }))).toBe(false);
    });
    it("q7 : « ne-sais-pas » seul", () => {
      expect(ok(avec(UTILISATEUR, { q7: ["ne-sais-pas"] }))).toBe(true);
      expect(ok(avec(UTILISATEUR, { q7: ["rediger", "ne-sais-pas"] }))).toBe(false);
    });
    it("q9 : « aucun-effet » et « ne-sais-pas-encore » exclusifs", () => {
      expect(ok(avec(UTILISATEUR, { q9: ["aucun-effet"] }))).toBe(true);
      expect(ok(avec(UTILISATEUR, { q9: ["ne-sais-pas-encore"] }))).toBe(true);
      expect(ok(avec(UTILISATEUR, { q9: ["aucun-effet", "gain-de-temps"] }))).toBe(false);
      expect(ok(avec(UTILISATEUR, { q9: ["aucun-effet", "ne-sais-pas-encore"] }))).toBe(false);
    });
    it("doublons refusés (q5, q7, q9)", () => {
      expect(ok(avec(UTILISATEUR, { q5: ["autre", "autre"] }))).toBe(false);
      expect(ok(avec(UTILISATEUR, { q7: ["rediger", "rediger"] }))).toBe(false);
      expect(ok(avec(UTILISATEUR, { q9: ["gain-de-temps", "gain-de-temps"] }))).toBe(false);
    });
    it("liste vide refusée", () => {
      expect(ok(avec(UTILISATEUR, { q5: [] }))).toBe(false);
    });
  });

  describe("q10 : 1 à 3 choix, « aucun-frein » exclusif", () => {
    it("bornes", () => {
      expect(ok(avec(UTILISATEUR, { q10: ["temps"] }))).toBe(true);
      expect(ok(avec(UTILISATEUR, { q10: ["temps", "cout", "donnees"] }))).toBe(true);
      expect(ok(avec(UTILISATEUR, { q10: ["temps", "cout", "donnees", "confiance"] }))).toBe(false);
      expect(ok(avec(UTILISATEUR, { q10: [] }))).toBe(false);
      expect(ok(sans(UTILISATEUR, "q10"))).toBe(false);
    });
    it("aucun-frein seul, sans doublon", () => {
      expect(ok(avec(UTILISATEUR, { q10: ["aucun-frein"] }))).toBe(true);
      expect(ok(avec(UTILISATEUR, { q10: ["aucun-frein", "temps"] }))).toBe(false);
      expect(ok(avec(UTILISATEUR, { q10: ["temps", "temps"] }))).toBe(false);
    });
  });

  describe("q1 = 0 et q12", () => {
    it("sans salarié : ni « des salariés » ni « les deux »", () => {
      const base = avec(UTILISATEUR, { q1: "0" });
      expect(ok(avec(base, { q12: "oui-salaries" }))).toBe(false);
      expect(ok(avec(base, { q12: "oui-les-deux" }))).toBe(false);
      expect(ok(avec(base, { q12: "oui-moi" }))).toBe(true);
      expect(ok(avec(base, { q12: "non" }))).toBe(true);
    });
    it("avec salariés : toutes les réponses restent permises", () => {
      expect(ok(avec(UTILISATEUR, { q12: "oui-les-deux" }))).toBe(true);
    });
  });

  describe("q14 présent si et seulement si q13 = oui", () => {
    it("q13 oui sans q14 : refusé", () => {
      expect(ok(sans(UTILISATEUR, "q14"))).toBe(false);
    });
    it("q13 non/ne-sais-pas avec q14 : refusé", () => {
      expect(ok(avec(UTILISATEUR, { q13: "non" }))).toBe(false);
      expect(ok(avec(UTILISATEUR, { q13: "ne-sais-pas" }))).toBe(false);
      expect(ok(sans(avec(UTILISATEUR, { q13: "non" }), "q14"))).toBe(true);
    });
  });

  describe("textes libres q15 et q16", () => {
    it("facultatifs, rognés, vide = absent", () => {
      expect(ok(avec(UTILISATEUR, { q15: "  Rédiger des devis. " }))).toBe(true);
      const r = reponsesSchema.parse(avec(UTILISATEUR, { q15: "  bonjour  ", q16: "   " }));
      expect(r.q15).toBe("bonjour");
      expect(r.q16).toBeUndefined();
    });
    it("1000 caractères au plus", () => {
      expect(ok(avec(UTILISATEUR, { q15: "a".repeat(1000) }))).toBe(true);
      expect(ok(avec(UTILISATEUR, { q16: "a".repeat(1001) }))).toBe(false);
    });
  });

  describe("champs techniques", () => {
    it("consentement obligatoire et littéralement vrai", () => {
      expect(ok(avec(UTILISATEUR, { consentement: false }))).toBe(false);
      expect(ok(sans(UTILISATEUR, "consentement"))).toBe(false);
    });
    it("version du consentement, empreinte et jeton", () => {
      expect(ok(avec(UTILISATEUR, { consentVersion: "autre" }))).toBe(false);
      expect(ok(avec(UTILISATEUR, { codeRetraitHash: "ABC" }))).toBe(false);
      expect(ok(avec(UTILISATEUR, { codeRetraitHash: "A".repeat(64) }))).toBe(false);
      expect(ok(avec(UTILISATEUR, { turnstileToken: "" }))).toBe(false);
    });
  });
});
