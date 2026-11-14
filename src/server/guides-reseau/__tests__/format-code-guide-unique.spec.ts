// @vitest-environment node
//
// N3 — UNE seule définition de la forme d'un code de guide du catalogue (^gde-[a-z0-9-]{6,24}$).
// Trois copies identiques dérivaient en silence : un format modifié à un endroit laissait les autres
// accepter (ou refuser) autre chose. Les trois consommateurs importent la constante partagée.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { RE_CODE_GUIDE_CATALOGUE } from "../format-code-guide";
import { RE_CODE_GUIDE } from "../guide-a-livrer";
import { FORMAT_CODE_GUIDE_CATALOGUE } from "@/server/crm-sync/lettre-guide";

const SRC = join(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("N3 — une seule constante pour le format d'un code de guide", () => {
  it("la forme exacte est ^gde-[a-z0-9-]{6,24}$", () => {
    expect(RE_CODE_GUIDE_CATALOGUE.source).toBe("^gde-[a-z0-9-]{6,24}$");
  });

  it("les exports historiques sont LA MÊME instance", () => {
    expect(RE_CODE_GUIDE).toBe(RE_CODE_GUIDE_CATALOGUE);
    expect(FORMAT_CODE_GUIDE_CATALOGUE).toBe(RE_CODE_GUIDE_CATALOGUE);
  });

  it("aucun des trois fichiers ne redéfinit le motif littéral", () => {
    for (const f of [
      "crm-sync/lettre-guide.ts",
      "guides-reseau/guide-a-livrer.ts",
      "guides-reseau/cible-connue.ts",
      "guides-reseau/synchro-v3.ts",
    ]) {
      expect(lire(f), f).not.toMatch(/gde-\[a-z0-9-\]/);
    }
  });

  it("cible-connue.ts importe la constante partagée", () => {
    expect(lire("guides-reseau/cible-connue.ts")).toMatch(/format-code-guide/);
  });
});
