/**
 * G4 — UNE DATE RELATIVE EST RECALCULÉE PAR LE CODE, jamais reprise de l'IA.
 *
 * L'expression exacte doit être dans la citation ; la date cible est
 * recalculée depuis la date de l'échange (mardi 6 octobre 2026). Une date de
 * l'IA qui diffère ⇒ rejet ; une expression illisible garde ses mots, sans
 * date (jamais une date inventée).
 */

import { describe, expect, it } from "vitest";

import { recalculerDate } from "../g04-valeurs";
import { avec, DATE_ECHANGE, FAITS, leFait, verifier } from "./outils";

describe("une date relative est recalculée par le code", () => {
  it("la date du scénario est celle du code (15/12/2026, avant le)", () => {
    expect(leFait(verifier(FAITS), "F03")).toMatchObject({
      dateCible: "2026-12-15",
      precisionDate: "avant_le",
    });
  });

  it("une date de l'IA différente de celle du code → valeur_non_prouvee", () => {
    const b = verifier(avec("F03", { valeur: { ...FAITS[2]!.valeur, date_cible: "2027-12-15" } }));
    expect(leFait(b, "F03")).toMatchObject({ statut: "rejete", motif: "valeur_non_prouvee" });
  });

  it("des expressions courantes, depuis le mardi 6 octobre 2026", () => {
    expect(recalculerDate("jeudi", DATE_ECHANGE)).toEqual({
      date: "2026-10-08",
      precision: "jour",
    });
    expect(recalculerDate("fin janvier", DATE_ECHANGE)).toEqual({
      date: "2027-01-31",
      precision: "mois",
    });
    expect(recalculerDate("au printemps", DATE_ECHANGE)).toEqual({
      date: "2027-03-20",
      precision: "trimestre",
    });
    expect(recalculerDate("dans deux semaines", DATE_ECHANGE)).toEqual({
      date: "2026-10-20",
      precision: "semaine",
    });
    expect(recalculerDate("le 3 mars", DATE_ECHANGE)).toEqual({
      date: "2027-03-03",
      precision: "jour",
    });
  });

  it("contre-témoin : une expression illisible garde ses mots, sans date", () => {
    const b = verifier(
      avec("F03", {
        valeur: {
          ...FAITS[2]!.valeur,
          date_cible: null,
          precision_date: null,
          expression_temporelle: "que ce soit fait",
        },
      }),
    );
    expect(leFait(b, "F03")).toMatchObject({ statut: "propose", dateCible: null });
    expect(leFait(b, "F03").ambiguite).toMatch(/date non recalculée/);
  });
});
