/**
 * Tests — gardes de conformité d'édition Formation (WS4), partie pure.
 */

import { describe, it, expect, vi } from "vitest";
import {
  bumpProgrammeVersion,
  appendVersionEntry,
  countLockingSessions,
  LOCKING_SESSION_STATUTS,
  type FormationVersionEntry,
} from "./edit-guard";

describe("bumpProgrammeVersion", () => {
  it("incrémente la version mineure", () => {
    expect(bumpProgrammeVersion("1.0")).toBe("1.1");
    expect(bumpProgrammeVersion("2.9")).toBe("2.10");
    expect(bumpProgrammeVersion("10.3")).toBe("10.4");
  });

  it("repart de 1.0 sur un format inattendu", () => {
    expect(bumpProgrammeVersion(null)).toBe("1.0");
    expect(bumpProgrammeVersion(undefined)).toBe("1.0");
    expect(bumpProgrammeVersion("")).toBe("1.0");
    expect(bumpProgrammeVersion("v3")).toBe("1.0");
    expect(bumpProgrammeVersion("1.2.3")).toBe("1.0");
  });
});

describe("appendVersionEntry", () => {
  const entry: FormationVersionEntry = {
    version: "1.1",
    at: "2026-06-27T10:00:00.000Z",
    by: "admin-1",
    action: "update",
    fields: ["titre"],
  };

  it("ajoute à un historique existant", () => {
    const prev = [{ version: "1.0", at: "x", by: "a", action: "update" as const, fields: [] }];
    const out = appendVersionEntry(prev, entry);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual(entry);
  });

  it("repart d'un tableau vide si historique absent/corrompu", () => {
    expect(appendVersionEntry(null, entry)).toEqual([entry]);
    expect(appendVersionEntry(undefined, entry)).toEqual([entry]);
    expect(appendVersionEntry("oops", entry)).toEqual([entry]);
    expect(appendVersionEntry({ not: "array" }, entry)).toEqual([entry]);
  });

  it("ne mute pas l'historique d'entrée", () => {
    const prev: FormationVersionEntry[] = [];
    appendVersionEntry(prev, entry);
    expect(prev).toHaveLength(0);
  });
});

describe("countLockingSessions", () => {
  it("compte uniquement les sessions en cours / réalisées", async () => {
    const count = vi.fn().mockResolvedValue(2);
    const db = { trainingSession: { count } } as never;
    const n = await countLockingSessions(db, "form-1");
    expect(n).toBe(2);
    expect(count).toHaveBeenCalledWith({
      where: { formationId: "form-1", statut: { in: [...LOCKING_SESSION_STATUTS] } },
    });
  });

  it("le verrou ne couvre que en_cours et realisee", () => {
    expect([...LOCKING_SESSION_STATUTS]).toEqual(["en_cours", "realisee"]);
  });
});
