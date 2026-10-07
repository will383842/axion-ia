/**
 * INT-T65-A (registre Partners, REQ-JUR-061) : machine d'états de la
 * condition suspensive de prise en charge par l'OPCO.
 *
 * Posé ROUGE avant l'implémentation (coordination Partners, issue
 * axion-apporteurs#656, message du 2026-10-04 09:07 UTC), passé au vert avec
 * la PR d'INT-T65-A (signal du rattrapage 105, commentaire 5979459198).
 *
 * Ce qu'il fixe, d'après la clause validée par Williams (2026-10-04 09:19 UTC) :
 *   - en_attente → active : accord ÉCRIT ≥ seuil, au plus tard à la date limite ;
 *   - en_attente → caduque : refus, accord inférieur notifié avant la date
 *     limite, ou date limite dépassée sans accord ;
 *   - renonciation du client avant accomplissement ou défaillance → active, la
 *     convention produisant ses effets à sa DATE DE SIGNATURE (C. civ. 1304-4) ;
 *   - un accord APRÈS la défaillance ne fait pas revivre la convention ;
 *   - seuil en % (points de base) rapporté au prix HORS TAXES de la convention, seuil
 *     en € comparé au montant accordé ; centimes ENTIERS, aucun flottant ;
 *   - la date limite est un JOUR CIVIL DE PARIS (remarque de la juriste A07,
 *     #656 commentaire 5979338659) : on stocke l'instant de 00:00 heure de
 *     Paris, la borne est la FIN de ce jour (minuit exclusif) ;
 *   - rappel à J-7 de la date limite, tant que la condition est en attente.
 */
import { describe, expect, it } from "vitest";

import {
  bpsDepuisSaisie,
  centimesDepuisSaisie,
  dateDuRappel,
  debutDuJourDeParis,
  euroDepuisCentimes,
  libelleJourLimite,
  libelleSeuilClause,
  pourcentageDepuisBps,
  seuilDepuisColonnes,
  transitionAutorisee,
  dateLimiteDepassee,
  evaluerConditionSuspensive,
  rappelDu,
  seuilAtteint,
  type ConditionSuspensive,
  type EvenementConditionSuspensive,
} from "../condition-suspensive";

const SIGNEE_LE = new Date("2026-10-05T09:00:00Z");

/** Convention à 12 000,00 € HT, seuil 50 %, date limite au 15 décembre (hiver, UTC+1). */
const condition: ConditionSuspensive = {
  seuil: { type: "pourcentage", bps: 5000 },
  prixHtCents: 1_200_000,
  dateLimite: debutDuJourDeParis("2026-12-15"),
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
  it("en % : comparé au prix HT de la convention (50 % de 12 000,00 € HT)", () => {
    const s = { type: "pourcentage", bps: 5000 } as const;
    expect(seuilAtteint(s, 1_200_000, 600_000)).toBe(true);
    expect(seuilAtteint(s, 1_200_000, 599_999)).toBe(false);
  });

  it("🔴 la base est le HT, pas le TTC (correction de la juriste, décision de Williams)", () => {
    // Convention à 10 000,00 € HT, soit 12 000,00 € TTC à 20 %. Seuil 50 %.
    // Un accord de 5 000,00 € atteint 50 % du HT ; il n'atteindrait pas 50 % du TTC.
    const s = { type: "pourcentage", bps: 5000 } as const;
    const prixHtCents = 1_000_000;
    expect(seuilAtteint(s, prixHtCents, 500_000)).toBe(true);
    expect(seuilAtteint(s, prixHtCents, 499_999)).toBe(false);
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

describe("condition suspensive OPCO — la date limite est un jour civil de Paris", () => {
  it("on stocke l'instant de 00:00 heure de Paris du jour limite (hiver et été)", () => {
    expect(debutDuJourDeParis("2026-12-15").toISOString()).toBe("2026-12-14T23:00:00.000Z");
    expect(debutDuJourDeParis("2027-07-31").toISOString()).toBe("2027-07-30T22:00:00.000Z");
    expect(libelleJourLimite(debutDuJourDeParis("2026-12-15"))).toBe("15/12/2026");
    expect(libelleJourLimite(debutDuJourDeParis("2027-07-31"))).toBe("31/07/2027");
  });

  it("hiver (UTC+1) : le 15 décembre court jusqu'à 22:59:59 UTC", () => {
    const limite = debutDuJourDeParis("2026-12-15");
    expect(dateLimiteDepassee(limite, new Date("2026-12-15T22:59:59Z"))).toBe(false);
    expect(dateLimiteDepassee(limite, new Date("2026-12-15T23:00:00Z"))).toBe(true);
  });

  it("été (UTC+2) : le 31 juillet court jusqu'à 21:59:59 UTC", () => {
    const limite = debutDuJourDeParis("2027-07-31");
    expect(dateLimiteDepassee(limite, new Date("2027-07-31T21:59:59Z"))).toBe(false);
    expect(dateLimiteDepassee(limite, new Date("2027-07-31T22:00:00Z"))).toBe(true);
  });

  // 🔴 Le témoin à deux faces demandé par la juriste : 23h59 heure de Paris le
  // jour limite → DANS le délai ; 00h00 le lendemain → HORS délai.
  it("HIVER — accord reçu à 23h59 heure de Paris le jour limite : DANS le délai", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [accord("2026-12-15T22:59:00Z", 600_000)], // 23:59 à Paris (UTC+1)
      APRES,
    );
    expect(r.etat).toBe("active");
  });

  it("HIVER — accord reçu à 00h00 heure de Paris le lendemain : HORS délai", () => {
    const r = evaluerConditionSuspensive(
      condition,
      [accord("2026-12-15T23:00:00Z", 600_000)], // 00:00 le 16 à Paris
      APRES,
    );
    expect(r.etat).toBe("caduque");
    expect(r.cause).toBe("delai_depasse");
  });

  const ete: ConditionSuspensive = { ...condition, dateLimite: debutDuJourDeParis("2027-07-31") };
  const APRES_ETE = new Date("2027-08-10T10:00:00Z");

  it("ÉTÉ — accord reçu à 23h59 heure de Paris le jour limite : DANS le délai", () => {
    const r = evaluerConditionSuspensive(
      ete,
      [accord("2027-07-31T21:59:00Z", 600_000)], // 23:59 à Paris (UTC+2)
      APRES_ETE,
    );
    expect(r.etat).toBe("active");
  });

  it("ÉTÉ — accord reçu à 00h00 heure de Paris le lendemain : HORS délai", () => {
    const r = evaluerConditionSuspensive(
      ete,
      [accord("2027-07-31T22:00:00Z", 600_000)], // 00:00 le 1er août à Paris
      APRES_ETE,
    );
    expect(r.etat).toBe("caduque");
  });

  it("la borne ne dépend pas de l'heure stockée dans le jour limite", () => {
    // Un instant stocké à midi (Paris) du même jour donne la même borne.
    const midi = new Date("2026-12-15T11:00:00Z");
    expect(dateLimiteDepassee(midi, new Date("2026-12-15T22:59:59Z"))).toBe(false);
    expect(dateLimiteDepassee(midi, new Date("2026-12-15T23:00:00Z"))).toBe(true);
  });

  it("refuse un jour qui n'existe pas", () => {
    expect(() => debutDuJourDeParis("2027-02-30")).toThrow(RangeError);
  });
});

describe("condition suspensive OPCO — rappel J-7", () => {
  it("le rappel tombe sept jours avant la date limite", () => {
    expect(dateDuRappel(debutDuJourDeParis("2026-12-15"))).toBe("2026-12-08");
    expect(dateDuRappel(debutDuJourDeParis("2027-03-03"))).toBe("2027-02-24");
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

describe("condition suspensive OPCO — états fermés", () => {
  it("seules les transitions depuis en_attente sont permises", () => {
    expect(transitionAutorisee("en_attente", "active")).toBe(true);
    expect(transitionAutorisee("en_attente", "caduque")).toBe(true);
    // Une convention caduque ne revit pas : on en conclut une NOUVELLE.
    expect(transitionAutorisee("caduque", "active")).toBe(false);
    expect(transitionAutorisee("active", "caduque")).toBe(false);
    expect(transitionAutorisee("en_attente", "en_attente")).toBe(false);
  });

  it("le seuil se lit sur les colonnes : exactement un, sinon rien", () => {
    expect(seuilDepuisColonnes({ seuilConditionBps: 5000, seuilConditionCents: null })).toEqual({
      type: "pourcentage",
      bps: 5000,
    });
    expect(seuilDepuisColonnes({ seuilConditionBps: null, seuilConditionCents: 300_000 })).toEqual({
      type: "montant",
      cents: 300_000,
    });
    expect(seuilDepuisColonnes({ seuilConditionBps: 5000, seuilConditionCents: 1 })).toBeNull();
    expect(seuilDepuisColonnes({ seuilConditionBps: null, seuilConditionCents: null })).toBeNull();
  });
});

describe("condition suspensive OPCO — paramètres de la clause, sans flottant", () => {
  it("{seuil} en pourcentage nomme sa base ; en montant, des euros et des centimes", () => {
    expect(libelleSeuilClause({ type: "pourcentage", bps: 5000 })).toBe(
      "50 % du prix hors taxes de la présente convention",
    );
    expect(libelleSeuilClause({ type: "montant", cents: 300_000 })).toBe("3 000,00 € hors taxes");
    expect(pourcentageDepuisBps(6250)).toBe("62,5");
    expect(pourcentageDepuisBps(3333)).toBe("33,33");
    expect(pourcentageDepuisBps(5005)).toBe("50,05");
    expect(euroDepuisCentimes(150_050)).toBe("1 500,50 €");
    expect(euroDepuisCentimes(1)).toBe("0,01 €");
  });

  it("la saisie française devient un ENTIER (points de base ou centimes)", () => {
    expect(bpsDepuisSaisie("50")).toBe(5000);
    expect(bpsDepuisSaisie("62,5")).toBe(6250);
    expect(bpsDepuisSaisie("33.33")).toBe(3333);
    expect(bpsDepuisSaisie("0")).toBeNull();
    expect(bpsDepuisSaisie("100,01")).toBeNull();
    expect(bpsDepuisSaisie("12,345")).toBeNull();
    expect(centimesDepuisSaisie("1 500,50")).toBe(150_050);
    expect(centimesDepuisSaisie("0,1")).toBe(10);
    expect(centimesDepuisSaisie("0")).toBeNull();
    expect(centimesDepuisSaisie("abc")).toBeNull();
    expect(centimesDepuisSaisie("-5")).toBeNull();
  });
});
