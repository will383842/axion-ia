// @vitest-environment node

/**
 * Vérification 1, défaut V1-C-3 — le calcul mensuel OUBLIÉ est signalé à J+5.
 *
 * Avant : l'alerte de J+5 ne comptait que des relevés EXISTANTS non validés ; quand
 * personne n'avait lancé le calcul, il n'y en avait aucun, et elle se taisait.
 * Après : à partir du 1er + 5 jours (heure de Paris), si le mois écoulé a des
 * prestations à payer au relevé mensuel mais AUCUN relevé mensuel, l'alerte part.
 * Jamais de validation automatique : la règle ne fait que dire « alerter ».
 */

import { describe, expect, it } from "vitest";

import { alerteReleveNonLance } from "../releve-mensuel-auto";

describe("alerteReleveNonLance (pur)", () => {
  const rien = { relevesMensuelsDuMois: 0, relevesAPreparer: 2 };

  it("le 5 décembre (J+4) : pas encore ; le 6 (J+5) : oui", () => {
    expect(alerteReleveNonLance(new Date("2039-12-05T07:15:00Z"), rien)).toBe(false);
    expect(alerteReleveNonLance(new Date("2039-12-06T07:15:00Z"), rien)).toBe(true);
  });

  it("le 5 à 23 h 30 heure de Paris (22 h 30 UTC) : encore J+4", () => {
    expect(alerteReleveNonLance(new Date("2039-12-05T22:30:00Z"), rien)).toBe(false);
    // 6 décembre 0 h 30 à Paris = 5 décembre 23 h 30 UTC.
    expect(alerteReleveNonLance(new Date("2039-12-05T23:30:00Z"), rien)).toBe(true);
  });

  it("calcul lancé (au moins un relevé mensuel du mois) : l'autre alerte s'en charge", () => {
    expect(
      alerteReleveNonLance(new Date("2039-12-06T07:15:00Z"), {
        relevesMensuelsDuMois: 1,
        relevesAPreparer: 2,
      }),
    ).toBe(false);
  });

  it("aucune prestation à payer le mois écoulé : rien à signaler", () => {
    expect(
      alerteReleveNonLance(new Date("2039-12-06T07:15:00Z"), {
        relevesMensuelsDuMois: 0,
        relevesAPreparer: 0,
      }),
    ).toBe(false);
  });
});
