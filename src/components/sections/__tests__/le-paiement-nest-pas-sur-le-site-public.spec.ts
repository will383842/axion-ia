import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("InterventionDetailPage : le paiement n’est jamais visible sur le site public", () => {
  it("n’écrit aucun acompte", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/sections/InterventionDetailPage.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/Acompte 50|50 % deposit/);
  });
});
