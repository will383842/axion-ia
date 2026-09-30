// @vitest-environment node
/**
 * ⛔ UN RATTACHEMENT PENDANT P3 NE DONNE QU'UNE VERSION « À VALIDER » (V1, P-1).
 *
 * Scénario : nouveau prospect, la v1 du compte rendu est entre `rattacher` et
 * `verifier_compte_rendu`. Will clique « Créer la fiche prospect » :
 * `completerApresRattachement` passe la v1 en `remplace` et crée la v2, qui
 * repart de P2. Avant ce correctif, la v1 CONTINUAIT : P3, P4 et P5 étaient
 * appelés (facturés deux fois, sur le plafond commun), puis
 * `finaliserCompteRendu` la repassait « à valider » sans condition. Deux
 * versions « à valider » pour le même rendez-vous, et la v1 (rédigée sans le
 * client) restait dans « Versions » pour toujours.
 *
 * Trois verrous, un par cas :
 *   1. `completerApresRattachement` annule, dans la même transaction, les
 *      étapes de la v1 encore à faire, suspendues ou en cours ;
 *   2. `pourPasses` arrête le circuit (`ArretVisio`) sur une version
 *      remplacée ou rejetée : aucun appel à OpenAI ;
 *   3. `finaliserCompteRendu` n'écrit « à valider » que sur un BROUILLON ;
 *      0 ligne = version remplacée entre-temps, on s'arrête sans rien écrire.
 *
 * Mutations qui rougissent : retirer l'`updateMany` des traitements dans
 * `completerApresRattachement` (1er cas) ; retirer le contrôle de statut de
 * `pourPasses` (2e cas : un appel part) ; revenir à `update` sans condition
 * dans `finaliserCompteRendu` (3e cas).
 * Contre-témoins : un brouillon ordinaire n'est pas arrêté et se
 * finalise (l'enregistrement passe « compte rendu prêt »).
 * Angle mort : la sérialisation réelle des deux transactions (verrou de ligne
 * sur `traitements_visio`) n'est prouvée que par Postgres, pas ici.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";
import { depotDonneesPrisma } from "../depot-donnees";
import { etatInitial } from "../etat-compte-rendu";
import { ArretVisio } from "../etapes";
import { completerApresRattachement } from "../gestes-compte-rendu";
import { baseEspion } from "../../../../tests/outils/base-espion";
import { CLE_DE_TEST } from "../../../../tests/outils/fixtures-enregistreur";

beforeAll(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
});

const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";
const T0 = new Date("2026-10-06T10:00:00Z");

function etatChiffre(): string {
  return chiffrerParole(JSON.stringify(etatInitial(T0, "x")));
}

describe("⛔ un rattachement pendant P3 ne donne qu'une version à valider", () => {
  it("compléter annule, dans la même transaction, les étapes de la version remplacée", async () => {
    const b = baseEspion({
      "compteRendu.findFirst": () => ({
        id: "cr1",
        statut: "brouillon",
        version: 1,
        verification: etatChiffre(),
      }),
      "compteRendu.create": () => ({ id: "cr2" }),
    });
    expect(await completerApresRattachement(b.base, RENCONTRE)).toBe("cr2");

    expect(b.de("compteRendu", "update")[0]?.args).toMatchObject({
      where: { id: "cr1" },
      data: { statut: "remplace" },
    });
    const annulations = b.de("traitementVisio", "updateMany");
    expect(annulations).toHaveLength(1);
    expect(annulations[0]?.args).toMatchObject({
      where: {
        compteRenduId: { in: ["cr1"] },
        statut: { in: ["a_faire", "suspendu", "en_cours"] },
      },
      data: { statut: "annule", verrouJusqua: null },
    });
    // Et la v2 repart bien de P2.
    expect(b.sqls.some((s) => s.valeurs.includes("rattacher") && s.valeurs.includes("cr2"))).toBe(
      true,
    );
  });

  it("réextraire (nouvelle version) annule aussi les étapes des versions remplacées", async () => {
    const b = baseEspion({
      "compteRendu.findMany": () => [{ id: "cr1" }],
      "compteRendu.create": () => ({ id: "cr2" }),
    });
    await depotDonneesPrisma(b.base).creerCompteRendu(b.base, {
      rencontreId: RENCONTRE,
      transcriptionId: null,
      mode: "reextraire",
      modele: "gpt-6-sol",
      promptHash: "x",
      schemaVersion: 1,
      etat: etatInitial(T0, "x"),
    });
    expect(b.de("traitementVisio", "updateMany")[0]?.args).toMatchObject({
      where: { compteRenduId: { in: ["cr1"] } },
      data: { statut: "annule" },
    });
  });

  it("une étape de la version remplacée déjà prise s'arrête avant OpenAI", async () => {
    const b = baseEspion({
      "compteRendu.findUnique": () => ({
        id: "cr1",
        rencontreId: RENCONTRE,
        statut: "remplace",
        verification: etatChiffre(),
      }),
    });
    await expect(depotDonneesPrisma(b.base).pourPasses("cr1")).rejects.toBeInstanceOf(ArretVisio);
    const rejete = baseEspion({
      "compteRendu.findUnique": () => ({
        id: "cr1",
        rencontreId: RENCONTRE,
        statut: "rejete",
        verification: etatChiffre(),
      }),
    });
    await expect(depotDonneesPrisma(rejete.base).pourPasses("cr1")).rejects.toBeInstanceOf(
      ArretVisio,
    );
  });

  it("contre-témoin : un brouillon ordinaire n'est pas arrêté", async () => {
    const b = baseEspion({
      "compteRendu.findUnique": () => ({
        id: "cr1",
        rencontreId: RENCONTRE,
        statut: "brouillon",
        verification: etatChiffre(),
      }),
    });
    await depotDonneesPrisma(b.base).pourPasses("cr1");
    expect(b.de("rencontre", "findUnique").length).toBeGreaterThan(0);
  });

  it("finaliser n'écrit « à valider » que sur un brouillon ; sinon rien n'est écrit", async () => {
    const remplacee = baseEspion({ "compteRendu.updateMany": () => ({ count: 0 }) });
    await expect(
      depotDonneesPrisma(remplacee.base).finaliserCompteRendu(remplacee.base, {
        compteRenduId: "cr1",
        rencontreId: RENCONTRE,
        contenu: "{}",
        etat: etatInitial(T0, "x"),
        modele: null,
      }),
    ).rejects.toBeInstanceOf(ArretVisio);
    expect(remplacee.de("compteRendu", "updateMany")[0]?.args).toMatchObject({
      where: { id: "cr1", statut: "brouillon" },
      data: { statut: "a_valider" },
    });
    expect(remplacee.de("compteRendu", "update")).toEqual([]);
    expect(remplacee.de("enregistrement", "updateMany")).toEqual([]);

    // Contre-témoin : un brouillon se finalise.
    const brouillon = baseEspion({ "compteRendu.updateMany": () => ({ count: 1 }) });
    await depotDonneesPrisma(brouillon.base).finaliserCompteRendu(brouillon.base, {
      compteRenduId: "cr1",
      rencontreId: RENCONTRE,
      contenu: "{}",
      etat: etatInitial(T0, "x"),
      modele: null,
    });
    expect(brouillon.de("enregistrement", "updateMany")[0]?.args).toMatchObject({
      data: { statut: "compte_rendu_pret" },
    });
  });
});
