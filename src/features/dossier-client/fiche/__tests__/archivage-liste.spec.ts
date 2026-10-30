// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { separerLesArchivees } from "../archivage-liste";

const clients = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("liste des clients et archivage", () => {
  it("les archivées sont séparées des actives", async () => {
    const db = { clientProfil: { findMany: vi.fn(async () => [{ clientId: "b" }]) } } as never;
    const r = await separerLesArchivees(db, clients);
    expect(r.actives.map((c) => c.id)).toEqual(["a", "c"]);
    expect(r.archivees.map((c) => c.id)).toEqual(["b"]);
    expect(r.lectureImpossible).toBe(false);
  });

  it("une lecture en panne ne cache aucune fiche", async () => {
    const db = {
      clientProfil: {
        findMany: vi.fn(async () => {
          throw new Error("x");
        }),
      },
    } as never;
    const r = await separerLesArchivees(db, clients);
    expect(r.actives).toHaveLength(3);
    expect(r.lectureImpossible).toBe(true);
  });

  it("la page masque par défaut et montre avec ?archives=1", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/page.tsx"),
      "utf8",
    );
    expect(src).toContain('archives === "1"');
    expect(src).toContain("voirArchives ? partage.archivees : partage.actives");
    expect(src).toContain("Voir les archivées (");
    expect(src).toContain("const compte = partage.actives;");
  });
});
