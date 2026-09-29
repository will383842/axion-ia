/**
 * ⛔ UNE ADRESSE GMAIL NE RAPPROCHE JAMAIS DEUX FICHES PAR SON DOMAINE (plan
 * §3.17, signal 3 : « domaine pro, hors `DOMAINES_WEBMAIL` »).
 *
 * Deux inconnus en @gmail.com ne sont pas la même société. La liste des
 * webmails est CELLE du dépôt (`src/lib/email/nature-adresse.ts`), jamais
 * recopiée.
 *
 * Mutation qui fait rougir : construire `domainesPro` sans filtrer
 * `natureAdresse(e) === "pro"`.
 * Contre-témoin : deux adresses d'un même domaine PRO rapprochent.
 * Angle mort : un petit fournisseur d'accès absent de la liste serait pris
 * pour un domaine pro ; la liste est large, et le doute y penche vers « perso ».
 */

import { describe, expect, it } from "vitest";
import { preparerCandidat, trouverFichesProches, type FicheConnue } from "../porte-client";

function fiche(domaines: string[], hashes: string[] = []): FicheConnue {
  return {
    id: "f1",
    numero: "AXI-CLI-001",
    raisonSociale: "Société Existante",
    siren: null,
    adresseVille: null,
    adresseCodePostal: null,
    emailHashes: hashes,
    domainesPro: domaines,
    absorbee: false,
  };
}

describe("⛔ une adresse gmail ne rapproche jamais par domaine", () => {
  it.each(["gmail.com", "hotmail.fr", "outlook.com", "orange.fr", "yahoo.co.uk"])(
    "« %s » n'est jamais un domaine pro",
    (domaine) => {
      const c = preparerCandidat({ raisonSociale: "Inconnu", emails: [`paul@${domaine}`] });
      expect(c.domainesPro).toEqual([]);
      // Même si, par erreur, une fiche portait ce domaine : aucun rapprochement.
      expect(trouverFichesProches(c, [fiche([domaine])])).toEqual([]);
    },
  );

  it("contre-témoin : un domaine pro commun rapproche", () => {
    const c = preparerCandidat({ raisonSociale: "Inconnu", emails: ["paul@fictive-pro.example"] });
    expect(trouverFichesProches(c, [fiche(["fictive-pro.example"])])).toEqual([
      expect.objectContaining({ signal: "domaine", force: "proposition" }),
    ]);
  });

  it("un particulier n'est jamais rapproché par domaine, même pro", () => {
    const c = preparerCandidat({
      type: "particulier",
      raisonSociale: "Paul Fictif",
      emails: ["paul@fictive-pro.example"],
    });
    expect(trouverFichesProches(c, [fiche(["fictive-pro.example"])])).toEqual([]);
  });
});
