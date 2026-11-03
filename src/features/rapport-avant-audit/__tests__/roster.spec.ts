import { describe, expect, it } from "vitest";

import type { LignePersonne, SuiviParPersonne } from "../../questionnaire-preaudit/personnes";
import { rosterAttendusSansReponse } from "../roster";

function ligne(p: Partial<LignePersonne>): LignePersonne {
  return {
    cle: "x",
    role: "collaborateur",
    nom: null,
    fonction: null,
    sourceNom: "equipe",
    email: null,
    sourceEmail: null,
    codeCourt: null,
    rapprochement: null,
    sansCode: false,
    etat: "pas_de_nouvelles",
    recuLe: null,
    nbEnvois: 0,
    pasEncoreLue: false,
    brouillonId: null,
    brouillonMajLe: null,
    ouverture: null,
    taux: null,
    aVerifier: false,
    ...p,
  } as LignePersonne;
}

function suivi(dirigeant: LignePersonne, collaborateurs: LignePersonne[]): SuiviParPersonne {
  return { dirigeant, collaborateurs, referents: [] } as unknown as SuiviParPersonne;
}

describe("roster des attendus sans réponse", () => {
  it("garde les silencieux, écarte les répondants, les écartés et les non prévus", () => {
    const r = rosterAttendusSansReponse([
      suivi(ligne({ role: "dirigeant", nom: "Paul", etat: "recu" }), [
        ligne({ nom: "Sandra", fonction: "ADV", etat: "pas_de_nouvelles" }),
        ligne({ nom: "Marc", etat: "ouvert" }),
        ligne({ nom: "Léa", etat: "ecartee" }),
        ligne({ nom: "Hugo", etat: "pas_de_lien_prevu" }),
        ligne({ nom: "Inès", etat: "recu" }),
        ligne({ role: "non_retrouvee", nom: "Inconnu", etat: "pas_de_nouvelles" }),
      ]),
    ]);
    expect(r.map((p) => p.nom)).toEqual(["Sandra", "Marc"]);
    expect(r[0]).toEqual({ nom: "Sandra", fonction: "ADV", service: null });
  });

  it("une personne qui a répondu à un autre questionnaire n'est pas attendue ; doublons fusionnés", () => {
    const r = rosterAttendusSansReponse([
      suivi(ligne({ role: "dirigeant", nom: "Paul", etat: "recu" }), [ligne({ nom: "Sandra" })]),
      suivi(ligne({ role: "dirigeant", nom: "Paul", etat: "pas_de_nouvelles" }), [
        ligne({ nom: "sandra " }),
        ligne({ nom: "Marc", etat: "recu" }),
      ]),
      suivi(ligne({ role: "dirigeant", nom: "Paul", etat: "recu" }), [ligne({ nom: "Marc" })]),
    ]);
    expect(r.map((p) => p.nom)).toEqual(["Sandra"]);
  });

  it("un dirigeant sans nom attendu est nommé par son rôle", () => {
    const r = rosterAttendusSansReponse([suivi(ligne({ role: "dirigeant", nom: null }), [])]);
    expect(r.map((p) => p.nom)).toEqual(["Dirigeant"]);
  });
});
