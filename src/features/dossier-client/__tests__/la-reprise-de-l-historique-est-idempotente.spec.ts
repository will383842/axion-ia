// @vitest-environment node
/**
 * La reprise de l'historique est IDEMPOTENTE : un second lancement ne crée
 * ni rencontre, ni fait, ni suivi. À blanc (par défaut), elle ne crée rien du
 * tout et compte ce qu'elle ferait. Le point déjà fait (`RendezVousSuivi`)
 * est repris par la fonction unique `enregistrerSuivi()` ; un ancien point
 * incomplet (« a eu lieu » sans suite) est compté, pas inventé.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { reprendreHistoriqueCalendly } from "../reprise-historique";
import { CLE_TEST, dossierEnMemoire, rendezVousCalendly } from "./_dossier-en-memoire";

const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

const BORNE = new Date("2026-10-03T10:00:00Z");

function scene() {
  const a = rendezVousCalendly({
    startTime: new Date("2026-09-10T08:00:00Z"),
    rawPayload: {
      invitee: { questions_and_answers: [{ question: "Votre besoin", answer: "Un audit" }] },
    },
  });
  const b = rendezVousCalendly({ startTime: new Date("2026-09-12T08:00:00Z") });
  const c = rendezVousCalendly({ startTime: new Date("2026-09-13T08:00:00Z") });
  return dossierEnMemoire({
    calendlyEvent: [a, b, c],
    battementCircuit: [
      {
        nom: "balayage",
        premierLe: BORNE,
        dernierLe: BORNE,
        drapeauVuParWorker: "true",
        version: "x",
      },
    ],
    rendezVousSuivi: [
      {
        id: "s1",
        calendlyEventId: b["id"],
        issue: "eu_lieu",
        suite: "relance",
        suiteLe: new Date("2026-09-20T00:00:00Z"),
        note: null,
      },
      {
        id: "s2",
        calendlyEventId: c["id"],
        issue: "eu_lieu",
        suite: null,
        suiteLe: null,
        note: null,
      },
    ],
  });
}

describe("la reprise de l'historique est idempotente", () => {
  it("à blanc : rien d'écrit, trois éligibles", async () => {
    const base = scene();
    const bilan = await reprendreHistoriqueCalendly(base.client as never, { appliquer: false });
    expect(bilan.eligibles).toBe(3);
    expect(bilan.rencontresCreees).toBe(0);
    expect(base.tables["rencontre"] ?? []).toHaveLength(0);
  });

  it("réel, puis second lancement : rien de plus", async () => {
    const base = scene();
    const un = await reprendreHistoriqueCalendly(base.client as never, { appliquer: true });
    expect(un).toMatchObject({
      rencontresCreees: 3,
      faitsCrees: 1,
      suivisRepris: 1,
      suivisIncomplets: 1,
    });
    const deux = await reprendreHistoriqueCalendly(base.client as never, { appliquer: true });
    expect(deux).toMatchObject({
      rencontresCreees: 0,
      dejaReprises: 3,
      faitsCrees: 0,
      suivisRepris: 0,
    });
    expect(base.tables["rencontre"]).toHaveLength(3);
    expect(base.tables["fait"]).toHaveLength(1);
    expect(base.tables["rencontreSuivi"]).toHaveLength(1);
  });
});
