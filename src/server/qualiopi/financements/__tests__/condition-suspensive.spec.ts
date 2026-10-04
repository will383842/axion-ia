/**
 * 🔴 TÉMOIN ROUGE — INT-T65-A (registre Partners) : machine d'états de la
 * condition suspensive de prise en charge par l'OPCO.
 *
 * Posé AVANT l'implémentation (coordination Partners, issue
 * axion-apporteurs#656, message du 2026-10-04 09:07 UTC) : il échoue tant que
 * `financements/condition-suspensive.ts` n'existe pas. Il passera au vert avec
 * la PR d'INT-T65-A, au signal de la coordination.
 *
 * Ce qu'il fixe, d'après la clause validée par Williams (2026-10-04 09:19 UTC) :
 *   - en_attente → active : accord ÉCRIT ≥ seuil, au plus tard à la date limite ;
 *   - en_attente → caduque : refus, accord inférieur notifié avant la date
 *     limite, ou date limite dépassée sans accord ;
 *   - renonciation du client avant accomplissement ou défaillance → active, la
 *     convention produisant ses effets à sa DATE DE SIGNATURE (C. civ. 1304-4) ;
 *   - un accord APRÈS la défaillance ne fait pas revivre la convention ;
 *   - seuil en % (points de base) rapporté au prix TTC de la convention, seuil
 *     en € comparé au montant accordé ; centimes ENTIERS, aucun flottant ;
 *   - la date limite est un JOUR DE PARIS (et non un jour UTC) ;
 *   - rappel à J-7 de la date limite, tant que la condition est en attente.
 */
import { describe, expect, it } from "vitest";

import {
  dateDuRappel,
  dateLimiteDepassee,
  evaluerConditionSuspensive,
  rappelDu,
  seuilAtteint,
  type ConditionSuspensive,
  type EvenementConditionSuspensive,
} from "../condition-suspensive";

const SIGNEE_LE = new Date("2026-10-05T09:00:00Z");

/** Convention à 12 000,00 € TTC, seuil 50 %, date limite au 15 décembre (hiver, UTC+1). */
const condition: ConditionSuspensive = {
  seuil: { type: "pourcentage", bps: 5000 },
  prixTtcCents: 1_200_000,
  dateLimite: "2026-12-15",
  signeeLe: SIGNEE_LE,
};

const AVANT = new Date("2026-11-20T10:00:00Z");
const APRES = new Date("2026-12-20T10:00:00Z");

function accord(le: string, montantAccordeCents: number): EvenementConditionSuspensive {
  return { type: "accord_ecrit", le: new Date(le), montantAccordeCents };
}
const refus = (le: string): EvenementConditionSuspensive => ({ type: "refus", le: new Date(le) });
const renonciation = (le: string): EvenementConditionSuspensive => ({
  type: "renonciation",
  le: new Date(le),
});

describe("condition suspensive OPCO — machine d'états", () => {
  it("sans événement et avant la date limite : en_attente", () => {
    expect(evaluerConditionSuspensive(condition, [], AVANT).etat).toBe("en_attente");
  });

  it("accord écrit ≥ seuil dans le délai → active, effets à la date de signature", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [accord("2026-11-10T10:00:00Z", 600_000)],
      AVANT,
    );
    expect(r.etat).toBe("active");
    expect(r.effetLe).toEqual(SIGNEE_LE);
  });

  it("refus de l'OPCO → caduque", () => {
    const r = evaluerConditionSuspensive(condition, [refus("2026-11-10T10:00:00Z")], AVANT);
    expect(r.etat).toBe("caduque");
    expect(r.effetLe).toBeNull();
  });

  it("accord inférieur au seuil, notifié avant la date limite → caduque", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [accord("2026-11-10T10:00:00Z", 599_999)],
      AVANT,
    );
    expect(r.etat).toBe("caduque");
  });

  it("date limite dépassée sans accord → caduque", () => {
    expect(evaluerConditionSuspensive(condition, [], APRES).etat).toBe("caduque");
  });

  it("renonciation du client avant accomplissement → active à la date de signature", () => {
    const r = evaluerConditionSuspensive(condition, [renonciation("2026-11-01T10:00:00Z")], AVANT);
    expect(r.etat).toBe("active");
    expect(r.effetLe).toEqual(SIGNEE_LE);
  });

  it("renonciation APRÈS la défaillance → reste caduque", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [refus("2026-11-01T10:00:00Z"), renonciation("2026-11-05T10:00:00Z")],
      AVANT,
    );
    expect(r.etat).toBe("caduque");
  });

  it("un accord APRÈS un refus ne fait pas revivre la convention", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [refus("2026-11-01T10:00:00Z"), accord("2026-11-10T10:00:00Z", 1_200_000)],
      AVANT,
    );
    expect(r.etat).toBe("caduque");
  });

  it("un accord APRÈS la date limite ne fait pas revivre la convention", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [accord("2026-12-18T10:00:00Z", 1_200_000)],
      APRES,
    );
    expect(r.etat).toBe("caduque");
  });

  it("les événements sont lus dans l'ordre CHRONOLOGIQUE, pas dans l'ordre reçu", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [accord("2026-11-10T10:00:00Z", 1_200_000), refus("2026-11-01T10:00:00Z")],
      AVANT,
    );
    expect(r.etat).toBe("caduque");
  });
});

describe("condition suspensive OPCO — seuil en centimes entiers", () => {
  it("en % : comparé au prix TTC de la convention (50 % de 12 000,00 €)", () => {
    const s = { type: "pourcentage", bps: 5000 } as const;
    expect(seuilAtteint(s, 1_200_000, 600_000)).toBe(true);
    expect(seuilAtteint(s, 1_200_000, 599_999)).toBe(false);
  });

  it("en % : arithmétique entière, sans arrondi flottant (33,33 % de 100,01 €)", () => {
    // 3333 × 10001 = 33 333 333 ; 3334 × 10000 = 33 340 000 ≥ ; 3333 × 10000 = 33 330 000 <
    const s = { type: "pourcentage", bps: 3333 } as const;
    expect(seuilAtteint(s, 10_001, 3_334)).toBe(true);
    expect(seuilAtteint(s, 10_001, 3_333)).toBe(false);
  });

  it("en € : comparé au montant accordé", () => {
    const s = { type: "montant", cents: 300_000 } as const;
    expect(seuilAtteint(s, 1_200_000, 300_000)).toBe(true);
    expect(seuilAtteint(s, 1_200_000, 299_999)).toBe(false);
  });

  it("refuse un montant qui n'est pas un nombre ENTIER de centimes", () => {
    expect(() => seuilAtteint({ type: "montant", cents: 300_000 }, 1_200_000, 2999.5)).toThrow(
      RangeError,
    );
    expect(() => seuilAtteint({ type: "montant", cents: 0.5 }, 1_200_000, 1)).toThrow(RangeError);
    expect(() => seuilAtteint({ type: "pourcentage", bps: 5000 }, 1_200_000.5, 1)).toThrow(
      RangeError,
    );
  });

  it("refuse un pourcentage hors de 1 à 10 000 points de base", () => {
    expect(() => seuilAtteint({ type: "pourcentage", bps: 0 }, 1_200_000, 1)).toThrow(RangeError);
    expect(() => seuilAtteint({ type: "pourcentage", bps: 10_001 }, 1_200_000, 1)).toThrow(
      RangeError,
    );
  });
});

describe("condition suspensive OPCO — la date limite est un jour de Paris", () => {
  it("hiver (UTC+1) : le 15 décembre court jusqu'à 22:59:59 UTC", () => {
    expect(dateLimiteDepassee("2026-12-15", new Date("2026-12-15T22:59:59Z"))).toBe(false);
    expect(dateLimiteDepassee("2026-12-15", new Date("2026-12-15T23:00:00Z"))).toBe(true);
  });

  it("été (UTC+2) : le 31 juillet court jusqu'à 21:59:59 UTC", () => {
    expect(dateLimiteDepassee("2027-07-31", new Date("2027-07-31T21:59:59Z"))).toBe(false);
    expect(dateLimiteDepassee("2027-07-31", new Date("2027-07-31T22:00:00Z"))).toBe(true);
  });

  it("un accord reçu à 23:30 heure de Paris le dernier jour est DANS le délai", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [accord("2026-12-15T22:30:00Z", 600_000)],
      APRES,
    );
    expect(r.etat).toBe("active");
  });

  it("un accord reçu à 00:30 heure de Paris le lendemain est HORS délai", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [accord("2026-12-15T23:30:00Z", 600_000)],
      APRES,
    );
    expect(r.etat).toBe("caduque");
  });
});

describe("condition suspensive OPCO — rappel J-7", () => {
  it("le rappel tombe sept jours avant la date limite", () => {
    expect(dateDuRappel("2026-12-15")).toBe("2026-12-08");
    expect(dateDuRappel("2027-03-03")).toBe("2027-02-24");
  });

  it("dû à partir du J-7 (jour de Paris) tant que la condition est en attente", () => {
    expect(rappelDu(condition, [], new Date("2026-12-07T22:59:59Z"))).toBe(false);
    expect(rappelDu(condition, [], new Date("2026-12-07T23:00:00Z"))).toBe(true);
    expect(rappelDu(condition, [], new Date("2026-12-15T12:00:00Z"))).toBe(true);
  });

  it("jamais dû quand la condition est accomplie, levée ou défaillie", () => {
    const le = new Date("2026-12-10T10:00:00Z");
    expect(rappelDu(condition, [accord("2026-12-01T10:00:00Z", 600_000)], le)).toBe(false);
    expect(rappelDu(condition, [renonciation("2026-12-01T10:00:00Z")], le)).toBe(false);
    expect(rappelDu(condition, [refus("2026-12-01T10:00:00Z")], le)).toBe(false);
    expect(rappelDu(condition, [], APRES)).toBe(false);
  });
});
