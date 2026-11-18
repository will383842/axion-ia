import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// La suite d'intégration partage UNE base Postgres : le parallélisme de fichiers, allumé en CI pour la
// suite unitaire (vitest.config.ts), doit y rester éteint — sans quoi elle en hériterait par `...baseConfig.test`.
describe("la suite d'intégration reste séquentielle", () => {
  const src = readFileSync(join(process.cwd(), "vitest.integration.config.ts"), "utf8");

  it("désactive explicitement fileParallelism", () => {
    expect(src).toMatch(/fileParallelism:\s*false/);
  });

  it("le fait APRÈS avoir étalé la config de base (sinon elle l'écraserait)", () => {
    expect(src.indexOf("...baseConfig.test")).toBeGreaterThan(-1);
    expect(src.indexOf("fileParallelism: false")).toBeGreaterThan(
      src.indexOf("...baseConfig.test"),
    );
  });
});
