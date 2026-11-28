// PR N : un IBAN « purge » (ou null) est lu comme « pas d'IBAN » par chaque lecteur.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: vi.fn((v: unknown) => {
    if (v === "purge") throw new Error("decryptPii ne doit jamais recevoir « purge »");
    return v;
  }),
  encryptPii: (v: unknown) => v,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { ibanPurgeOuAbsent, lireIbanClair } from "../iban-purge";
import { compteDeLaFiche } from "../virement-compte";

describe("lecteurs", () => {
  it("lireIbanClair : null, vide et purge → null, sans déchiffrer", () => {
    for (const v of [null, undefined, "", "purge"]) {
      expect(ibanPurgeOuAbsent(v)).toBe(true);
      expect(lireIbanClair(v)).toBeNull();
    }
  });
  it("virement-compte : compteDeLaFiche", () => {
    expect(compteDeLaFiche("purge")).toBeNull();
    expect(compteDeLaFiche(null)).toBeNull();
  });
});

describe("chaque fichier qui déchiffre un IBAN passe par le lecteur gardé", () => {
  it.each([
    "virement-compte.ts",
    "changement-iban.ts",
    "donnees.ts",
    "reprise-historique-iban.ts",
    "compte-deja-connu.ts",
    "changement-iban-espace-lecture.ts",
  ])("%s", (f) => {
    const src = readFileSync(join(__dirname, "..", f), "utf8");
    expect(src).toContain("lireIbanClair");
    expect(src).not.toMatch(/decryptPii\(\s*(fiche|f|a\??|d|ibanChiffre)[.?]*\.?iban/);
  });
});
