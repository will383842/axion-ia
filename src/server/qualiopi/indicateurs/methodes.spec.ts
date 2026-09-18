/**
 * 🔴 Les quatre phrases de méthode de `/fr/certification-qualiopi` ne sont
 * JAMAIS vides — surtout pas au build.
 *
 * Mesuré en production le 2026-09-17 : aucune des quatre méthodes dans
 * 1 411 588 octets de HTML. Le build tourne sous `stub.invalid` (ADR 0026),
 * `getIndicateurs` y sort par `buildEmptyResult`, qui rendait `""` ×4, et
 * `revalidate = 3600` figeait ce HTML. Ce test rejoue exactement ce chemin.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaire: { findMany: vi.fn() },
    evaluationAcquis: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/redis", () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn(), keys: vi.fn() },
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn().mockResolvedValue(80),
}));

import { getIndicateurs } from "./service";
import { buildMethodesCalcul } from "./methodes";

const CLES = ["satisfaction", "reussite", "completion", "delaiAcces"] as const;

describe("méthodes de calcul des indicateurs publiés", () => {
  it("au build (stub.invalid) : les quatre méthodes sont rendues, non vides", async () => {
    const original = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const r = await getIndicateurs(2026);
      for (const cle of CLES) {
        expect(r.methodes[cle].trim().length, `méthode « ${cle} » vide au build`).toBeGreaterThan(
          40,
        );
      }
      expect(r.methodes.satisfaction).toContain("01/01/2026");
      // 🔴 Au build, l'effectif et le seuil configuré sont INCONNUS, pas nuls :
      // la page prérendue ne doit afficher AUCUN compteur ni seuil inventé.
      // (Le 2026-09-18, la prod comptait 1 questionnaire répondu en 2026 alors
      // que la page affirmait « 0 évaluation ».)
      for (const cle of CLES) {
        expect(r.methodes[cle], `compteur inventé dans « ${cle} »`).not.toMatch(
          /\(\S+ évaluations?/,
        );
        expect(r.methodes[cle], `seuil inventé dans « ${cle} »`).not.toMatch(/\(\S+ %\)/);
      }
    } finally {
      process.env["DATABASE_URL"] = original;
    }
  });

  it("valeurs CONNUES (runtime) : l'effectif et le seuil sont imprimés, même à zéro", () => {
    const m = buildMethodesCalcul({ annee: 2027, seuilPresencePct: 80, nbSatisfaction: 0 });
    for (const cle of CLES) expect(m[cle].trim()).not.toBe("");
    expect(m.completion).toContain("(80 %)");
    expect(m.satisfaction).toContain("(0 évaluation du 01/01/2027 au 31/12/2027)");
  });

  it("valeurs INCONNUES : la méthode seule, sans aucun chiffre inventé", () => {
    const m = buildMethodesCalcul({ annee: 2027, seuilPresencePct: null, nbSatisfaction: null });
    for (const cle of CLES) expect(m[cle].trim()).not.toBe("");
    expect(m.satisfaction).not.toMatch(/\(\S+ évaluations?/);
    expect(m.satisfaction).toContain("01/01/2027 au 31/12/2027");
    expect(m.completion).not.toMatch(/\S+ %/);
    for (const cle of CLES) expect(m[cle]).not.toMatch(/null|undefined|NaN/);
    expect(m.satisfaction).toContain(" Période : du 01/01/2027 au 31/12/2027.");
    expect(m.completion).toContain("seuil de présence requis sur l'ensemble");
  });
});
