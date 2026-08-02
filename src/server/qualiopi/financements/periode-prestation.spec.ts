/**
 * Tests — date de réalisation de la prestation portée par la facture.
 *
 * L'enjeu n'est pas cosmétique : une facture qui affirme une date d'exécution
 * différente de la convention et de l'émargement du même dossier est ce qu'un
 * contrôle relève en premier (art. 242 nonies A ann. II CGI).
 */

import { describe, it, expect } from "vitest";
import { periodePrestationSession } from "./periode-prestation";

describe("periodePrestationSession", () => {
  it("session d'un jour : la date seule, jamais « du X au X »", () => {
    expect(
      periodePrestationSession({
        dateDebut: new Date("2026-07-31T09:00:00Z"),
        dateFin: new Date("2026-07-31T17:00:00Z"),
      }),
    ).toBe("31/07/2026");
  });

  it("session sur plusieurs jours : la période complète", () => {
    expect(
      periodePrestationSession({
        dateDebut: new Date("2026-07-31T09:00:00Z"),
        dateFin: new Date("2026-08-02T17:00:00Z"),
      }),
    ).toBe("du 31/07/2026 au 02/08/2026");
  });

  it("facture libre (aucune session) : undefined, on n'invente pas une date", () => {
    expect(periodePrestationSession(null)).toBeUndefined();
    expect(periodePrestationSession(undefined)).toBeUndefined();
  });

  it("dates absentes ou invalides : omission, JAMAIS d'exception", () => {
    // Une mention accessoire ne doit pas pouvoir faire échouer l'émission de la
    // facture : `select` restreint, date invalide venue d'un import…
    expect(periodePrestationSession({})).toBeUndefined();
    expect(periodePrestationSession({ dateDebut: null, dateFin: null })).toBeUndefined();
    expect(
      periodePrestationSession({ dateDebut: new Date("nawak"), dateFin: new Date("nawak") }),
    ).toBeUndefined();
  });

  it("la date vient de la SESSION, jamais de l'horloge d'émission", () => {
    // Le défaut d'origine : facture émise le 01/08 pour une journée tenue le
    // 31/07 → « Date de réalisation : 01/08 ». La session fait foi.
    const session = {
      dateDebut: new Date("2026-07-31T09:00:00Z"),
      dateFin: new Date("2026-07-31T17:00:00Z"),
    };
    expect(periodePrestationSession(session)).not.toContain("01/08");
  });
});
