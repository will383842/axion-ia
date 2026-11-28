import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Aucun e-mail à l'apporteur, aucun effet sur le contrat : Williams décide.
const SRC = readFileSync(path.resolve(__dirname, "../controle-registre.ts"), "utf8").replace(
  /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
  "",
);

describe("le contrôle du registre ne parle jamais à l'apporteur", () => {
  it("n'importe ni envoi d'e-mail ni file d'e-mails", () => {
    expect(SRC).not.toMatch(/from\s+"\.\/envois"/);
    expect(SRC).not.toMatch(/enqueueEmail|@\/server\/queue/);
  });
  it("ne touche ni au statut ni au contrat", () => {
    expect(SRC).not.toMatch(/apporteurReseau\.(update|updateMany|delete)/);
    expect(SRC).not.toMatch(/executerResiliation|notifierResiliation|contratCle/);
  });
  it("seule l'alerte interne signale", () => {
    expect(SRC).toMatch(/alerteInterne/);
  });
});
