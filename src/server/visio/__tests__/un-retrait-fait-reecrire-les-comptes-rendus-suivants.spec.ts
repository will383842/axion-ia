/**
 * ⛔ UN RETRAIT FAIT RÉÉCRIRE LES COMPTES RENDUS SUIVANTS (B2).
 *
 * Les comptes rendus des rendez-vous POSTÉRIEURS du même client ont pu
 * reprendre des faits de celui-ci (« déjà connu », consolidation) : ils sont
 * vidés (`a_regenerer`) et leur réécriture est programmée — elle se fera sans
 * les faits effacés.
 *
 * Mutation qui rougit : retirer `programmerReecritures(tx, suivants)` du
 * retrait → aucune étape `rediger`. Contre-témoin : un rendez-vous sans client
 * n'a pas de « suivants ». Angle mort : un compte rendu ANTÉRIEUR n'a pas pu
 * s'en servir (filtre `faitsDejaConnus`) : il n'est pas touché.
 */

import { describe, expect, it } from "vitest";

import { retirerAccordRencontre } from "@/lib/rgpd-erase";
import { baseEspion } from "../../../../tests/outils/base-espion";

function base(clientId: string | null) {
  return baseEspion({
    "rencontre.findUnique": () => ({
      id: "r1",
      clientId,
      debutPrevu: new Date("2026-10-06T10:00:00Z"),
      debutReel: null,
      createdAt: new Date(),
    }),
    "compteRendu.findMany": (a) => {
      const w = a["where"] as { rencontreId?: string; rencontre?: unknown };
      return w.rencontre ? [{ id: "cr-suivant", rencontreId: "r2" }] : [];
    },
  });
}

describe("un retrait fait réécrire les comptes rendus suivants", () => {
  it("les suivants passent a_regenerer, vidés, et `rediger` est programmée", async () => {
    const e = base("c1");
    const r = await retirerAccordRencontre("r1", "admin-1", { db: e.base });
    expect(r.comptesRendusARegenerer).toBe(1);
    const vide = e
      .de("compteRendu", "updateMany")
      .find((a) => (a.args["data"] as { statut?: string }).statut === "a_regenerer");
    expect(vide!.args).toMatchObject({
      where: { id: { in: ["cr-suivant"] } },
      data: { contenu: "", verification: null },
    });
    const rediger = e.sqls.filter((s) => s.valeurs.includes("rediger"));
    expect(rediger).toHaveLength(2); // INSERT + remise à faire
    expect(rediger[0]!.valeurs).toEqual(expect.arrayContaining(["r2", "cr-suivant"]));
    // La requête des suivants vise le MÊME client et des rendez-vous POSTÉRIEURS.
    const requete = e
      .de("compteRendu", "findMany")
      .find((a) => (a.args["where"] as { rencontre?: unknown }).rencontre)!;
    expect(JSON.stringify(requete.args)).toContain('"clientId":"c1"');
    expect(JSON.stringify(requete.args)).toContain('"gt"');
  });

  it("contre-témoin : sans client, aucun suivant", async () => {
    const e = base(null);
    const r = await retirerAccordRencontre("r1", "admin-1", { db: e.base });
    expect(r.comptesRendusARegenerer).toBe(0);
    expect(e.sqls.filter((s) => s.valeurs.includes("rediger"))).toEqual([]);
  });
});
