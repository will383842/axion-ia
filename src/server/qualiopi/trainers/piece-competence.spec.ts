/**
 * Tests — piece-competence.ts : LE prédicat « pièce de compétence probante ».
 *
 * 🔴 Audit initial 2026-09-14 (constat I21-02). Une pièce de compétence
 * (CV, diplôme, certification) VALIDÉE sans fichier couvrait l'indicateur 21 et
 * faisait imprimer « CV joint » / « CV au dossier ». La relecture de la PR #1085
 * a ensuite relevé TROIS définitions de « fichier présent » dans le code, et des
 * lecteurs sans aucune. Ces tests fixent la définition unique.
 *
 * Les valeurs attendues sont écrites EN DUR : un test qui importerait la liste
 * des types pour la comparer à elle-même ne vérifierait rien.
 */

import { describe, it, expect } from "vitest";
import {
  TYPES_PIECE_COMPETENCE,
  aUnFichier,
  estPieceCompetenceProbante,
  estTypePieceCompetence,
  motifPieceNonProbante,
  pieceValideeEcartee,
  prefiltrePieceCompetenceProbante,
} from "./piece-competence";

const NOW = new Date("2026-09-14T12:00:00Z");

function piece(over: Record<string, unknown> = {}) {
  return {
    type: "cv",
    statutValidation: "valide",
    fichierUrl: "https://drive.example/cv.pdf",
    dateExpiration: null as Date | null,
    ...over,
  };
}

describe("TYPES_PIECE_COMPETENCE", () => {
  it("liste exactement le CV, le diplôme et la certification", () => {
    expect([...TYPES_PIECE_COMPETENCE]).toEqual(["cv", "diplome", "certification"]);
    expect(estTypePieceCompetence("diplome")).toBe(true);
    expect(estTypePieceCompetence("assurance_rc_pro")).toBe(false);
    expect(estTypePieceCompetence("autre")).toBe(false);
  });
});

describe("aUnFichier", () => {
  it.each([null, undefined, "", "   ", "\t\n"])("« %j » n'est pas un fichier", (url) => {
    expect(aUnFichier(url)).toBe(false);
  });

  it("une adresse renseignée est un fichier", () => {
    expect(aUnFichier("https://drive.example/cv.pdf")).toBe(true);
  });
});

describe("estPieceCompetenceProbante / motifPieceNonProbante", () => {
  it.each(["cv", "diplome", "certification"])(
    "« %s » validé, avec fichier, sans échéance → probante",
    (type) => {
      expect(estPieceCompetenceProbante(piece({ type }), NOW)).toBe(true);
      expect(motifPieceNonProbante(piece({ type }), NOW)).toBeNull();
    },
  );

  it.each([null, "", "   "])("validée mais fichier « %j » → sans_fichier", (fichierUrl) => {
    expect(estPieceCompetenceProbante(piece({ fichierUrl }), NOW)).toBe(false);
    expect(motifPieceNonProbante(piece({ fichierUrl }), NOW)).toBe("sans_fichier");
  });

  it.each(["en_attente", "rejete"])("statut « %s » → non_validee", (statutValidation) => {
    expect(motifPieceNonProbante(piece({ statutValidation }), NOW)).toBe("non_validee");
  });

  it("échéance passée → expiree ; échéance future → probante", () => {
    const expiree = piece({ type: "certification", dateExpiration: new Date("2026-01-01") });
    const future = piece({ type: "certification", dateExpiration: new Date("2027-01-01") });
    expect(motifPieceNonProbante(expiree, NOW)).toBe("expiree");
    expect(estPieceCompetenceProbante(future, NOW)).toBe(true);
  });

  it("échéance À l'instant même → expirée (même borne que `estValide`)", () => {
    expect(motifPieceNonProbante(piece({ dateExpiration: new Date(NOW) }), NOW)).toBe("expiree");
  });

  it("une pièce HORS compétence ne prouve jamais une compétence, même avec fichier", () => {
    const rc = piece({ type: "assurance_rc_pro" });
    expect(estPieceCompetenceProbante(rc, NOW)).toBe(false);
    expect(motifPieceNonProbante(rc, NOW)).toBe("hors_competence");
  });
});

describe("pieceValideeEcartee — ce que le panneau doit signaler", () => {
  it("validée sans fichier → sans_fichier ; validée expirée → expiree", () => {
    expect(pieceValideeEcartee(piece({ fichierUrl: null }), NOW)).toBe("sans_fichier");
    expect(
      pieceValideeEcartee(piece({ type: "diplome", dateExpiration: new Date("2020-01-01") }), NOW),
    ).toBe("expiree");
  });

  it("rien à signaler : pièce probante, pièce en attente, pièce hors compétence", () => {
    expect(pieceValideeEcartee(piece(), NOW)).toBeNull();
    expect(
      pieceValideeEcartee(piece({ statutValidation: "en_attente", fichierUrl: null }), NOW),
    ).toBeNull();
    expect(
      pieceValideeEcartee(piece({ type: "contrat_travail", fichierUrl: null }), NOW),
    ).toBeNull();
  });
});

describe("prefiltrePieceCompetenceProbante — le rétrécissement SQL", () => {
  it("ne retient en base que ce que le prédicat peut encore accepter", () => {
    expect(prefiltrePieceCompetenceProbante(NOW)).toEqual({
      type: { in: ["cv", "diplome", "certification"] },
      statutValidation: "valide",
      fichierUrl: { not: null },
      OR: [{ dateExpiration: null }, { dateExpiration: { gte: NOW } }],
    });
  });
});
