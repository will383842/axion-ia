import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSIGNE_SANS_FINANCEMENT,
  MOTIFS_INTERDITS_GENERATEUR,
} from "./motifs-interdits-generateur";
import { estVisee } from "./regles";

describe("motifs interdits du générateur", () => {
  it.each([
    "OPCO",
    "Qualiopi",
    "CPF",
    "Mon Compte Formation",
    "Datadock",
    "EDOF",
    "subrogation",
    "FNE-Formation",
    "AIF",
    "finançable",
  ])("bloque %s", (m) => {
    expect(MOTIFS_INTERDITS_GENERATEUR.test(`Notre ${m} est là.`)).toBe(true);
  });
  it("ne bloque pas « prise en charge des appels »", () => {
    expect(MOTIFS_INTERDITS_GENERATEUR.test("La prise en charge des appels est automatisée.")).toBe(
      false,
    );
  });
  it("la consigne nomme chaque motif et donne la phrase standard", () => {
    for (const m of [
      "OPCO",
      "Qualiopi",
      "CPF",
      "Datadock",
      "EDOF",
      "subrogation",
      "FNE-Formation",
      "AIF",
      "finançable",
      "France Travail",
    ])
      expect(CONSIGNE_SANS_FINANCEMENT).toContain(m);
    expect(CONSIGNE_SANS_FINANCEMENT).toContain(
      "Financement : solutions indiquées au premier échange.",
    );
  });
  it("la phrase standard n'est pas elle-même visée (idempotence)", () => {
    expect(estVisee("Financement : solutions indiquées au premier échange.")).toBe(false);
  });
});

describe("le générateur ne réintroduit pas de contenu financier dans careers-gen/", () => {
  it("le fichier de motifs vit à côté des règles et n'est pas dans careers-gen/", () => {
    expect(
      fs.existsSync(
        path.join(
          process.cwd(),
          "src/server/content-gen/retrait-financement/motifs-interdits-generateur.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.readdirSync(path.join(process.cwd(), "careers-gen")).some((f) => f.includes("motifs")),
    ).toBe(false);
  });
});
