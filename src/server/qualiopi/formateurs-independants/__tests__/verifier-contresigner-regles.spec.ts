/**
 * Écran W-4 « Vérifier et contresigner » (lot L9) — cinq blocs, un bouton
 * grisé avec sa raison. Pur.
 */

import { describe, expect, it } from "vitest";

import {
  MANQUE_DOSSIER_ENVOYE,
  MOTIFS_ORANGE,
  blocsW4,
  manquesPourContresigner,
  raisonGrise,
  motifRefus,
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
    controle: {
      statut: "vert",
      dernierAt: new Date("2026-10-11T07:12:00Z"),
      raison: null,
      motifs: [],
    },
    nda: { renseigne: true, vuSurListe: true },
    attestation: { id: "att", statutValidation: "en_attente", code: "A1B2C3D4", prouvee: false },
    pieces: { cv: piece(), rcPro: null, rib: piece() },
    dossier: { cvDate: true, regimeTva: true, iban: true, declarations: true },
    habilitationsActives: 0,
    contrat: { id: "c", numero: "CST-1", statutSignature: "partielle" },
    actif: false,
    finCollaboration: false,
    dossierStatut: "a_verifier",
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
        raison: null,
        motifs: ["etablissement_ferme"],
      },
    });
    expect(manquesPourContresigner(f, coche)).toContain("une entreprise active au registre");
    expect(refusPossible(f)).toBe(true);
    expect(refusPossible(faits())).toBe(false);
    // F13 dit « entreprise fermée » pour un établissement fermé (code, pas libellé).
    expect(motifRefus(f)).toBe("entreprise fermée");
  });

  it("registre orange : « J'ai vérifié » ET un motif de la liste sont exigés", () => {
    const f = faits({
      controle: {
        statut: "orange_a_valider",
        dernierAt: null,
        raison: null,
        motifs: ["activite_a_controler"],
      },
    });
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
      dossier: { cvDate: true, regimeTva: false, iban: true, declarations: true },
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

  it("CV sans date ou de plus de 24 mois : rouge avant de contresigner (même test que la garde)", () => {
    const f = faits({
      dossier: { cvDate: false, regimeTva: true, iban: true, declarations: true },
    });
    expect(manquesPourContresigner(f, coche)).toEqual(["un CV daté de moins de 24 mois"]);
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

describe("C4 — l'état du dossier", () => {
  it.each(["en_cours", "a_completer"])(
    "dossier « %s » : un seul manque, clair",
    (dossierStatut) => {
      expect(manquesPourContresigner(faits({ dossierStatut }), coche)).toEqual([
        MANQUE_DOSSIER_ENVOYE,
      ]);
    },
  );

  it("dossier à vérifier, ou fiche créée en console : rien ne manque", () => {
    expect(manquesPourContresigner(faits({ dossierStatut: "a_verifier" }), coche)).toEqual([]);
    expect(manquesPourContresigner(faits({ dossierStatut: null }), coche)).toEqual([]);
  });

  it("« vérifié » : seulement en reprise, une fois le contrat contresigné", () => {
    expect(manquesPourContresigner(faits({ dossierStatut: "verifie" }), coche)).toEqual([
      MANQUE_DOSSIER_ENVOYE,
    ]);
    expect(
      manquesPourContresigner(
        faits({
          dossierStatut: "verifie",
          contrat: { id: "c", numero: "CST-1", statutSignature: "signee" },
        }),
        coche,
      ),
    ).toEqual([]);
  });
});
