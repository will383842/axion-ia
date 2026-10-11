/**
 * Écran W-4 « Vérifier et contresigner » (lot L9) — cinq blocs, un bouton
 * grisé avec sa raison. Pur.
 */

import { describe, expect, it } from "vitest";

import {
  MOTIFS_ORANGE,
  blocsW4,
  manquesPourContresigner,
  raisonGrise,
  refusPossible,
  type FaitsW4,
  type SaisieW4,
} from "../verifier-contresigner-regles";

const piece = (statutValidation = "en_attente") => ({
  id: "p",
  statutValidation,
  fichierPresent: true,
});

function faits(extra: Partial<FaitsW4> = {}): FaitsW4 {
  return {
    controle: { statut: "vert", dernierAt: new Date("2026-10-11T07:12:00Z"), raison: null },
    nda: { renseigne: true, vuSurListe: true },
    attestation: { id: "att", statutValidation: "en_attente", code: "A1B2C3D4", prouvee: false },
    pieces: { cv: piece(), rcPro: null, rib: piece() },
    dossier: { regimeTva: true, iban: true, declarations: true },
    habilitationsActives: 0,
    contrat: { id: "c", numero: "CST-1", statutSignature: "partielle" },
    actif: false,
    finCollaboration: false,
    ...extra,
  };
}

const vide: SaisieW4 = {
  codeAttestation: "A1B2C3D4",
  attestationAuthentique: false,
  piecesVerifiees: false,
  formationIds: [],
  orangeVerifie: false,
  motifOrange: null,
};

const coche: SaisieW4 = {
  ...vide,
  attestationAuthentique: true,
  piecesVerifiees: true,
  formationIds: ["f1"],
};

describe("écran W-4 — bouton grisé avec la raison (maquette)", () => {
  it("rien de coché : la ligne de la maquette, mot pour mot", () => {
    expect(raisonGrise(manquesPourContresigner(faits(), vide))).toBe(
      "Pour contresigner, il manque : l'attestation vérifiée · les pièces vérifiées · au moins une formation.",
    );
  });

  it("tout coché : bouton actif", () => {
    expect(manquesPourContresigner(faits(), coche)).toEqual([]);
  });

  it("« Authentique » sans code bien formé ne compte pas", () => {
    expect(manquesPourContresigner(faits(), { ...coche, codeAttestation: "x" })).toEqual([
      "l'attestation vérifiée",
    ]);
  });

  it("aucune formation n'est cochée d'office : une habilitation existante suffit", () => {
    expect(
      manquesPourContresigner(faits({ habilitationsActives: 1 }), { ...coche, formationIds: [] }),
    ).toEqual([]);
  });

  it("contrat non signé par le formateur : refus", () => {
    expect(manquesPourContresigner(faits({ contrat: null }), coche)).toEqual([
      "le contrat signé par le formateur",
    ]);
  });

  it("registre rouge : jamais contresignable, refus proposé", () => {
    const f = faits({
      controle: {
        statut: "rouge",
        dernierAt: null,
        raison: "L'entreprise est cessée au registre.",
      },
    });
    expect(manquesPourContresigner(f, coche)).toContain("une entreprise active au registre");
    expect(refusPossible(f)).toBe(true);
    expect(refusPossible(faits())).toBe(false);
  });

  it("registre orange : « J'ai vérifié » ET un motif de la liste sont exigés", () => {
    const f = faits({ controle: { statut: "orange_a_valider", dernierAt: null, raison: null } });
    expect(manquesPourContresigner(f, coche)).toEqual(["la vérification du registre"]);
    expect(
      manquesPourContresigner(f, { ...coche, orangeVerifie: true, motifOrange: "ok" }),
    ).toEqual(["la vérification du registre"]);
    expect(
      manquesPourContresigner(f, { ...coche, orangeVerifie: true, motifOrange: MOTIFS_ORANGE[0] }),
    ).toEqual([]);
  });

  it("numéro de déclaration pas encore sur la liste publique : à vérifier aussi", () => {
    const f = faits({ nda: { renseigne: true, vuSurListe: false } });
    expect(manquesPourContresigner(f, coche)).toEqual(["la vérification du registre"]);
  });

  it("pièce ou donnée de dossier absente : rouge, pas de case à cocher qui la remplace", () => {
    const f = faits({
      pieces: { cv: null, rcPro: null, rib: piece() },
      dossier: { regimeTva: false, iban: true, declarations: true },
    });
    expect(manquesPourContresigner(f, coche)).toEqual(["le CV", "le régime de TVA"]);
    expect(blocsW4(f, coche).find((b) => b.cle === "pieces")?.pastille).toBe("rouge");
  });

  it("attestation absente ou refusée : rouge", () => {
    expect(manquesPourContresigner(faits({ attestation: null }), coche)).toEqual([
      "l'attestation URSSAF",
    ]);
    expect(
      manquesPourContresigner(
        faits({ attestation: { id: "a", statutValidation: "rejete", code: null, prouvee: false } }),
        coche,
      ),
    ).toEqual(["l'attestation URSSAF"]);
  });

  it("fin de collaboration : rien n'est possible", () => {
    expect(manquesPourContresigner(faits({ finCollaboration: true }), coche)).toEqual([
      "une collaboration en cours",
    ]);
  });

  it("cinq blocs, dans l'ordre de la maquette", () => {
    expect(blocsW4(faits(), vide).map((b) => [b.titre, b.pastille])).toEqual([
      ["1 · Entreprise", "vert"],
      ["2 · Numéro de déclaration", "vert"],
      ["3 · Attestation URSSAF", "a_faire"],
      ["4 · Pièces", "a_faire"],
      ["5 · Formations qu'il anime", "a_faire"],
    ]);
  });

  it("aucun mot interdit dans les textes de l'écran", () => {
    const textes = [
      ...blocsW4(faits(), vide).flatMap((b) => [b.titre, b.detail]),
      raisonGrise(manquesPourContresigner(faits({ contrat: null, attestation: null }), vide)),
      ...MOTIFS_ORANGE,
    ].join(" ");
    expect(textes).not.toMatch(
      /poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|grenoble/i,
    );
  });
});
