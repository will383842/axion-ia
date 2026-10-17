/**
 * Chantier QNC, lot L10 — les Server Actions de veille selon l'interrupteur
 * `qualiopi.veille.actif`.
 *
 *   - ÉTEINT (et ESSAI) = INCHANGÉ : création, modification et suppression
 *     délèguent au service d'avant, avec les mêmes arguments ;
 *   - ALLUMÉ : la RÉÉCRITURE est refusée (modification, suppression, décision
 *     glissée dans la création) ; corriger, décider et archiver passent par
 *     les écritures tracées, auteur = la session.
 *
 * Mutation qui fait rougir : retirer `if (await veilleTraceeActive())` de
 * `updateVeilleAction` → « allumé : la modification est refusée » rougit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/registres/veille-service", () => ({
  creerVeille: vi.fn().mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440020" }),
  updateVeille: vi.fn().mockResolvedValue({}),
  supprimerVeille: vi.fn().mockResolvedValue({}),
  getVeille: vi.fn().mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440020" }),
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "admin" }),
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/socle/interrupteurs", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/socle/interrupteurs")>()),
  lireInterrupteurQualiopi: vi.fn(),
}));

vi.mock("@/server/qualiopi/veille/veille-tracee", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/veille/veille-tracee")>()),
  creerVeilleTracee: vi.fn().mockResolvedValue({ id: "nouvelle" }),
  deciderVeille: vi.fn().mockResolvedValue({ id: "decidee" }),
  corrigerVeille: vi.fn().mockResolvedValue({ id: "corrigee" }),
  archiverVeille: vi.fn().mockResolvedValue({ id: "archivee" }),
}));

vi.mock("@/server/qualiopi/journal/contexte-requete", () => ({
  contexteRequeteQualiopi: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { setting: { findUnique: vi.fn() } } }));

import { lireInterrupteurQualiopi } from "@/server/qualiopi/socle/interrupteurs";
import * as service from "@/server/qualiopi/registres/veille-service";
import * as tracee from "@/server/qualiopi/veille/veille-tracee";
import {
  archiverVeilleAction,
  corrigerVeilleAction,
  creerVeilleAction,
  deciderVeilleAction,
  supprimerVeilleAction,
  updateVeilleAction,
} from "@/server/actions/qualiopi/veille";

const ID = "550e8400-e29b-41d4-a716-446655440020";
const interrupteur = lireInterrupteurQualiopi as ReturnType<typeof vi.fn>;

const CREATION = {
  type: "legale" as const,
  source: "Légifrance",
  titre: "Décret 2026-728",
  contenu: "Le référentiel passe à 33 indicateurs.",
  dateVeille: new Date("2026-10-01T00:00:00.000Z"),
  impact: "Revue de la procédure qualité",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(["eteint", "essai"] as const)("interrupteur %s : rien ne change", (etat) => {
  beforeEach(() => interrupteur.mockResolvedValue(etat));

  it("la création délègue au service d'avant, décision comprise", async () => {
    const r = await creerVeilleAction({ ...CREATION, actionDecidee: "Mettre à jour le livret" });
    expect(r).toEqual({ data: { id: ID } });
    expect(service.creerVeille).toHaveBeenCalledWith({
      ...CREATION,
      actionDecidee: "Mettre à jour le livret",
      creeParId: "admin-uuid",
    });
    expect(tracee.creerVeilleTracee).not.toHaveBeenCalled();
  });

  it("la modification réécrit toujours la ligne, type et date compris", async () => {
    const r = await updateVeilleAction({
      id: ID,
      type: "metiers",
      dateVeille: CREATION.dateVeille,
    });
    expect(r).toEqual({ data: { id: ID } });
    expect(service.updateVeille).toHaveBeenCalledWith(ID, {
      type: "metiers",
      dateVeille: CREATION.dateVeille,
    });
  });

  it("la suppression supprime toujours", async () => {
    expect(await supprimerVeilleAction({ id: ID })).toEqual({ data: { id: ID } });
    expect(service.supprimerVeille).toHaveBeenCalledWith(ID);
  });

  it("les gestes tracés sont refusés : rien ne s'écrit", async () => {
    const d = await deciderVeilleAction({
      id: ID,
      decision: "x".repeat(12),
      pieceModifiee: "aucune",
    });
    const c = await corrigerVeilleAction({
      id: ID,
      titre: "Autre",
      motif: "Faute de frappe sur le titre",
    });
    const a = await archiverVeilleAction({ id: ID, motif: "Doublon de l'entrée précédente" });
    for (const r of [d, c, a])
      expect(r).toMatchObject({ error: expect.stringMatching(/pas encore allumée/) });
    expect(tracee.deciderVeille).not.toHaveBeenCalled();
    expect(tracee.corrigerVeille).not.toHaveBeenCalled();
    expect(tracee.archiverVeille).not.toHaveBeenCalled();
  });
});

describe("interrupteur actif : la réécriture est refusée", () => {
  beforeEach(() => interrupteur.mockResolvedValue("actif"));

  it("la modification est refusée, et rien n'est réécrit", async () => {
    const r = await updateVeilleAction({ id: ID, titre: "Titre réécrit" });
    expect(r).toMatchObject({ error: expect.stringMatching(/ne se modifie plus/) });
    expect(service.updateVeille).not.toHaveBeenCalled();
  });

  it("la suppression est refusée : on archive", async () => {
    const r = await supprimerVeilleAction({ id: ID });
    expect(r).toMatchObject({ error: expect.stringMatching(/archivez-la/) });
    expect(service.supprimerVeille).not.toHaveBeenCalled();
  });

  it("une décision glissée dans la création est refusée : l'IA propose, une personne décide", async () => {
    const r = await creerVeilleAction({ ...CREATION, actionDecidee: "Décidé par le rédacteur" });
    expect(r).toMatchObject({
      error: expect.stringMatching(/ne se saisit pas avec la proposition/),
    });
    expect(tracee.creerVeilleTracee).not.toHaveBeenCalled();
    expect(service.creerVeille).not.toHaveBeenCalled();
  });

  it("la création passe par l'écriture tracée, auteur = la session", async () => {
    const r = await creerVeilleAction(CREATION);
    expect(r).toEqual({ data: { id: "nouvelle" } });
    expect(service.creerVeille).not.toHaveBeenCalled();
    expect(tracee.creerVeilleTracee).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ titre: CREATION.titre, auteurId: "admin-uuid" }),
      expect.objectContaining({ contexte: expect.any(Function) }),
    );
  });

  it("une correction qui renvoie le type ou la date est refusée", async () => {
    const r = await corrigerVeilleAction({
      id: ID,
      titre: "Autre",
      motif: "Correction du titre erroné",
      type: "metiers",
    } as never);
    expect(r).toMatchObject({ error: expect.stringMatching(/ni le type ni la date/) });
    expect(tracee.corrigerVeille).not.toHaveBeenCalled();
  });

  it("décider, corriger, archiver : l'auteur est la session", async () => {
    await deciderVeilleAction({
      id: ID,
      decision: "Mettre à jour le programme",
      pieceModifiee: "AXI-FORM-2026-003",
    });
    await corrigerVeilleAction({
      id: ID,
      contenu: "Analyse complétée",
      motif: "Analyse incomplète à la saisie",
    });
    await archiverVeilleAction({ id: ID, motif: "Doublon de l'entrée du 01/10" });
    expect(tracee.deciderVeille).toHaveBeenCalledWith(
      expect.anything(),
      {
        veilleId: ID,
        decision: "Mettre à jour le programme",
        pieceModifiee: "AXI-FORM-2026-003",
        auteurId: "admin-uuid",
      },
      expect.anything(),
    );
    expect(tracee.corrigerVeille).toHaveBeenCalledWith(
      expect.anything(),
      {
        veilleId: ID,
        contenu: "Analyse complétée",
        motif: "Analyse incomplète à la saisie",
        auteurId: "admin-uuid",
      },
      expect.anything(),
    );
    expect(tracee.archiverVeille).toHaveBeenCalledWith(
      expect.anything(),
      { veilleId: ID, motif: "Doublon de l'entrée du 01/10", auteurId: "admin-uuid" },
      expect.anything(),
    );
  });

  it("un refus métier remonte tel quel", async () => {
    (tracee.archiverVeille as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new tracee.RefusVeille("Cette entrée est archivée."),
    );
    expect(await archiverVeilleAction({ id: ID, motif: "Doublon de l'entrée du 01/10" })).toEqual({
      error: "Cette entrée est archivée.",
    });
  });
});
