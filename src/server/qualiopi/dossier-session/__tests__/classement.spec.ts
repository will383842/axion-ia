/**
 * Chantier QNC, L11 — le classement du dossier de session (module pur).
 *
 * Ce qui est gardé : chaque pièce a un destinataire déclaré ; un e-mail se
 * range d'abord par son gabarit, puis par la pièce ou l'entité qu'il vise ; le
 * badge « non probante » se lit dans l'instantané de rendu ; une contre-trace
 * de remplacement vide n'est pas un remplacement.
 */

import { describe, expect, it } from "vitest";

import { DocumentType } from "../../../../../prisma/generated/client";
import { documentJointAuDossierAudit } from "@/server/qualiopi/conformite/hors-dossier-audit";
import {
  ORDRE_DESTINATAIRES,
  destinataireEmail,
  destinatairePiece,
  emailHorsDossier,
  gabaritsHorsDossier,
  motifNonProbante,
  remplaceePar,
} from "../classement";

describe("destinataire d'une pièce", () => {
  it("chaque type de pièce du schéma a un destinataire connu", () => {
    for (const type of Object.values(DocumentType)) {
      expect(ORDRE_DESTINATAIRES).toContain(destinatairePiece(type));
    }
  });

  it("les pièces que réclame chaque partie vont à cette partie", () => {
    expect(destinatairePiece("convocation")).toBe("stagiaire");
    expect(destinatairePiece("attestation")).toBe("stagiaire");
    expect(destinatairePiece("convention")).toBe("entreprise");
    expect(destinatairePiece("lettre_mission")).toBe("formateur");
    expect(destinatairePiece("certificat_realisation")).toBe("financeur");
    expect(destinatairePiece("emargement")).toBe("organisme");
  });
});

describe("destinataire d'un e-mail", () => {
  it("le gabarit prime sur l'entité visée", () => {
    // L'enquête entreprise est rattachée à une inscription, mais vise l'entreprise.
    expect(
      destinataireEmail({
        template: "qualiopi-enquete-entreprise",
        entityType: "Enrollment",
        typePiece: null,
      }),
    ).toBe("entreprise");
  });

  it("à défaut de gabarit connu : la pièce, puis l'entité, puis l'organisme", () => {
    expect(
      destinataireEmail({
        template: "piece-exemplaire-signe",
        entityType: "DocumentGenere",
        typePiece: "lettre_mission",
      }),
    ).toBe("formateur");
    expect(
      destinataireEmail({ template: "inconnu", entityType: "Questionnaire", typePiece: null }),
    ).toBe("stagiaire");
    expect(destinataireEmail({ template: "inconnu", entityType: null, typePiece: null })).toBe(
      "organisme",
    );
  });
});

describe("hors dossier : facturation, rémunération, employeur", () => {
  it("un e-mail de facture ou visant une pièce hors dossier n'est jamais repris", () => {
    expect(emailHorsDossier("facture-envoi", false)).toBe(true);
    expect(emailHorsDossier("qualiopi-convocation", true)).toBe(true);
    expect(emailHorsDossier("qualiopi-convocation", false)).toBe(false);
  });

  it("les gabarits hors dossier concordent avec les pièces hors dossier", () => {
    expect(documentJointAuDossierAudit("facture")).toBe(false);
    expect(gabaritsHorsDossier()).toContain("facture-envoi");
    expect(gabaritsHorsDossier()).toContain("formateur-contrat-travail");
  });
});

describe("badge « non probante », déduit de renderData", () => {
  it("une pièce déclassée en spécimen le dit, avec son motif", () => {
    expect(
      motifNonProbante({
        renderData: { data: { estSpecimen: true, specimenMotif: "SIRET absent" } },
      }),
    ).toBe("SIRET absent");
  });

  it("repli sur metadata.specimen quand l'instantané manque", () => {
    expect(motifNonProbante({ specimen: true, champsManquants: ["nda"] })).toBe(
      "spécimen — manquent : nda",
    );
  });

  it("une pièce ordinaire est probante", () => {
    expect(motifNonProbante({ renderData: { data: { estCopie: true } } })).toBeNull();
    expect(motifNonProbante({})).toBeNull();
    expect(motifNonProbante(null)).toBeNull();
  });
});

describe("remplacée par", () => {
  it("rend le numéro, et rien pour une contre-trace vide", () => {
    expect(remplaceePar("AXI-ATT-2026-005")).toBe("AXI-ATT-2026-005");
    expect(remplaceePar("  ")).toBeNull();
    expect(remplaceePar(null)).toBeNull();
  });
});
