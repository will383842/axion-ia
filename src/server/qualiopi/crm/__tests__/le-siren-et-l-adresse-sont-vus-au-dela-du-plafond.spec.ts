/**
 * ⛔ LE SIREN ET L'ADRESSE SONT VUS AU-DELÀ DU PLAFOND (plan §3.17 point 5, B18).
 *
 * La recherche des fiches proches plafonne ses propositions (domaine, nom et
 * ville) à quelques centaines de lignes. Les signaux qui BLOQUENT ou qui
 * rattachent (même SIREN, même adresse) ne doivent jamais dépendre de ce
 * plafond : sinon, dès que la ville compte plus de fiches que le plafond, la
 * fiche au même SIREN sort de la fenêtre et la porte crée le doublon.
 *
 * Mutation qui fait rougir : remettre le SIREN et l'adresse dans la requête
 * plafonnée (un seul `findMany` avec `take`), ou retirer la lecture non
 * plafonnée des signaux forts.
 * Contre-témoin : sans SIREN ni adresse commune, 250 fiches de la même ville
 * ne bloquent pas la création.
 * Angle mort : une fiche au même NOM dans une ville de plus de 200 fiches peut
 * ne pas être proposée — c'est une proposition, pas un refus, et c'est assumé.
 */

import { describe, expect, it } from "vitest";
import { creerOuRetrouverClient, chargerFichesCandidates, preparerCandidat } from "../porte-client";
import { adresse, baseEnMemoire, commePrisma, ficheClient, personne } from "./_base-en-memoire";

// Fictif, clé de Luhn valide (le dépôt est public : aucun vrai SIREN).
const SIREN = "732829320";

function villeChargee() {
  const fiches = Array.from({ length: 250 }, (_, i) =>
    ficheClient({
      numero: `AXI-CLI-${String(i + 1).padStart(3, "0")}`,
      raisonSociale: `Voisin ${i + 1}`,
      adresseVille: "Lyon",
    }),
  );
  const cible = ficheClient({
    numero: "AXI-CLI-999",
    raisonSociale: "Martin Industrie",
    siren: SIREN,
    adresseVille: "Lyon",
  });
  return { fiches, cible };
}

describe("⛔ le SIREN et l'adresse sont vus au-delà du plafond", () => {
  it("250 fiches à Lyon, la fiche au même SIREN est la dernière : refus quand même", async () => {
    const { fiches, cible } = villeChargee();
    const db = baseEnMemoire({ clients: [...fiches, cible] });
    const r = await creerOuRetrouverClient(
      commePrisma(db),
      { raisonSociale: "Martin Industrie SAS", siren: SIREN, adresseVille: "Lyon" },
      null,
      { parAdminId: "admin-1" },
    );
    expect(r.statut).toBe("refuse_siren");
    if (r.statut !== "refuse_siren") return;
    expect(r.fiche.numero).toBe("AXI-CLI-999");
    expect(db.etat.clients).toHaveLength(251);
  });

  it("250 fiches à Lyon, la fiche à la même adresse est la dernière : elle est proposée", async () => {
    const { fiches, cible } = villeChargee();
    const contact = personne(cible.id, "Jeanne Martin");
    const db = baseEnMemoire({
      clients: [...fiches, cible],
      contacts: [contact],
      adresses: [adresse(contact.id, "jeanne@martin-industrie.fr")],
    });
    const candidat = preparerCandidat({
      raisonSociale: "Autre nom",
      emails: ["Jeanne@Martin-Industrie.fr"],
      ville: "Lyon",
    });
    const lues = await chargerFichesCandidates(commePrisma(db), candidat);
    expect(lues.some((f) => f.numero === "AXI-CLI-999")).toBe(true);
  });

  it("contre-témoin : 250 fiches de la même ville sans SIREN commun ne bloquent pas", async () => {
    const { fiches } = villeChargee();
    const db = baseEnMemoire({ clients: fiches });
    const r = await creerOuRetrouverClient(
      commePrisma(db),
      { raisonSociale: "Martin Industrie", siren: SIREN, adresseVille: "Lyon" },
      null,
      { parAdminId: null },
    );
    expect(r.statut).not.toBe("refuse_siren");
  });
});
