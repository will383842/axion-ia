/**
 * 🔴 Lot L4 (2026-09-30), correction de revue — l'encart des sessions rouvertes
 * s'intitulait « Sessions rouvertes sur la période » alors que l'écran n'a aucun
 * sélecteur de période et couvre tout le registre. C'était aussi le SEUL mot
 * qui différait du manifeste du ZIP. Le titre vient désormais du manifeste.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { lignesEcranReouvertures } from "@/server/qualiopi/sessions/dossiers-rouverts";

const page = readFileSync(
  resolve(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/mode-auditeur/page.tsx"),
  "utf8",
);

describe("titre de l'encart des réouvertures (Mode auditeur)", () => {
  it("l'écran affiche le titre même du manifeste, pas un titre à lui", () => {
    expect(page).toContain("{encartReouvertures.titre}");
    expect(page).not.toContain("sur la période");
  });

  it("le titre du manifeste ne promet aucune période", () => {
    for (const sessions of [null, []] as const) {
      const { titre } = lignesEcranReouvertures(sessions);
      expect(titre).toBe("Réouvertures de dossiers de session");
    }
  });
});
