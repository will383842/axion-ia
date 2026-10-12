/**
 * M13 (lot E) — « Mon dossier » dans l'espace formateur, et ce que la console
 * déclenche quand elle tranche une pièce.
 *
 *  - le formateur indépendant dépose une pièce suivie depuis son espace : le dépôt
 *    passe par `deposerPieceFormateur` (antivirus, chiffrement, pièce en attente) ;
 *  - F42 : l'équipe est prévenue, sans nom ni fichier ;
 *  - refus par motif FERMÉ : F41 « Pièce refusée » part avec le motif de la liste ;
 *    un motif libre n'envoie rien ;
 *  - validation : si le dossier était bloqué et ne l'est plus, F57 part une fois et
 *    les missions acceptées du formateur sont réévaluées (le blocage se lève) ;
 *  - tout est ÉTEINT tant que `formateurs.dossier_en_ligne` est coupé, et rien ne
 *    change pour un formateur salarié.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  trainer: { findUnique: vi.fn() },
  trainerDocument: { findUnique: vi.fn(), findMany: vi.fn() },
}));
const allume = vi.hoisted(() => vi.fn());
const depot = vi.hoisted(() => vi.fn());
const notify = vi.hoisted(() => vi.fn());
const envoyer = vi.hoisted(() => vi.fn());
const reevaluer = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-envoi", () => ({
  envoiAllume: allume,
}));
vi.mock("@/server/qualiopi/formateurs-independants/depot", () => ({
  deposerPieceFormateur: depot,
}));
vi.mock("@/server/notifications", () => ({ notify }));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer }));
vi.mock("@/server/qualiopi/formateurs-independants/moteur-mission", () => ({
  reevaluerMissionsDuFormateur: reevaluer,
}));

import {
  deposerDepuisMonDossier,
  lireMonDossier,
} from "@/server/qualiopi/formateurs-independants/mon-dossier";
import { apresDecisionPiece } from "@/server/qualiopi/formateurs-independants/pieces-decision";

const TRAINER = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
const DOC = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const MAINTENANT = new Date("2026-10-12T10:00:00Z");
const JOUR = 24 * 60 * 60 * 1000;

const independant = {
  id: TRAINER,
  statut: "sous_traitant",
  actif: true,
  finCollaborationAt: null,
  prenom: "Camille",
  email: "camille@example.test",
};

function piece(p: Partial<Record<string, unknown>> = {}) {
  return {
    id: DOC,
    trainerId: TRAINER,
    type: "attestation_vigilance_urssaf",
    statutValidation: "valide",
    fichierUrl: null,
    dateEmission: new Date(MAINTENANT.getTime() - 10 * JOUR),
    dateExpiration: null,
    createdAt: new Date(MAINTENANT.getTime() - 9 * JOUR),
    archiveAt: null,
    rejetMotif: null,
    valideAt: MAINTENANT,
    ...p,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  allume.mockResolvedValue(true);
  notify.mockResolvedValue({ ok: true });
  envoyer.mockResolvedValue("envoye");
  reevaluer.mockResolvedValue(0);
});

describe("M13 — dépôt depuis « Mon dossier »", () => {
  const entree = {
    type: "attestation_vigilance_urssaf",
    nomFichier: "attestation.pdf",
    octets: new Uint8Array([37, 80, 68, 70]),
    dateEmission: new Date("2026-10-01T00:00:00Z"),
  };

  it("interrupteur coupé : rien n'est lu ni déposé", async () => {
    allume.mockResolvedValue(false);
    const r = await deposerDepuisMonDossier(TRAINER, entree);
    expect(r.ok).toBe(false);
    expect(depot).not.toHaveBeenCalled();
    expect(db.trainer.findUnique).not.toHaveBeenCalled();
  });

  it("formateur salarié : refusé, aucun dépôt", async () => {
    db.trainer.findUnique.mockResolvedValue({ ...independant, statut: "salarie" });
    const r = await deposerDepuisMonDossier(TRAINER, entree);
    expect(r.ok).toBe(false);
    expect(depot).not.toHaveBeenCalled();
  });

  it("type hors de la liste suivie : refusé (un RIB ne passe pas par ici)", async () => {
    db.trainer.findUnique.mockResolvedValue(independant);
    const r = await deposerDepuisMonDossier(TRAINER, { ...entree, type: "rib" });
    expect(r.ok).toBe(false);
    expect(depot).not.toHaveBeenCalled();
  });

  it("dépose par `deposerPieceFormateur` puis prévient l'équipe (F42) sans nom", async () => {
    db.trainer.findUnique.mockResolvedValue(independant);
    depot.mockResolvedValue({ ok: true, documentId: DOC });
    const r = await deposerDepuisMonDossier(TRAINER, entree);
    expect(r).toEqual({ ok: true, documentId: DOC });
    expect(depot).toHaveBeenCalledWith(
      expect.objectContaining({ trainerId: TRAINER, type: "attestation_vigilance_urssaf" }),
    );
    expect(notify).toHaveBeenCalledWith({
      category: "TRAINER_PIECE_DEPOSEE",
      payload: { trainerId: TRAINER, type: "attestation_vigilance_urssaf" },
    });
    expect(JSON.stringify(notify.mock.calls)).not.toMatch(/Camille|example\.test|attestation\.pdf/);
  });

  it("dépôt refusé (antivirus, format) : aucune alerte", async () => {
    db.trainer.findUnique.mockResolvedValue(independant);
    depot.mockResolvedValue({ ok: false, message: "refusé" });
    const r = await deposerDepuisMonDossier(TRAINER, entree);
    expect(r.ok).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it("lecture : coupée = null ; allumée = l'état de chaque pièce suivie", async () => {
    allume.mockResolvedValueOnce(false);
    expect(await lireMonDossier(TRAINER, MAINTENANT)).toBeNull();
    db.trainer.findUnique.mockResolvedValue(independant);
    db.trainerDocument.findMany.mockResolvedValue([piece()]);
    const v = await lireMonDossier(TRAINER, MAINTENANT);
    expect(v?.bloque).toBe(false);
    expect(v?.pieces.map((p) => p.type)).toEqual([
      "attestation_vigilance_urssaf",
      "assurance_rc_pro",
      "cv",
    ]);
    expect(v?.pieces[0]?.libelle).toMatch(/^Valable jusqu'au/);
  });
});

describe("M13 — la console tranche une pièce", () => {
  it("interrupteur coupé : rien n'est lu, rien ne part", async () => {
    allume.mockResolvedValue(false);
    const b = await apresDecisionPiece({
      documentId: DOC,
      decision: "rejete",
      motifFerme: "illisible",
      maintenant: MAINTENANT,
    });
    expect(b.etat).toBe("coupe");
    expect(db.trainerDocument.findUnique).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("salarié : rien ne change (aucun e-mail, aucune réévaluation)", async () => {
    db.trainerDocument.findUnique.mockResolvedValue({
      ...piece(),
      trainer: { ...independant, statut: "salarie" },
    });
    const b = await apresDecisionPiece({
      documentId: DOC,
      decision: "valide",
      motifFerme: null,
      maintenant: MAINTENANT,
    });
    expect(b.etat).toBe("hors_perimetre");
    expect(envoyer).not.toHaveBeenCalled();
    expect(reevaluer).not.toHaveBeenCalled();
  });

  it("refus par motif fermé : F41 « Pièce refusée » avec le motif de la liste", async () => {
    db.trainerDocument.findUnique.mockResolvedValue({ ...piece(), trainer: independant });
    await apresDecisionPiece({
      documentId: DOC,
      decision: "rejete",
      motifFerme: "autre_nom",
      maintenant: MAINTENANT,
    });
    expect(envoyer).toHaveBeenCalledTimes(1);
    const e = envoyer.mock.calls[0]![0];
    expect(e.gabarit).toBe("formateur-piece-a-renouveler");
    expect(e.payload.etape).toBe(3);
    expect(e.payload.valeurs.motif).toBe("ne correspond pas à votre nom");
    expect(e.jobId).toBe(`fi-piece-refusee-${DOC}`);
    expect(e.entityId).toBe(TRAINER);
  });

  it("refus par motif libre : aucun e-mail", async () => {
    db.trainerDocument.findUnique.mockResolvedValue({ ...piece(), trainer: independant });
    await apresDecisionPiece({
      documentId: DOC,
      decision: "rejete",
      motifFerme: null,
      maintenant: MAINTENANT,
    });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("validation qui lève le blocage : F57 une fois par épisode, missions réévaluées", async () => {
    db.trainerDocument.findUnique.mockResolvedValue({ ...piece(), trainer: independant });
    // Seule pièce de vigilance : avant la décision elle était en attente → dossier bloqué.
    db.trainerDocument.findMany.mockResolvedValue([piece()]);
    reevaluer.mockResolvedValue(2);
    const b = await apresDecisionPiece({
      documentId: DOC,
      decision: "valide",
      motifFerme: null,
      maintenant: MAINTENANT,
    });
    expect(b).toEqual({ etat: "fait", f41: false, f57: true, missions: 2 });
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "formateur-dossier-a-jour",
        jobId: `fi-a-jour-${TRAINER}-${DOC}`,
      }),
    );
    expect(reevaluer).toHaveBeenCalledWith(TRAINER, MAINTENANT);
  });

  it("validation sans blocage avant (une autre attestation valable) : pas de F57", async () => {
    db.trainerDocument.findUnique.mockResolvedValue({ ...piece(), trainer: independant });
    const ancienne = piece({
      id: "11111111-2222-4333-8444-555555555555",
      dateEmission: new Date(MAINTENANT.getTime() - 60 * JOUR),
    });
    db.trainerDocument.findMany.mockResolvedValue([ancienne, piece()]);
    const b = await apresDecisionPiece({
      documentId: DOC,
      decision: "valide",
      motifFerme: null,
      maintenant: MAINTENANT,
    });
    expect(b.etat === "fait" && b.f57).toBe(false);
    expect(envoyer).not.toHaveBeenCalled();
    expect(reevaluer).toHaveBeenCalledTimes(1);
  });

  it("fiche pas encore active (vérification W-4) : pas de F57", async () => {
    db.trainerDocument.findUnique.mockResolvedValue({
      ...piece(),
      trainer: { ...independant, actif: false },
    });
    db.trainerDocument.findMany.mockResolvedValue([piece()]);
    await apresDecisionPiece({
      documentId: DOC,
      decision: "valide",
      motifFerme: null,
      maintenant: MAINTENANT,
    });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("ne lève jamais : une base en panne rend « erreur »", async () => {
    db.trainerDocument.findUnique.mockRejectedValue(new Error("panne"));
    const b = await apresDecisionPiece({
      documentId: DOC,
      decision: "valide",
      motifFerme: null,
      maintenant: MAINTENANT,
    });
    expect(b.etat).toBe("erreur");
  });
});
