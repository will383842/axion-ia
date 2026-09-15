/**
 * Tests — la table de destination des pièces dans un dossier d'audit.
 *
 * La compilation garde qu'aucune valeur d'énumération n'est OUBLIÉE. Elle ne
 * garde pas qu'une valeur est bien CLASSÉE : passer `lettre_mission` ou
 * `contrat_sous_traitance` en « hors dossier » compile, et l'indicateur 27 — à
 * non-conformité majeure — perdrait sa pièce en silence (relecture de la PR
 * 1089, constat n° 7). Ce fichier le fait rougir.
 */

import { describe, it, expect } from "vitest";
import type { DocumentType, TrainerDocumentType } from "../../../../prisma/generated/client";
import {
  destinationPieceFormateur,
  documentJointAuDossierAudit,
  pieceFormateurJointeAuDossierAudit,
} from "./hors-dossier-audit";

describe("pièces du registre", () => {
  const maintenues: DocumentType[] = [
    // Indicateurs 17, 18, 21 et 27 — moyens humains et sous-traitance.
    "lettre_mission",
    "contrat_sous_traitance",
    "liste_formateurs",
    "procedure_sous_traitance",
    "cv_formateur",
    // Parcours du stagiaire.
    "convention",
    "convention_tripartite",
    "convocation",
    "programme",
    "emargement",
    "attestation",
    "certificat_realisation",
    // Indicateurs 4 et 6 — analyse du besoin (arbitrage du 14/09).
    "devis",
  ];
  it.each(maintenues)("« %s » reste JOINT au dossier", (type) => {
    expect(documentJointAuDossierAudit(type)).toBe(true);
  });

  const ecartees: DocumentType[] = [
    "contrat_travail",
    "autofacture_honoraires",
    "facture",
    "avoir",
  ];
  it.each(ecartees)("« %s » est écarté du dossier (il reste au registre)", (type) => {
    expect(documentJointAuDossierAudit(type)).toBe(false);
  });
});

describe("pièces du dossier formateur", () => {
  const maintenues: TrainerDocumentType[] = [
    "contrat_sous_traitance",
    "nda_sous_traitant",
    "attestation_vigilance_urssaf",
    "kbis_avis_sirene",
    "attestation_qualiopi",
    "assurance_rc_pro",
    "cv",
    "diplome",
    "certification",
  ];
  it.each(maintenues)("« %s » reste JOINT à pieces.json", (type) => {
    expect(pieceFormateurJointeAuDossierAudit(type)).toBe(true);
  });

  it("contrat de travail et DPAE sont hors dossier", () => {
    expect(destinationPieceFormateur("contrat_travail")).toBe("hors_dossier");
    expect(destinationPieceFormateur("dpae")).toBe("hors_dossier");
  });

  it("🔴 « autre » est écarté mais À OUVRIR sur demande — type libre, peut porter un RIB ou une pièce d'identité", () => {
    expect(pieceFormateurJointeAuDossierAudit("autre")).toBe(false);
    expect(destinationPieceFormateur("autre")).toBe("sur_demande");
  });
});
