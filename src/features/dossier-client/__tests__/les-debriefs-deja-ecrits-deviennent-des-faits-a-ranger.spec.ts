// @vitest-environment node
/**
 * Correction anti-doublon A4 : les débriefs déjà écrits (`CalendlyEvent.notes`,
 * `RendezVousSuivi.note`) ne sont ni perdus ni ressaisis. « Après l'appel » les
 * affiche (règle unique `debriefsExistants`), et la reprise de l'historique en
 * fait des faits « à ranger », PROPOSÉS, chiffrés — jamais validés à la place
 * de Will. Contre-témoin : sans débrief, aucun fait de plus.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { debriefsExistants } from "../debriefs-existants";
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

function scene(notes: string | null, noteDuPoint: string | null) {
  const a = rendezVousCalendly({ startTime: new Date("2026-09-10T08:00:00Z"), notes });
  return dossierEnMemoire({
    calendlyEvent: [a],
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
        calendlyEventId: a["id"],
        issue: "eu_lieu",
        suite: "relance",
        suiteLe: new Date("2026-09-20T00:00:00Z"),
        note: noteDuPoint,
      },
    ],
  });
}

describe("les débriefs déjà écrits deviennent des faits à ranger", () => {
  it("la règle unique : vides écartés, doublon exact fusionné, ordre stable", () => {
    expect(debriefsExistants({ notesCalendly: "  ", noteDuPoint: null })).toEqual([]);
    expect(debriefsExistants({ notesCalendly: "Budget OK", noteDuPoint: "Budget OK" })).toEqual([
      { origine: "notes_calendly", texte: "Budget OK" },
    ]);
    expect(
      debriefsExistants({ notesCalendly: "Budget OK", noteDuPoint: "Rappeler en janvier" }).map(
        (d) => d.origine,
      ),
    ).toEqual(["notes_calendly", "point_rendez_vous"]);
  });

  it("la reprise en fait deux faits proposés, à ranger, chiffrés", async () => {
    const base = scene("Budget validé par la DG", "Rappeler en janvier");
    const bilan = await reprendreHistoriqueCalendly(base.client as never, { appliquer: true });
    expect(bilan.faitsCrees).toBe(2);
    const faits = (base.tables["fait"] ?? []) as Array<Record<string, unknown>>;
    expect(faits).toHaveLength(2);
    for (const f of faits) {
      expect(f["portee"]).toBe("a_ranger");
      expect(f["statut"]).toBe("propose");
      expect(f["clientId"]).toBeNull();
      expect(f["enonce"]).not.toMatch(/Budget|Rappeler/);
    }
    expect(faits.map((f) => dechiffrerParole(f["enonce"] as string))).toEqual([
      "Budget validé par la DG",
      "Rappeler en janvier",
    ]);
  });

  it("contre-témoin : sans débrief, aucun fait", async () => {
    const base = scene(null, null);
    const bilan = await reprendreHistoriqueCalendly(base.client as never, { appliquer: true });
    expect(bilan.faitsCrees).toBe(0);
    expect(base.tables["fait"] ?? []).toHaveLength(0);
  });
});
