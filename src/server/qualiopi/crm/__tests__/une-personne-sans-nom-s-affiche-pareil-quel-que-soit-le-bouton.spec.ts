/**
 * Une personne créée avec sa seule adresse porte le MÊME nom provisoire
 * (« Nom à compléter »), qu'elle naisse comme contact de facturation
 * (`definirContactFacturation`) ou par « Ajouter cette personne à la fiche »
 * (`ajouterPersonneAFiche`) : les deux passent par `creerOuRetrouverPersonne`.
 *
 * Mutation qui fait rougir : dans `ajouterPersonneAFiche`, recréer la personne
 * à la main avec l'adresse pour nom (l'ancienne copie divergente).
 * Contre-témoin : un nom donné est gardé tel quel.
 * Angle mort : l'affichage lui-même (la console lit `nom`) n'est pas rendu ici.
 */

import { describe, expect, it } from "vitest";
import { NOM_A_COMPLETER, definirContactFacturation } from "../contact-facturation";
import { ajouterPersonneAFiche } from "../porte-client";
import { baseEnMemoire, commePrisma, ficheClient } from "./_base-en-memoire";

describe("une personne sans nom s'affiche pareil quel que soit le bouton", () => {
  it("contact de facturation et « Ajouter cette personne » : « Nom à compléter »", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-020", raisonSociale: "Fictive SARL" });
    const db = baseEnMemoire({ clients: [fiche] });

    await db.$transaction((tx) =>
      definirContactFacturation(commePrisma(tx), {
        clientId: fiche.id,
        email: "compta@fictive.example",
      }),
    );
    const ajout = await ajouterPersonneAFiche(
      commePrisma(db),
      fiche.id,
      { email: "direction@fictive.example" },
      null,
    );

    expect(ajout.cree).toBe(true);
    expect(db.etat.contacts.map((c) => c.nom)).toEqual([NOM_A_COMPLETER, NOM_A_COMPLETER]);
    expect(db.etat.adresses.map((a) => a.email).sort()).toEqual([
      "compta@fictive.example",
      "direction@fictive.example",
    ]);
  });

  it("contre-témoin : un nom donné est gardé", async () => {
    const fiche = ficheClient({ numero: "AXI-CLI-021", raisonSociale: "Fictive SARL" });
    const db = baseEnMemoire({ clients: [fiche] });
    await ajouterPersonneAFiche(commePrisma(db), fiche.id, { nom: "Anne Fictive" }, null);
    expect(db.etat.contacts.map((c) => c.nom)).toEqual(["Anne Fictive"]);
  });
});
