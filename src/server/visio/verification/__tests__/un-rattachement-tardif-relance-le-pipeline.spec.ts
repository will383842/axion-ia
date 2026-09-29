/**
 * ⛔ UN RATTACHEMENT TARDIF RELANCE LE PIPELINE (décision A4 ; plan §3.12).
 *
 * Un rendez-vous traité alors qu'il était « à classer » a sauté P2 (aucun
 * rattachement automatique). Quand Will le range chez un client,
 * `completerApresRattachement` crée une nouvelle version (mode
 * `completer_apres_rattachement`) qui REPART DE `rattacher` — l'ancienne est
 * remplacée.
 *
 * Mutation qui rougit : ne rien programmer dans `completerApresRattachement`
 * → aucune étape `rattacher` n'est posée. Contre-témoin : sans état (aucun
 * compte rendu), rien n'est relancé. Angle mort : l'appel depuis l'écran de
 * rattachement vit dans la PR 4 (une ligne, au rebase).
 */

import { beforeAll, describe, expect, it } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";
import { etatInitial } from "../../etat-compte-rendu";
import { completerApresRattachement } from "../../gestes-compte-rendu";
import { baseEspion } from "../../../../../tests/outils/base-espion";
import { CLE_DE_TEST } from "../../../../../tests/outils/fixtures-enregistreur";

beforeAll(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
});

function base(avecCompteRendu: boolean) {
  return baseEspion({
    "compteRendu.findFirst": () =>
      avecCompteRendu
        ? {
            id: "cr1",
            statut: "a_valider",
            version: 1,
            verification: chiffrerParole(
              JSON.stringify({
                ...etatInitial(new Date("2026-10-06T10:00:00Z"), "x"),
                rattachement: "en_attente_client",
              }),
            ),
          }
        : null,
    "compteRendu.create": () => ({ id: "cr2" }),
  });
}

describe("un rattachement tardif relance le pipeline", () => {
  it("nouvelle version, ancienne remplacée, `rattacher` programmée pour la nouvelle", async () => {
    const e = base(true);
    expect(await completerApresRattachement(e.base, "r1")).toBe("cr2");
    expect(e.de("compteRendu", "update")[0]!.args).toMatchObject({
      where: { id: "cr1" },
      data: { statut: "remplace" },
    });
    expect(e.de("compteRendu", "create")[0]!.args).toMatchObject({
      data: { mode: "completer_apres_rattachement", version: 2 },
    });
    const planifs = e.sqls.filter((s) => s.sql.includes('INSERT INTO "traitements_visio"'));
    expect(planifs.map((s) => s.valeurs[1])).toEqual(["rattacher"]);
    expect(planifs[0]!.valeurs).toContain("cr2");
  });

  it("contre-témoin : sans compte rendu, rien n'est relancé", async () => {
    const e = base(false);
    expect(await completerApresRattachement(e.base, "r1")).toBeNull();
    expect(e.sqls).toEqual([]);
  });
});
