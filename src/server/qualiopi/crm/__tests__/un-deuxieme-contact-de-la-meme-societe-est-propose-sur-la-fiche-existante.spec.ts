/**
 * ⛔ SCÉNARIO « DAF + DIRIGEANTE » (plan §3.17, B18) : la DAF de la société a
 * réservé avec son adresse, la fiche existe. La dirigeante réserve à son tour
 * avec la SIENNE. Avant : une seconde fiche naissait sans rien dire.
 * Maintenant : la fiche existante est PROPOSÉE (même fin d'adresse pro, même
 * nom dans la même ville), et « Ajouter cette personne à la fiche » range la
 * dirigeante comme une PERSONNE de la fiche — aucune seconde fiche.
 *
 * Mutation qui fait rougir : retirer le signal `domaine` de `signalEntre`
 * (la proposition disparaît quand la ville n'est pas saisie), ou faire créer
 * une fiche à `ajouterPersonneAFiche`.
 * Contre-témoin : une société d'un autre domaine et d'une autre ville n'est
 * pas proposée.
 * Angle mort : sans adresse pro NI ville, rien ne rapproche deux saisies —
 * 17 adresses Calendly sur 20 sont des webmails (mesuré le 28/09).
 */

import { describe, expect, it } from "vitest";
import {
  ajouterPersonneAFiche,
  chargerFichesCandidates,
  creerOuRetrouverClient,
  preparerCandidat,
  trouverFichesProches,
} from "../porte-client";
import { adresse, baseEnMemoire, commePrisma, ficheClient, personne } from "./_base-en-memoire";

function base() {
  const martin = ficheClient({
    numero: "AXI-CLI-004",
    raisonSociale: "Martin Industrie SAS",
    adresseVille: "Lyon",
  });
  const daf = personne(martin.id, "DAF Fictive", true);
  const db = baseEnMemoire({
    clients: [martin],
    contacts: [daf],
    adresses: [adresse(daf.id, "daf@martin-industrie.example")],
  });
  return { db, martin };
}

describe("⛔ un deuxième contact de la même société est proposé sur la fiche existante", () => {
  it("la dirigeante (autre adresse, même domaine pro) → fiche Martin proposée", async () => {
    const { db, martin } = base();
    const candidat = preparerCandidat({
      raisonSociale: "Martin Industrie",
      emails: ["dirigeante@martin-industrie.example"],
    });
    const proches = trouverFichesProches(
      candidat,
      await chargerFichesCandidates(commePrisma(db), candidat),
    );
    expect(proches).toEqual([
      expect.objectContaining({ ficheId: martin.id, signal: "domaine", force: "proposition" }),
    ]);
  });

  it("même nom (sans forme juridique) dans la même ville → proposée aussi", async () => {
    const { db, martin } = base();
    const candidat = preparerCandidat({ raisonSociale: "MARTIN industrie", ville: "lyon" });
    const proches = trouverFichesProches(
      candidat,
      await chargerFichesCandidates(commePrisma(db), candidat),
    );
    expect(proches.map((p) => [p.ficheId, p.signal])).toEqual([[martin.id, "nom_ville"]]);
  });

  it("« Ajouter cette personne à la fiche » : une personne de plus, aucune fiche de plus", async () => {
    const { db, martin } = base();
    const r = await ajouterPersonneAFiche(
      commePrisma(db),
      martin.id,
      {
        nom: "Dirigeante Fictive",
        email: "dirigeante@martin-industrie.example",
        fonction: "Gérante",
      },
      "admin-1",
    );
    expect(r.cree).toBe(true);
    expect(db.etat.clients).toHaveLength(1);
    expect(db.etat.contacts.filter((c) => c.clientId === martin.id)).toHaveLength(2);
    // Le contact de facturation ne change pas en silence.
    expect(db.etat.contacts.filter((c) => c.estContactFacturation)).toHaveLength(1);
    // Rejouer ne duplique pas la personne.
    const encore = await ajouterPersonneAFiche(
      commePrisma(db),
      martin.id,
      { email: "Dirigeante@Martin-Industrie.example" },
      "admin-1",
    );
    expect(encore.cree).toBe(false);
    expect(db.etat.contacts).toHaveLength(2);
  });

  it("la création directe reste possible, mais rend la proposition", async () => {
    const { db, martin } = base();
    const r = await creerOuRetrouverClient(
      commePrisma(db),
      { raisonSociale: "Martin Industrie" },
      { nom: "Dirigeante Fictive", email: "dirigeante@martin-industrie.example" },
      { parAdminId: "admin-1" },
    );
    expect(r.statut).toBe("cree");
    if (r.statut !== "cree") return;
    expect(r.proches.map((p) => p.ficheId)).toEqual([martin.id]);
  });

  it("contre-témoin : autre domaine, autre ville → rien de proposé", async () => {
    const { db } = base();
    const candidat = preparerCandidat({
      raisonSociale: "Martin Industrie",
      emails: ["contact@autre-societe.example"],
      ville: "Brest",
    });
    expect(
      trouverFichesProches(candidat, await chargerFichesCandidates(commePrisma(db), candidat)),
    ).toEqual([]);
  });
});
