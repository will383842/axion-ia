/**
 * INT-T65-A — les dossiers de financement deviennent des événements de la
 * condition : l'accord ÉCRIT (`accordEcritLe`, une DATE) se lit comme le jour
 * civil de Paris qu'il désigne.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { evenementsDepuisDossiers } from "../condition-suspensive-service";
import {
  debutDuJourDeParis,
  evaluerConditionSuspensive,
  type ConditionSuspensive,
} from "../condition-suspensive";

/** `@db.Date` : Prisma rend minuit UTC du jour saisi. */
const jourDb = (jour: string): Date => new Date(`${jour}T00:00:00.000Z`);

const condition: ConditionSuspensive = {
  seuil: { type: "pourcentage", bps: 5000 },
  prixTtcCents: 1_200_000,
  dateLimite: debutDuJourDeParis("2026-12-15"),
  signeeLe: new Date("2026-10-05T09:00:00Z"),
};
const APRES = new Date("2026-12-20T10:00:00Z");

describe("evenementsDepuisDossiers", () => {
  it("un accord écrit DATÉ du jour limite est dans le délai", () => {
    const e = evenementsDepuisDossiers([
      { accordEcritLe: jourDb("2026-12-15"), montantAccordeCents: 600_000, refuseAt: null },
    ]);
    expect(e).toEqual([
      { type: "accord_ecrit", le: debutDuJourDeParis("2026-12-15"), montantAccordeCents: 600_000 },
    ]);
    expect(evaluerConditionSuspensive(condition, e, APRES).etat).toBe("active");
  });

  it("un accord écrit daté du lendemain est hors délai", () => {
    const e = evenementsDepuisDossiers([
      { accordEcritLe: jourDb("2026-12-16"), montantAccordeCents: 600_000, refuseAt: null },
    ]);
    expect(evaluerConditionSuspensive(condition, e, APRES).etat).toBe("caduque");
  });

  it("un accord sans montant n'est pas compté ; un refus l'est", () => {
    expect(
      evenementsDepuisDossiers([
        { accordEcritLe: jourDb("2026-11-01"), montantAccordeCents: null, refuseAt: null },
      ]),
    ).toEqual([]);
    const refus = new Date("2026-11-02T10:00:00Z");
    expect(
      evenementsDepuisDossiers([
        { accordEcritLe: null, montantAccordeCents: null, refuseAt: refus },
      ]),
    ).toEqual([{ type: "refus", le: refus }]);
  });
});
