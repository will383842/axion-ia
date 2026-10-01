/**
 * ⛔ Un budget « à trancher » se tranche (V1-02) : « Garder cette valeur »
 * pose `remplaceParId` sur les AUTRES faits validés du même (type, clé,
 * portée, projet), avec un `FaitEvenement(remplace)` chacun, dans une seule
 * transaction. La synthèse rend alors la valeur gardée comme courante.
 *
 * Mutations qui font rougir :
 *   · ne pas filtrer sur le projet : le budget d'un AUTRE projet est remplacé ;
 *   · ne pas vérifier que le fait gardé est encore vivant : un second clic sur
 *     une page périmée remplace la valeur déjà gardée, et tout devient « à
 *     reconfirmer ».
 * Contre-témoin : avant le geste, le budget est « à trancher ».
 * Angle mort : le verrou de ligne de Postgres (deux clics simultanés) n'est
 * pas rejoué par la base en mémoire.
 */

import { describe, expect, it } from "vitest";

import { consoliderFaits, trouverValeur, valeurRetenue } from "../consolider-faits";
import type { FaitAConsolider } from "../consolider-faits";
import { ErreurTrancher, garderCetteValeur } from "../trancher";
import { dossierEnMemoire, id } from "./_dossier-en-memoire";
import { MAINTENANT, faitProjet, ilYA } from "./_faits";

const CLIENT = id(1);
const P = id(2);
const AUTRE_PROJET = id(2);
const projets = [
  { id: P, derniereReouvertureLe: null },
  { id: AUTRE_PROJET, derniereReouvertureLe: null },
];

function scene() {
  const dix = faitProjet(P, {
    id: id(3),
    type: "budget",
    montantMaxCents: 1_000_000,
    constateLe: ilYA(30),
  });
  const quinze = faitProjet(P, {
    id: id(3),
    type: "budget",
    montantMaxCents: 1_500_000,
    constateLe: ilYA(3),
  });
  const ailleurs = faitProjet(AUTRE_PROJET, {
    id: id(3),
    type: "budget",
    montantMaxCents: 200_000,
  });
  const lignes = [dix, quinze, ailleurs].map((f) => ({ ...f, clientId: CLIENT }));
  const db = dossierEnMemoire({ fait: lignes });
  const lire = (): FaitAConsolider[] => (db.tables["fait"] ?? []) as unknown as FaitAConsolider[];
  return { db, lire, dix, quinze, ailleurs };
}

describe("⛔ trancher un budget rend la valeur courante", () => {
  it("contre-témoin : avant le geste, le budget est à trancher", () => {
    const { lire } = scene();
    const v = trouverValeur(consoliderFaits(lire(), projets, MAINTENANT).projets[P], "budget");
    expect(v?.etat).toBe("a_trancher");
  });

  it("garder l'ANCIENNE valeur la rend courante, journalise, et ne touche pas l'autre projet", async () => {
    const { db, lire, dix, quinze, ailleurs } = scene();
    const r = await garderCetteValeur(db.client as never, {
      faitId: dix.id,
      parAdminId: "admin-1",
    });
    expect(r.clientId).toBe(CLIENT);
    const c = consoliderFaits(lire(), projets, MAINTENANT);
    const v = trouverValeur(c.projets[P], "budget");
    expect(v?.etat).toBe("courante");
    expect(valeurRetenue(v)?.montantMaxCents).toBe(1_000_000);
    const faits = lire();
    expect(faits.find((f) => f.id === quinze.id)?.remplaceParId).toBe(dix.id);
    expect(faits.find((f) => f.id === ailleurs.id)?.remplaceParId).toBeNull();
    expect(valeurRetenue(trouverValeur(c.projets[AUTRE_PROJET], "budget"))?.montantMaxCents).toBe(
      200_000,
    );
    expect(db.tables["faitEvenement"]).toEqual([
      expect.objectContaining({ faitId: quinze.id, action: "remplace", parAdminId: "admin-1" }),
    ]);
  });

  it("un second clic sur une valeur déjà remplacée est refusé, rien ne change", async () => {
    const { db, lire, dix, quinze } = scene();
    await garderCetteValeur(db.client as never, { faitId: dix.id, parAdminId: "admin-1" });
    await expect(
      garderCetteValeur(db.client as never, { faitId: quinze.id, parAdminId: "admin-1" }),
    ).rejects.toBeInstanceOf(ErreurTrancher);
    const v = trouverValeur(consoliderFaits(lire(), projets, MAINTENANT).projets[P], "budget");
    expect(v?.etat).toBe("courante");
    expect(db.tables["faitEvenement"]).toHaveLength(1);
  });

  it("deux clics croisés (interblocage) : un refus lisible, pas une erreur générique", async () => {
    for (const panne of [
      Object.assign(new Error("Transaction failed due to a write conflict or a deadlock"), {
        code: "P2034",
      }),
      Object.assign(new Error("raw query failed"), { code: "P2010", meta: { code: "40P01" } }),
    ]) {
      const db = { $transaction: async () => Promise.reject(panne) };
      await expect(
        garderCetteValeur(db as never, { faitId: "f", parAdminId: "a" }),
      ).rejects.toThrow(new ErreurTrancher("La fiche a changé entre-temps : rechargez la page."));
    }
  });
});
