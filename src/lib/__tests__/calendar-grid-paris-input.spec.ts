// Conversion Europe/Paris ⇄ UTC pour les champs `datetime-local` (2026-07-29).
//
// Régression constatée EN PRODUCTION sur la première réservation Calendly
// enrichie : la liste affichait 11:30 (correct, via `timeInParis`) pendant que
// la fiche d'édition affichait 09:30 — l'heure UTC servie telle quelle à un
// `<input type="datetime-local">`, que l'utilisateur lit comme heure locale.
//
// Le pire n'était pas l'affichage mais l'ENREGISTREMENT : `new Date("…T09:30")`
// est interprété dans le fuseau du navigateur, donc un aller-retour sans la
// moindre modification décalait le créneau. D'où des tests qui vérifient la
// réciprocité, pas seulement le rendu.

import { describe, it, expect } from "vitest";
import { toParisLocalInput, fromParisLocalInput } from "../calendar-grid";

describe("toParisLocalInput", () => {
  it("heure d'été (UTC+2) — 09:30Z s'affiche 11:30", () => {
    expect(toParisLocalInput(new Date("2026-07-23T09:30:00Z"))).toBe("2026-07-23T11:30");
  });

  it("heure d'hiver (UTC+1) — 09:30Z s'affiche 10:30", () => {
    expect(toParisLocalInput(new Date("2026-01-15T09:30:00Z"))).toBe("2026-01-15T10:30");
  });

  it("passe au jour suivant quand le décalage franchit minuit", () => {
    expect(toParisLocalInput(new Date("2026-07-23T22:30:00Z"))).toBe("2026-07-24T00:30");
  });
});

describe("fromParisLocalInput", () => {
  it("heure d'été — 11:30 à Paris vaut 09:30Z", () => {
    expect(fromParisLocalInput("2026-07-23T11:30")?.toISOString()).toBe("2026-07-23T09:30:00.000Z");
  });

  it("heure d'hiver — 10:30 à Paris vaut 09:30Z", () => {
    expect(fromParisLocalInput("2026-01-15T10:30")?.toISOString()).toBe("2026-01-15T09:30:00.000Z");
  });

  it("saisie vide ou illisible → null, jamais d'Invalid Date", () => {
    expect(fromParisLocalInput("")).toBeNull();
    expect(fromParisLocalInput("pas une date")).toBeNull();
  });

  it("tolère une valeur avec secondes (certains navigateurs les ajoutent)", () => {
    expect(fromParisLocalInput("2026-07-23T11:30:00")?.toISOString()).toBe(
      "2026-07-23T09:30:00.000Z",
    );
  });
});

// Le cœur du correctif : ouvrir une fiche puis l'enregistrer sans rien changer
// ne doit PAS déplacer le rendez-vous. C'est ce que faisait l'ancien code, de
// deux heures, à chaque enregistrement.
describe("réciprocité — un aller-retour ne déplace jamais le créneau", () => {
  it.each([
    ["plein été", "2026-07-23T09:30:00.000Z"],
    ["plein hiver", "2026-01-15T09:30:00.000Z"],
    ["veille du passage à l'heure d'été", "2026-03-28T10:00:00.000Z"],
    ["lendemain du passage à l'heure d'hiver", "2026-10-26T10:00:00.000Z"],
    ["minuit UTC", "2026-07-23T00:00:00.000Z"],
    ["23h59 UTC", "2026-12-31T23:59:00.000Z"],
  ])("%s", (_label, iso) => {
    const round = fromParisLocalInput(toParisLocalInput(new Date(iso)));
    expect(round?.toISOString()).toBe(iso);
  });
});
