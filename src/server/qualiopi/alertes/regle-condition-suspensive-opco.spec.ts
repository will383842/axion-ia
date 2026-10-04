/**
 * Alerte `condition_suspensive_opco` (INT-T65-A) : rappel J-7 de la date limite
 * (jour civil de Paris), état à constater, et garde-fou « aucune action avant
 * l'accord » (point 5 de la clause).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { ALERTE_CATALOGUE } from "./catalogue";
import {
  candidatsConditionSuspensiveOpco,
  type ConventionSousCondition,
} from "./regle-condition-suspensive-opco";
import { debutDuJourDeParis } from "@/server/qualiopi/financements/condition-suspensive";

/** Convention à 12 000 € TTC, seuil 50 %, date limite le 15/12/2026, session le 15/01/2027. */
function convention(over: Partial<ConventionSousCondition> = {}): ConventionSousCondition {
  return {
    id: "doc-1",
    numero: "AXI-DOC-2026-900",
    clientId: "cli-1",
    seuilConditionBps: 5000,
    seuilConditionCents: null,
    dateLimiteCondition: debutDuJourDeParis("2026-12-15"),
    metadata: { conditionSuspensiveOpco: { prixTtcCents: 1_200_000, opco: "OPCO Atlas" } },
    session: {
      id: "ses-1",
      numero: "AXI-SESS-2027-001",
      dateDebut: new Date("2027-01-15T08:00:00Z"),
      dossiersFinancement: [],
    },
    ...over,
  };
}

describe("candidatsConditionSuspensiveOpco", () => {
  it("le code est au catalogue", () => {
    expect(ALERTE_CATALOGUE["condition_suspensive_opco"]).toBeDefined();
  });

  it("rien avant le J-7 (jour de Paris)", () => {
    // J-7 = 08/12 ; le 07/12 à 23:59:59 heure de Paris = 22:59:59 UTC.
    expect(
      candidatsConditionSuspensiveOpco([convention()], new Date("2026-12-07T22:59:59Z")),
    ).toEqual([]);
  });

  it("rappel dû à partir de 00:00 heure de Paris le J-7", () => {
    const [a] = candidatsConditionSuspensiveOpco([convention()], new Date("2026-12-07T23:00:00Z"));
    expect(a?.code).toBe("condition_suspensive_opco");
    expect(a?.niveau).toBe("important");
    expect(a?.message).toContain("15/12/2026");
    expect(a?.cibleId).toBe("ses-1");
  });

  it("accord écrit ≥ seuil saisi mais non constaté → « à constater »", () => {
    const c = convention({
      session: {
        ...convention().session!,
        dossiersFinancement: [
          {
            clientId: "cli-1",
            accordEcritLe: new Date("2026-11-10T00:00:00Z"),
            montantAccordeCents: 600_000,
            refuseAt: null,
          },
        ],
      },
    });
    const [a] = candidatsConditionSuspensiveOpco([c], new Date("2026-11-20T10:00:00Z"));
    expect(a?.titre).toMatch(/à constater/);
  });

  it("l'accord d'un AUTRE client de la session ne compte pas (inter-entreprises)", () => {
    const c = convention({
      session: {
        ...convention().session!,
        dossiersFinancement: [
          {
            clientId: "cli-2",
            accordEcritLe: new Date("2026-11-10T00:00:00Z"),
            montantAccordeCents: 1_200_000,
            refuseAt: null,
          },
        ],
      },
    });
    expect(candidatsConditionSuspensiveOpco([c], new Date("2026-11-20T10:00:00Z"))).toEqual([]);
  });

  it("date limite passée sans accord → « à constater » (caducité)", () => {
    const [a] = candidatsConditionSuspensiveOpco([convention()], new Date("2026-12-16T10:00:00Z"));
    expect(a?.message).toMatch(/défailli/);
  });

  it("🔴 garde-fou : session dans moins de 7 jours, condition en attente → CRITIQUE", () => {
    const c = convention({
      dateLimiteCondition: debutDuJourDeParis("2027-01-20"),
      session: { ...convention().session!, dateDebut: new Date("2027-01-15T08:00:00Z") },
    });
    const [a] = candidatsConditionSuspensiveOpco([c], new Date("2027-01-09T10:00:00Z"));
    expect(a?.niveau).toBe("critique");
    expect(a?.message).toMatch(/Aucune action ne doit être exécutée/);
  });

  it("une seule alerte par session, la plus grave", () => {
    const rappel = convention({ id: "a", numero: "AXI-DOC-A" });
    const critique = convention({
      id: "b",
      numero: "AXI-DOC-B",
      dateLimiteCondition: debutDuJourDeParis("2027-01-20"),
    });
    const alertes = candidatsConditionSuspensiveOpco(
      [rappel, critique],
      new Date("2027-01-09T10:00:00Z"),
    );
    expect(alertes).toHaveLength(1);
    expect(alertes[0]?.niveau).toBe("critique");
  });
});
