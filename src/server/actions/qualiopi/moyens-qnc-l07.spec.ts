/**
 * Tests — actions des moyens derrière `qualiopi.moyens.actif` (chantier QNC, lot L07).
 * Éteint = comportement historique INCHANGÉ ; allumé = motif exigé + historique.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ valeur: "eteint" as "eteint" | "essai" | "actif" }));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "u1", role: "admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/socle/interrupteurs", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/socle/interrupteurs")>()),
  lireInterrupteurQualiopi: vi.fn(async () => etat.valeur),
}));
vi.mock("@/server/qualiopi/moyens/moyens-service", () => ({
  creerMoyen: vi.fn().mockResolvedValue({ id: "m1" }),
  updateMoyen: vi.fn().mockResolvedValue({}),
  setMoyenActif: vi.fn().mockResolvedValue({}),
  getMoyen: vi.fn().mockResolvedValue({ id: "m1" }),
}));
const tx = vi.hoisted(() => ({
  moyenPedagogique: { findUnique: vi.fn(), update: vi.fn() },
  moyenPedagogiqueHistorique: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: { findUnique: vi.fn().mockResolvedValue({ name: "Will" }) },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  },
}));

import { creerMoyenAction, setMoyenActifAction, updateMoyenAction } from "./moyens";
import { setMoyenActif, updateMoyen } from "@/server/qualiopi/moyens/moyens-service";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  etat.valeur = "eteint";
  tx.moyenPedagogique.findUnique.mockResolvedValue({
    id: ID,
    categorie: "salle",
    libelle: "A",
    description: "",
    localisation: "",
    actif: true,
    dateVerification: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
});

describe("éteint = inchangé", () => {
  it("modifier sans motif passe par le service historique, sans historique", async () => {
    const r = await updateMoyenAction({ id: ID, libelle: "B" });
    expect(r).toEqual({ data: { id: ID } });
    expect(updateMoyen).toHaveBeenCalledOnce();
    expect(tx.moyenPedagogiqueHistorique.create).not.toHaveBeenCalled();
  });
  it("désactiver sans motif fonctionne comme avant", async () => {
    expect(await setMoyenActifAction({ id: ID, actif: false })).toEqual({ data: { id: ID } });
    expect(setMoyenActif).toHaveBeenCalledOnce();
    expect(tx.moyenPedagogiqueHistorique.create).not.toHaveBeenCalled();
  });
  it("en essai, le lot n'agit pas non plus (aucune session ciblée)", async () => {
    etat.valeur = "essai";
    await updateMoyenAction({ id: ID, libelle: "B" });
    expect(updateMoyen).toHaveBeenCalledOnce();
  });
});

describe("allumé", () => {
  beforeEach(() => {
    etat.valeur = "actif";
  });
  it("exige un motif et n'écrit rien sans lui", async () => {
    const r = await updateMoyenAction({ id: ID, libelle: "B" });
    expect(r).toEqual({ error: expect.stringContaining("motif") });
    expect(tx.moyenPedagogique.update).not.toHaveBeenCalled();
    expect(updateMoyen).not.toHaveBeenCalled();
  });
  it("modifie avec motif : mise à jour + historique", async () => {
    const r = await updateMoyenAction({
      id: ID,
      libelle: "B",
      motif: "Salle rebaptisée après travaux",
    });
    expect(r).toEqual({ data: { id: ID } });
    expect(tx.moyenPedagogique.update).toHaveBeenCalledOnce();
    expect(tx.moyenPedagogiqueHistorique.create).toHaveBeenCalledOnce();
    expect(updateMoyen).not.toHaveBeenCalled();
  });
  it("désactive avec motif, jamais de suppression ; refuse sans motif", async () => {
    expect(await setMoyenActifAction({ id: ID, actif: false })).toEqual({
      error: expect.any(String),
    });
    expect(
      await setMoyenActifAction({ id: ID, actif: false, motif: "Salle fermée définitivement" }),
    ).toEqual({ data: { id: ID } });
    expect(tx.moyenPedagogique.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { actif: false },
    });
  });
  it("refuse une date de vérification antérieure à la création du moyen", async () => {
    const r = await updateMoyenAction({
      id: ID,
      dateVerification: new Date("2025-12-31T00:00:00Z"),
      motif: "Contrôle annuel de la salle",
    });
    expect(r).toEqual({ error: expect.stringContaining("antérieure") });
    expect(tx.moyenPedagogiqueHistorique.create).not.toHaveBeenCalled();
  });
  it("charge COMPLÈTE du formulaire, date inchangée, moyen créé l'après-midi : accepté", async () => {
    tx.moyenPedagogique.findUnique.mockResolvedValue({
      id: ID,
      categorie: "salle",
      libelle: "A",
      description: "",
      localisation: "",
      actif: true,
      dateVerification: new Date("2026-10-16T00:00:00Z"),
      createdAt: new Date("2026-10-16T12:30:00Z"),
    });
    const r = await updateMoyenAction({
      id: ID,
      categorie: "salle",
      libelle: "B",
      description: "",
      localisation: "",
      dateVerification: new Date("2026-10-16"),
      motif: "Salle renommée par le client",
    });
    expect(r).toEqual({ data: { id: ID } });
    expect(tx.moyenPedagogiqueHistorique.create.mock.calls[0]?.[0].data.apres).toEqual({
      libelle: "B",
    });
  });
  it("création : une vérification datée d'aujourd'hui est acceptée", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-16T13:00:00Z"));
      const r = await creerMoyenAction({
        categorie: "salle",
        libelle: "S",
        dateVerification: new Date("2026-10-16"),
      });
      expect(r).toEqual({ data: { id: "m1" } });
    } finally {
      vi.useRealTimers();
    }
  });
  it("création : une date de vérification déjà passée est refusée", async () => {
    const r = await creerMoyenAction({
      categorie: "salle",
      libelle: "S",
      dateVerification: new Date("2026-01-01T00:00:00Z"),
    });
    expect(r).toEqual({ error: expect.stringContaining("antérieure") });
  });
});
