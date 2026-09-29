/**
 * Les rencontres saisies dans la console (visio) sont renvoyées par
 * `rencontres-du-jour`, à côté des « Discutons » Calendly, dans la fenêtre de
 * −3 h à +12 h (PR 5). Rien du dossier n'est lu ; le client n'est que proposé.
 * Hors fenêtre, apporteurs et types hors liste blanche : absents.
 *
 * Changement d'heure du 25/10/2026 : la fenêtre est calculée en instants
 * absolus, une rencontre à +11 h 30 la nuit du passage reste dedans.
 */

import { describe, expect, it } from "vitest";

import { listerRencontresDuJour } from "../liste-enregistreur";
import {
  CLE_DE_TEST,
  commePrisma,
  fausseBase,
  MINUTE,
  semerRencontreCalendly,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("les rencontres saisies sont renvoyées par rencontres-du-jour", () => {
  it("mode ouvert : saisie visio + Discutons Calendly (créé à la demande), ni apporteur ni hors fenêtre", async () => {
    process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
    const db = fausseBase();
    const saisie = semerRencontreTest(db, {
      estTestInterne: false,
      debutPrevu: new Date(T0.getTime() + 60 * MINUTE),
    });
    // Un « Discutons » Calendly SANS rencontre : elle est créée à la demande.
    const cal = semerRencontreCalendly(db, {
      avecRencontre: false,
      startTime: new Date(T0.getTime() + 120 * MINUTE),
    });
    semerRencontreCalendly(db, { eventTypeName: "Échange apporteur (15 min)" });
    semerRencontreTest(db, {
      estTestInterne: false,
      debutPrevu: new Date(T0.getTime() + 13 * 60 * MINUTE),
    });
    semerRencontreTest(db, { estTestInterne: false, type: "telephone" });

    const liste = await listerRencontresDuJour(commePrisma(db), { maintenant: T0, mode: "ouvert" });
    const ids = liste.map((r) => r.rencontreId);
    expect(ids).toContain(saisie.rencontreId);
    const creee = db.lignes("rencontre").find((r) => r["calendlyEventId"] === cal.calendlyEventId);
    expect(creee).toBeDefined();
    expect(creee?.["rattachementStatut"]).toBe("a_classer");
    expect(ids).toContain(creee?.["id"]);
    expect(liste).toHaveLength(2);
    const dCal = liste.find((r) => r.source === "calendly");
    expect(dCal?.personne).toBe("Camille Exemple");
    expect(dCal?.clientPropose).toBeNull();
  });

  it("mode pilote : seules les rencontres de test", async () => {
    const db = fausseBase();
    const test = semerRencontreTest(db);
    semerRencontreTest(db, { estTestInterne: false });
    semerRencontreCalendly(db);
    const liste = await listerRencontresDuJour(commePrisma(db), { maintenant: T0, mode: "pilote" });
    expect(liste.map((r) => r.rencontreId)).toEqual([test.rencontreId]);
  });

  it("nuit du changement d'heure (25/10/2026) : une rencontre à +11 h 30 reste dans la fenêtre", async () => {
    const db = fausseBase();
    const avant = new Date("2026-10-24T22:00:00.000Z"); // 00:00 à Paris (été)
    const test = semerRencontreTest(db, {
      debutPrevu: new Date(avant.getTime() + 11.5 * 60 * MINUTE),
    });
    const liste = await listerRencontresDuJour(commePrisma(db), {
      maintenant: avant,
      mode: "pilote",
    });
    expect(liste.map((r) => r.rencontreId)).toEqual([test.rencontreId]);
  });
});
