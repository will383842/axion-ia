/**
 * COMPLÉTER APRÈS RATTACHEMENT NE REFAIT PAS P1.
 *
 * La relance après rattachement programme `rattacher` (P2) et jamais
 * `extraire` (P1) : la transcription n'est pas relue, rien n'est repayé ; la
 * nouvelle version reprend l'état vérifié (faits, couverture) sans le texte
 * brut de l'extraction.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";
import { etatInitial } from "../../etat-compte-rendu";
import { completerApresRattachement } from "../../gestes-compte-rendu";
import { baseEspion } from "../../../../../tests/outils/base-espion";
import { CLE_DE_TEST } from "../../../../../tests/outils/fixtures-enregistreur";
import { extraction } from "../../../../../tests/fixtures/visio/scenario-menuiserie";

beforeAll(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
});

describe("compléter après rattachement ne refait pas P1", () => {
  it("aucune étape `extraire` ; l'état repris sans extraction brute, faits gardés", async () => {
    const etat = {
      ...etatInitial(new Date("2026-10-06T10:00:00Z"), "x"),
      extraction: extraction(),
      faits: [["F01", "fait-1"]] as const,
      rattachement: "en_attente_client" as const,
    };
    const e = baseEspion({
      "compteRendu.findFirst": () => ({
        id: "cr1",
        statut: "valide",
        version: 3,
        verification: chiffrerParole(JSON.stringify(etat)),
      }),
      "compteRendu.create": () => ({ id: "cr4" }),
    });
    await completerApresRattachement(e.base, "r1");
    expect(e.sqls.some((s) => s.valeurs.includes("extraire"))).toBe(false);
    const cree = e.de("compteRendu", "create")[0]!.args as { data: { verification: string } };
    const repris = JSON.parse(dechiffrerParole(cree.data.verification)) as typeof etat;
    expect(repris.extraction).toBeNull();
    expect(repris.faits).toEqual([["F01", "fait-1"]]);
    expect(repris.rattachement).toBeNull();
    // Un compte rendu VALIDÉ n'est pas remplacé avant que la nouvelle version le soit.
    expect(e.de("compteRendu", "update")).toHaveLength(0);
  });
});
