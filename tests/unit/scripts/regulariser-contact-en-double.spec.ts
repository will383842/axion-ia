/**
 * `scripts/regulariser-contact-en-double.ts` — mode à blanc et refus.
 * Le script n'est jamais exécuté par la PR ; ce test prouve que, sans
 * `--executer`, aucune transaction n'est ouverte, et que les mauvaises
 * entrées sont refusées. Angle mort : l'écriture réelle n'est pas exercée ici.
 */

import { describe, expect, it, vi } from "vitest";
import {
  ErreurRegularisation,
  regulariserContactEnDouble,
  type BaseRegularisation,
} from "../../../scripts/regulariser-contact-en-double";

const FICHE = "f-1";
function base(autreFiche = false) {
  const transaction = vi.fn();
  const db = {
    client: {
      findUnique: async () => ({
        id: FICHE,
        contactEmail: "anne@fictive.example",
        contactTelephone: "01 02 03 04 05",
      }),
    },
    clientContact: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        clientId: where.id === "doublon" && autreFiche ? "f-2" : FICHE,
        nom: where.id === "doublon" ? "Anne Dupont" : "DUPONT Anne",
        fonction: "Gérante",
        adresses: where.id === "garder" ? [{ email: "anne@fictive.example" }] : [],
      }),
    },
    $transaction: transaction,
  } as unknown as BaseRegularisation;
  return { db, transaction };
}
const ARGS = { client: "AXI-CLI-030", garder: "garder", doublon: "doublon" };

describe("régulariser un contact en double", () => {
  it("à blanc : affiche, n'ouvre aucune transaction, ne sort ni nom ni adresse", async () => {
    const { db, transaction } = base();
    const lignes: string[] = [];
    const bilan = await regulariserContactEnDouble(db, ARGS, {
      executer: false,
      journal: (l) => lignes.push(l),
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(bilan).toMatchObject({ executee: false, gardeeId: "garder", doublonId: "doublon" });
    const sortie = lignes.join("\n");
    expect(sortie).not.toMatch(/dupont|anne|fictive/i);
  });

  it("refuse deux personnes de fiches différentes", async () => {
    const { db } = base(true);
    await expect(regulariserContactEnDouble(db, ARGS, { executer: false })).rejects.toThrow(
      ErreurRegularisation,
    );
  });

  it("refuse la même personne deux fois", async () => {
    const { db } = base();
    await expect(
      regulariserContactEnDouble(db, { ...ARGS, doublon: "garder" }, { executer: false }),
    ).rejects.toThrow(/même personne/);
  });
});
