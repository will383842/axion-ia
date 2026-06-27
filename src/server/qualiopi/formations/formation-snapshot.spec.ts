/**
 * Tests — snapshot légal Formation → session (WS5), helpers purs.
 */

import { describe, it, expect } from "vitest";
import {
  buildFormationSnapshot,
  readFormationForDocs,
  type FormationSnapshotSource,
} from "./formation-snapshot";

const FIXED = new Date("2026-06-27T12:00:00.000Z");

const source: FormationSnapshotSource = {
  titre: "IA Express",
  dureeHeures: 7,
  modalite: "presentiel",
  objectifsPedagogiques: [{ id: "obj-1", description: "Produire X" }],
  programmeDetaille: [{ moduleId: "mod-1", titre: "Intro" }],
  methodesPedagogiques: "Atelier",
  certificationType: "aucune",
  versionProgramme: "1.0",
};

describe("buildFormationSnapshot", () => {
  it("fige tous les champs engageants + horodatage", () => {
    const snap = buildFormationSnapshot(source, FIXED);
    expect(snap.v).toBe(1);
    expect(snap.titre).toBe("IA Express");
    expect(snap.dureeHeures).toBe(7);
    expect(snap.objectifsPedagogiques).toEqual(source.objectifsPedagogiques);
    expect(snap.programmeDetaille).toEqual(source.programmeDetaille);
    expect(snap.capturedAt).toBe("2026-06-27T12:00:00.000Z");
  });

  it("normalise les champs absents en null", () => {
    const snap = buildFormationSnapshot({ titre: "T", dureeHeures: 4 }, FIXED);
    expect(snap.modalite).toBeNull();
    expect(snap.objectifsPedagogiques).toBeNull();
    expect(snap.methodesPedagogiques).toBeNull();
    expect(snap.versionProgramme).toBeNull();
  });
});

describe("readFormationForDocs", () => {
  it("priorise le snapshot quand il est exploitable", () => {
    const snap = buildFormationSnapshot(source, FIXED);
    const live = { titre: "Titre modifié après coup", dureeHeures: 14 };
    const r = readFormationForDocs(snap, live);
    expect(r.source).toBe("snapshot");
    expect(r.titre).toBe("IA Express"); // figé, pas le titre LIVE modifié
    expect(r.dureeHeures).toBe(7);
  });

  it("repli sur LIVE si pas de snapshot (session legacy)", () => {
    const live = {
      titre: "Titre LIVE",
      dureeHeures: 14,
      objectifsPedagogiques: [{ description: "X" }],
    };
    const r = readFormationForDocs(null, live);
    expect(r.source).toBe("live");
    expect(r.titre).toBe("Titre LIVE");
    expect(r.dureeHeures).toBe(14);
  });

  it("repli sur LIVE si snapshot corrompu (objet sans titre)", () => {
    const r = readFormationForDocs({ garbage: true }, { titre: "LIVE", dureeHeures: 4 });
    expect(r.source).toBe("live");
    expect(r.titre).toBe("LIVE");
  });

  it("tolère l'absence totale de données", () => {
    const r = readFormationForDocs(null, null);
    expect(r.source).toBe("live");
    expect(r.titre).toBeNull();
    expect(r.dureeHeures).toBeNull();
    expect(r.objectifsPedagogiques).toBeNull();
  });
});
