import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("OngletDevisFactures — documents générés", () => {
  it("chaque ligne porte le lien vers la route de téléchargement existante", () => {
    const src = readFileSync(
      "src/components/admin/dossier-client/fiche/OngletDevisFactures.tsx",
      "utf8",
    );
    expect(src).toContain("lienTelechargement(urlPiece(doc.id))");
  });
  it("la route exige une session admin", () => {
    const route = readFileSync("src/app/api/qualiopi/documents/[id]/route.ts", "utf8");
    expect(route).toMatch(/auth\(\)/);
    expect(route).toMatch(/admin/);
  });
});
