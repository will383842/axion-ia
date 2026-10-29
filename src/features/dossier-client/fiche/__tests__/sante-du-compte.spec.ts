import { describe, expect, it } from "vitest";

import { SEUIL_ECHANGE_JOURS, joursEntre, santeDuCompte } from "../sante-du-compte";

const MAINTENANT = new Date("2026-10-29T12:00:00Z");
const ilYA = (jours: number): Date => new Date(MAINTENANT.getTime() - jours * 86_400_000);
const base = { maintenant: MAINTENANT, nbFacturesEnRetard: 0, nbTachesEnRetard: 0 };

describe("santeDuCompte", () => {
  it("le seuil est de 14 jours", () => expect(SEUIL_ECHANGE_JOURS).toBe(14));
  it("13 jours : bonne", () => {
    expect(santeDuCompte({ ...base, dernierEchangeLe: ilYA(13) })).toEqual({
      niveau: "bonne",
      raisons: [],
    });
  });
  it("15 jours : à surveiller, avec la raison", () => {
    expect(santeDuCompte({ ...base, dernierEchangeLe: ilYA(15) })).toEqual({
      niveau: "a_surveiller",
      raisons: ["aucun échange depuis 15 jours"],
    });
  });
  it("minuit à Paris change de jour", () => {
    // 22:30 UTC le 28/10 = 23h30 à Paris (heure d'été finie le 25/10 : UTC+1) ; 23:30 UTC = minuit 30 le 29.
    expect(joursEntre(new Date("2026-10-28T22:30:00Z"), new Date("2026-10-28T23:30:00Z"))).toBe(1);
    expect(joursEntre(new Date("2026-10-28T22:30:00Z"), new Date("2026-10-28T22:59:00Z"))).toBe(0);
  });
  it("une facture en retard", () => {
    const s = santeDuCompte({ ...base, dernierEchangeLe: ilYA(1), nbFacturesEnRetard: 1 });
    expect(s).toEqual({ niveau: "a_surveiller", raisons: ["1 facture en retard"] });
  });
  it("des tâches en retard", () => {
    const s = santeDuCompte({ ...base, dernierEchangeLe: ilYA(1), nbTachesEnRetard: 2 });
    expect(s.raisons).toEqual(["2 tâches en retard"]);
  });
  it("aucun échange connu : à surveiller", () => {
    expect(santeDuCompte({ ...base, dernierEchangeLe: null })).toEqual({
      niveau: "a_surveiller",
      raisons: ["aucun échange"],
    });
  });
});
