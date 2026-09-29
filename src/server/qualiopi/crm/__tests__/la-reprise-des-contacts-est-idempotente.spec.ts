/**
 * La reprise des contacts est idempotente (`scripts/visio/reprendre-contacts.ts`,
 * lancé à la main en production après la mise en ligne, puis peut-être relancé).
 *
 *   · essai à blanc par défaut : RIEN n'est écrit sans `--appliquer` ;
 *   · une personne par fiche qui n'en a aucune, tirée de `Client.contact*`,
 *     par la fonction unique `definirContactFacturation` ;
 *   · un second lancement réel ne crée plus rien ;
 *   · une fiche sans nom ni adresse n'a rien à reprendre.
 *
 * Mutation qui fait rougir : retirer le filtre « sans aucune personne » de la
 * requête, ou écrire en essai à blanc.
 * Angle mort : la sortie en nombres seulement est vérifiée à la lecture du
 * script, pas ici.
 */

import { describe, expect, it } from "vitest";
import {
  reprendreContacts,
  type BaseReprise,
} from "../../../../../scripts/visio/reprendre-contacts";
import { baseEnMemoire, commePrisma, ficheClient } from "./_base-en-memoire";

function base() {
  return baseEnMemoire({
    clients: [
      ficheClient({
        numero: "AXI-CLI-001",
        raisonSociale: "Fictive",
        contactNom: "Anne Fictive",
        contactEmail: "anne@fictive.example",
        contactFonction: "DAF",
        contactTelephone: "01 00 00 00 00",
      }),
      ficheClient({ numero: "AXI-CLI-002", raisonSociale: "Sans contact" }),
    ],
  });
}

describe("la reprise des contacts est idempotente", () => {
  it("essai à blanc : compte, n'écrit rien", async () => {
    const db = base();
    const bilan = await reprendreContacts(commePrisma<BaseReprise>(db), { appliquer: false });
    expect(bilan).toEqual({ sansPersonne: 2, sansContact: 1, aCreer: 1, creees: 0 });
    expect(db.etat.contacts).toEqual([]);
  });

  it("réel puis second lancement : une personne, puis rien", async () => {
    const db = base();
    const premier = await reprendreContacts(commePrisma<BaseReprise>(db), { appliquer: true });
    expect(premier.creees).toBe(1);
    const p = db.etat.contacts[0];
    expect(p).toEqual(
      expect.objectContaining({
        nom: "Anne Fictive",
        fonction: "DAF",
        telephone: "01 00 00 00 00",
        origine: "reprise_client",
        estContactFacturation: true,
      }),
    );
    expect(db.etat.adresses.map((a) => a.email)).toEqual(["anne@fictive.example"]);

    const second = await reprendreContacts(commePrisma<BaseReprise>(db), { appliquer: true });
    expect(second).toEqual({ sansPersonne: 1, sansContact: 1, aCreer: 0, creees: 0 });
    expect(db.etat.contacts).toHaveLength(1);
  });
});
