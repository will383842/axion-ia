/**
 * ⛔ LA PORTE DE CRÉATION TRANSMET CIVILITÉ, PRÉNOM ET NOM DE FAMILLE AU CONTACT.
 *
 * `creerOuRetrouverClient` passe l'identité de salutation à `definirContactFacturation`
 * (porte-client.ts, trois lignes `civilite` / `prenom` / `nomFamille`). Sans elles, la fiche
 * naît sans identité de salutation et l'e-mail écrit « Bonjour, » au lieu de « Bonjour Madame
 * Dupont, ». `definirContactFacturation` est simulée : on prouve ce que la porte lui TRANSMET.
 *
 *   · les trois champs fournis arrivent tels quels (ni retaillés, ni recomposés) ;
 *   · un champ absent ou vide n'est PAS transmis (clé absente : « ne change rien », jamais
 *     « efface ») ;
 *   · sans nom ni e-mail, aucun contact n'est défini.
 *
 * Mutation qui fait rougir (essayée à la main, puis annulée) : supprimer l'une des trois
 * lignes de `porte-client.ts` (vers 545-547) → le cas du champ concerné rougit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const definir = vi.hoisted(() => vi.fn(async () => ({ contactId: "c-1" })));
vi.mock("../contact-facturation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../contact-facturation")>()),
  definirContactFacturation: definir,
}));

import { creerOuRetrouverClient } from "../porte-client";
import { baseEnMemoire, commePrisma } from "./_base-en-memoire";

const DONNEES = { raisonSociale: "Société Fictive Identité" };

async function creer(personne: Record<string, string | undefined>) {
  const db = baseEnMemoire({});
  const r = await creerOuRetrouverClient(commePrisma(db), DONNEES, personne, {
    parAdminId: "a1",
  });
  expect(r.statut).toBe("cree");
}
const transmis = () => (definir.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1];

describe("⛔ la porte transmet civilité, prénom et nom de famille", () => {
  beforeEach(() => definir.mockClear());

  it("les trois champs fournis arrivent tels quels au contact", async () => {
    await creer({
      nom: "Léa Dupont",
      email: "lea@fictive.example",
      civilite: "madame",
      prenom: "Léa",
      nomFamille: "Dupont",
    });
    expect(definir).toHaveBeenCalledTimes(1);
    expect(transmis()).toMatchObject({
      civilite: "madame",
      prenom: "Léa",
      nomFamille: "Dupont",
      nom: "Léa Dupont",
      email: "lea@fictive.example",
    });
  });

  it("un champ absent ou vide : clé ABSENTE (jamais undefined, jamais chaîne vide)", async () => {
    await creer({ nom: "Léa Dupont", civilite: "", prenom: undefined });
    const e = transmis();
    expect("civilite" in e).toBe(false);
    expect("prenom" in e).toBe(false);
    expect("nomFamille" in e).toBe(false);
  });

  it("chacun des trois est transmis seul, sans entraîner les deux autres", async () => {
    for (const [champ, cle] of [
      ["civilite", "monsieur"],
      ["prenom", "Marc"],
      ["nomFamille", "Martin"],
    ] as const) {
      definir.mockClear();
      await creer({ nom: "Marc Martin", [champ]: cle });
      const e = transmis();
      expect(e[champ]).toBe(cle);
      for (const autre of ["civilite", "prenom", "nomFamille"].filter((c) => c !== champ))
        expect(autre in e, autre).toBe(false);
    }
  });

  it("sans nom ni e-mail : aucun contact défini", async () => {
    await creer({ civilite: "madame", nomFamille: "Dupont" });
    expect(definir).not.toHaveBeenCalled();
  });
});
