/**
 * ⛔ AVANT LA PR 8, `OUVERT` VAUT `PILOTE` (PR 5, décision B3).
 *
 * Un client actif existe (mesuré le 28/09) : le préavis de 30 jours
 * s'applique. Tant que `PREAVIS_SOUS_TRAITANTS` vaut `null` (la PR 8 pose la
 * date réelle d'envoi), ou que sa fin n'est pas atteinte, poser
 * `ENREGISTREMENT_VISIO_OUVERT=true` n'ouvre RIEN : seul le rendez-vous de
 * test s'enregistre.
 *
 * Mutation qui rougit : dans `lireDrapeauEnregistrement`, rendre
 * `effectif: demande` sans regarder le préavis → le 1er cas rend `ouvert`.
 * Contre-témoin : un préavis échu ouvre réellement.
 * Angle mort : la date elle-même (relevée dans `email_outbox`) est posée par
 * la PR 8 ; ici, la seule règle.
 */

import { describe, expect, it } from "vitest";

import { lireDrapeauEnregistrement, PREAVIS_SOUS_TRAITANTS } from "../drapeau";

const T = new Date("2026-10-06T08:00:00.000Z");

describe("⛔ avant la PR 8, ouvert vaut pilote", () => {
  it("le préavis n'est pas encore posé dans le code", () => {
    expect(PREAVIS_SOUS_TRAITANTS).toBeNull();
  });

  it("OUVERT=true sans préavis : effectif « pilote », avec le motif", () => {
    const d = lireDrapeauEnregistrement({ ENREGISTREMENT_VISIO_OUVERT: "true" }, T);
    expect(d.demande).toBe("ouvert");
    expect(d.effectif).toBe("pilote");
    expect(d.motif).toMatch(/préavis/);
  });

  it("préavis envoyé mais pas échu : toujours « pilote »", () => {
    const d = lireDrapeauEnregistrement({ ENREGISTREMENT_VISIO_OUVERT: "true" }, T, {
      envoyeLe: "2026-10-01T00:00:00.000Z",
      finLe: "2026-10-31T00:00:00.000Z",
    });
    expect(d.effectif).toBe("pilote");
  });

  it("contre-témoin : préavis échu → « ouvert »", () => {
    const d = lireDrapeauEnregistrement({ ENREGISTREMENT_VISIO_OUVERT: "true" }, T, {
      envoyeLe: "2026-09-01T00:00:00.000Z",
      finLe: "2026-10-01T00:00:00.000Z",
    });
    expect(d.effectif).toBe("ouvert");
  });

  it("rien de posé, ou une valeur mal saisie : « ferme »", () => {
    expect(lireDrapeauEnregistrement({}, T).effectif).toBe("ferme");
    expect(lireDrapeauEnregistrement({ ENREGISTREMENT_VISIO_OUVERT: "oui" }, T).effectif).toBe(
      "ferme",
    );
    expect(lireDrapeauEnregistrement({ ENREGISTREMENT_VISIO_PILOTE: "true" }, T).effectif).toBe(
      "pilote",
    );
  });
});
