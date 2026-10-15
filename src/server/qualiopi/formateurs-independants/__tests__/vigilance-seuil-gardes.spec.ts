/**
 * Lot G1 — sous le seuil de vigilance, l'attestation URSSAF n'est exigée ni à
 * l'activation, ni à la contresignature (écran W-4), ni à la préparation du contrat, ni
 * à la mission, ni dans le dossier en ligne. Au seuil (ou cumul illisible), tout reste
 * comme avant.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  MANQUES_COMPLETS,
  peutActiverFormateurIndependantComplet,
  type FaitsActivationComplete,
} from "../garde-activation-complete";
import { MANQUES_MISSION, peutRecevoirMission, type FaitsGardeMission } from "../garde-mission";
import { PIECES_FACULTATIVES, manquesEtape3 } from "../dossier-regles";
import {
  blocsW4,
  manquesPourContresigner,
  type FaitsW4,
  type SaisieW4,
} from "../verifier-contresigner-regles";

const MAINTENANT = new Date("2026-10-11T10:00:00Z");
const JOUR = 24 * 3600 * 1000;
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * JOUR);

/** Tout est là, SAUF l'attestation URSSAF. */
function sansAttestation(extra: Partial<FaitsActivationComplete> = {}): FaitsActivationComplete {
  return {
    statut: "sous_traitant",
    finCollaborationAt: null,
    siret: "12345678900011",
    ndaVerifieListeAt: ilYa(2),
    regimeTvaHonoraires: "franchise",
    ibanPresent: true,
    declarationsVersion: "1",
    habilitationsActives: 1,
    contrats: [{ version: 3, statutSignature: "signee", annuleeAt: null, siret: "12345678900011" }],
    controles: [
      {
        verdict: "vert",
        source: "registre_entreprises+liste_of",
        verifieAt: ilYa(1),
        createdAt: ilYa(1),
        siret: "12345678900011",
      },
    ],
    pieces: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        type: "cv",
        statutValidation: "valide",
        fichierUrl: "r2://cv.pdf",
        dateEmission: ilYa(100),
        dateExpiration: null,
      },
    ],
    preuvesVigilance: [],
    ...extra,
  };
}

describe("activation (règle complète)", () => {
  it("sous le seuil (2 700 €) : activable sans attestation", () => {
    expect(
      peutActiverFormateurIndependantComplet(
        sansAttestation({ cumulHonorairesHtCents: 270_000 }),
        MAINTENANT,
      ),
    ).toEqual({ activable: true });
  });

  it("à l'approche (4 200 €) : activable sans attestation (elle est seulement demandée)", () => {
    expect(
      peutActiverFormateurIndependantComplet(
        sansAttestation({ cumulHonorairesHtCents: 420_000 }),
        MAINTENANT,
      ).activable,
    ).toBe(true);
  });

  it("pile au seuil (5 000 €) : l'attestation prouvée est exigée", () => {
    expect(
      peutActiverFormateurIndependantComplet(
        sansAttestation({ cumulHonorairesHtCents: 500_000 }),
        MAINTENANT,
      ),
    ).toEqual({ activable: false, manques: [MANQUES_COMPLETS.vigilance] });
  });

  it("cumul illisible ou absent : exigée (garde fermée, comme avant)", () => {
    for (const faits of [sansAttestation({ cumulHonorairesHtCents: null }), sansAttestation()]) {
      expect(peutActiverFormateurIndependantComplet(faits, MAINTENANT).activable).toBe(false);
    }
  });
});

describe("garde de mission", () => {
  const faits = (cumul: number | null): FaitsGardeMission => ({
    statut: "sous_traitant",
    actif: true,
    finCollaborationAt: null,
    activationValideeSource: "controle",
    sousTraitantVerifieAt: ilYa(3),
    sousTraitantNda: "84123456789",
    sousTraitantContratSigneAt: ilYa(10),
    contratCadreVersion: 3,
    siret: "12345678900011",
    contratCadreSiret: "12345678900011",
    pieces: [],
    cumulHonorairesHtCents: cumul,
  });

  it("sous le seuil : une mission peut être confiée sans attestation", () => {
    expect(peutRecevoirMission(faits(270_000), 3, MAINTENANT)).toEqual({ ok: true });
  });

  it("au seuil : l'attestation valable aujourd'hui est exigée", () => {
    expect(peutRecevoirMission(faits(680_000), 3, MAINTENANT)).toEqual({
      ok: false,
      manques: [MANQUES_MISSION.vigilance],
    });
  });

  it("cumul illisible : exigée", () => {
    expect(peutRecevoirMission(faits(null), 3, MAINTENANT).ok).toBe(false);
  });
});

describe("écran Vérifier et contresigner (W-4)", () => {
  const saisie: SaisieW4 = {
    codeAttestation: "",
    attestationAuthentique: false,
    piecesVerifiees: true,
    formationIds: [],
    orangeVerifie: false,
    motifOrange: null,
  };
  const piece = { id: "p", statutValidation: "valide", fichierPresent: true };
  const faits = (
    attestation: FaitsW4["attestation"],
    vigilanceExigible: boolean | undefined,
  ): FaitsW4 => ({
    controle: { statut: "vert", dernierAt: ilYa(1), raison: null, motifs: [] },
    nda: { renseigne: true, vuSurListe: true },
    attestation,
    ...(vigilanceExigible === undefined ? {} : { vigilanceExigible }),
    pieces: { cv: piece, rcPro: null, rib: piece },
    dossier: { cvDate: true, regimeTva: true, iban: true, declarations: true },
    habilitationsActives: 1,
    contrat: { id: "c", numero: "CST-1", statutSignature: "partielle" },
    actif: false,
    finCollaboration: false,
    dossierStatut: "a_verifier",
  });

  it("sous le seuil, sans attestation : rien ne manque, bloc neutre", () => {
    const f = faits(null, false);
    expect(manquesPourContresigner(f, saisie)).toEqual([]);
    const bloc = blocsW4(f, saisie).find((b) => b.cle === "attestation");
    expect(bloc?.pastille).toBe("neutre");
    expect(bloc?.detail).toContain("Pas exigée");
  });

  it("sous le seuil, attestation déposée spontanément : vérifiable, sans bloquer", () => {
    const a = { id: "a", statutValidation: "en_attente", code: "ABC123456", prouvee: false };
    const f = faits(a, false);
    expect(manquesPourContresigner(f, saisie)).toEqual([]);
    const coche = { ...saisie, codeAttestation: "ABC123456", attestationAuthentique: true };
    expect(blocsW4(f, coche).find((b) => b.cle === "attestation")?.pastille).toBe("vert");
  });

  it("au seuil (ou sans l'information), l'attestation manque comme avant", () => {
    expect(manquesPourContresigner(faits(null, true), saisie)).toContain("l'attestation URSSAF");
    expect(manquesPourContresigner(faits(null, undefined), saisie)).toContain(
      "l'attestation URSSAF",
    );
  });
});

describe("dossier en ligne", () => {
  it("l'attestation est facultative : jamais un manque si elle n'est pas déposée", () => {
    expect(PIECES_FACULTATIVES.has("attestation_vigilance_urssaf")).toBe(true);
    expect(
      manquesEtape3({ nda: "84123456789", piecesDeposees: ["rib", "cv"], codeUrssafSaisi: false }),
    ).toEqual([]);
  });

  it("V2-N-4 — déposée sans son code de sécurité, elle ne bloque pas le dossier", () => {
    expect(
      manquesEtape3({
        nda: "84123456789",
        piecesDeposees: ["rib", "cv", "attestation_vigilance_urssaf"],
        codeUrssafSaisi: false,
      }),
    ).toEqual([]);
  });
});
