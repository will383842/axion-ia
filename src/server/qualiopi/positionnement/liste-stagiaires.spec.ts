import { describe, expect, it } from "vitest";
import { gesteListeStagiaires, RELANCES_LISTE_MAX, type EtatListe } from "./liste-stagiaires";

const J = 24 * 60 * 60 * 1000;
const maintenant = new Date("2026-11-02T08:00:00Z");
const etat = (e: Partial<EtatListe> = {}): EtatListe => ({
  envois: 0,
  dernierEnvoiLe: null,
  inscrits: 0,
  prevus: 5,
  dateDebut: new Date(maintenant.getTime() + 20 * J),
  maintenant,
  ...e,
});

describe("demande de la liste des stagiaires à l'entreprise", () => {
  it("jamais demandée : on demande", () => {
    expect(gesteListeStagiaires(etat())).toBe("demander");
  });

  it("liste complète ou session commencée : plus rien", () => {
    expect(gesteListeStagiaires(etat({ inscrits: 5 }))).toBe("rien");
    expect(gesteListeStagiaires(etat({ dateDebut: maintenant }))).toBe("rien");
  });

  it("relance après trois jours, plafond de deux relances", () => {
    const hier = new Date(maintenant.getTime() - J);
    const ilYa3j = new Date(maintenant.getTime() - 3 * J);
    expect(gesteListeStagiaires(etat({ envois: 1, dernierEnvoiLe: hier }))).toBe("rien");
    expect(gesteListeStagiaires(etat({ envois: 1, dernierEnvoiLe: ilYa3j }))).toBe("relancer");
    expect(
      gesteListeStagiaires(etat({ envois: 1 + RELANCES_LISTE_MAX, dernierEnvoiLe: ilYa3j })),
    ).toBe("rien");
  });
});
