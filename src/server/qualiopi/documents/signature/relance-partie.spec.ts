/**
 * `partieARelancer` — qui relancer par e-mail, type par type, statut par statut.
 *
 * La table `en_attente` est écrite EN EXTENSION sur tous les types signables :
 * si un circuit change dans `parties-requises.ts` (partie ajoutée, ordre
 * modifié), ce spec doit casser et forcer une décision explicite sur le bouton
 * de relance — plutôt qu'un bouton qui apparaît ou disparaît en silence.
 */

import { describe, expect, it } from "vitest";
import { circuitPour, TYPES_SIGNABLES } from "./parties-requises";
import { partieARelancer } from "./relance-partie";

describe("partieARelancer — statut en_attente (personne n'a signé)", () => {
  const attendu: Record<string, string | null> = {
    devis: "client",
    convention: "client",
    convention_tripartite: "client",
    // Contrat L.6353-3 : conclu avec un PARTICULIER — le circuit dit
    // `beneficiaire`, et l'action refuserait `client` (hors circuit).
    contrat: "beneficiaire",
    contrat_sous_traitance: "sous_traitant",
    // 2026-08-10 (décision Will) : `protocole_afest` retiré de la table — son
    // circuit a disparu avec le module AFEST 1-to-1.
    // Canal B — le formateur signe authentifié depuis son espace :
    // `resoudreIdentite` refuse d'émettre un lien public pour lui.
    lettre_mission: null,
    releve_connexion: null,
    // Consentement d'image : le stagiaire signe, et personne ne le RELANCE.
    // Relancer quelqu'un pour qu'il consente, c'est exercer une pression — or un
    // consentement obtenu sous pression n'est pas libre, donc pas valable.
    autorisation_captation: null,
  };

  it("couvre exactement les types signables du SSOT", () => {
    expect(Object.keys(attendu).sort()).toEqual([...TYPES_SIGNABLES].sort());
  });

  for (const [type, partie] of Object.entries(attendu)) {
    it(`${type} → ${partie ?? "aucun bouton"}`, () => {
      expect(partieARelancer(type, "en_attente")).toBe(partie);
    });
  }
});

describe("partieARelancer — statut partielle (la prochaine partie du circuit)", () => {
  it("convention : le client a signé → contreseing organisme, pas de relance e-mail", () => {
    expect(partieARelancer("convention", "partielle", ["client"])).toBeNull();
  });

  it("tripartite : le client a signé → relancer le financeur", () => {
    expect(partieARelancer("convention_tripartite", "partielle", ["client"])).toBe("financeur");
  });

  it("tripartite : client + financeur ont signé → contreseing organisme, null", () => {
    expect(
      partieARelancer("convention_tripartite", "partielle", ["client", "financeur"]),
    ).toBeNull();
  });

  it("protocole AFEST : circuit disparu → jamais de relance (module supprimé 2026-08-10)", () => {
    expect(partieARelancer("protocole_afest", "partielle", ["axionia"])).toBeNull();
  });

  it("contrat : le bénéficiaire a signé → contreseing organisme, null", () => {
    expect(partieARelancer("contrat", "partielle", ["beneficiaire"])).toBeNull();
  });

  it("lettre de mission : le formateur a signé → contreseing organisme, null", () => {
    expect(partieARelancer("lettre_mission", "partielle", ["formateur"])).toBeNull();
  });

  it("données incohérentes — toutes les parties signées mais statut partielle → null", () => {
    expect(partieARelancer("convention", "partielle", ["client", "axionia"])).toBeNull();
  });
});

describe("partieARelancer — statuts et types hors périmètre", () => {
  it.each(["signee", "refusee", "expiree", "non_requise"])("statut %s → null", (statut) => {
    expect(partieARelancer("convention", statut)).toBeNull();
  });

  it("type non signable (facture, convocation…) → null", () => {
    expect(partieARelancer("facture", "en_attente")).toBeNull();
    expect(partieARelancer("convocation", "partielle")).toBeNull();
    expect(partieARelancer("type_inconnu", "en_attente")).toBeNull();
  });
});

describe("propriétés — quel que soit le type et l'état", () => {
  const statuts = ["en_attente", "partielle", "signee", "refusee", "expiree", "non_requise"];

  it("ne rend JAMAIS une partie hors circuit, ni une partie non joignable par e-mail", () => {
    for (const type of TYPES_SIGNABLES) {
      const circuit = circuitPour(type);
      expect(circuit).not.toBeNull();
      const sousEnsembles: string[][] = [
        [],
        ...circuit!.parties.map((_, i) => circuit!.parties.slice(0, i + 1) as string[]),
      ];
      for (const statut of statuts) {
        for (const signees of sousEnsembles) {
          const partie = partieARelancer(type, statut, signees);
          if (partie === null) continue;
          expect(circuit!.parties).toContain(partie);
          expect(["client", "beneficiaire", "sous_traitant", "financeur"]).toContain(partie);
          // Jamais une partie déjà signataire : l'action répondrait
          // « cette partie a déjà signé cette pièce ».
          expect(signees).not.toContain(partie);
        }
      }
    }
  });
});
