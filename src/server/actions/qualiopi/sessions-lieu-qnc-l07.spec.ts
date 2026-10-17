/**
 * Tests — setSessionLieuAction derrière `qualiopi.moyens.actif` (chantier QNC, lot L07).
 * Éteint = inchangé ; allumé = lien Zoom en distanciel, motif exigé, journal avant/après.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ valeur: "eteint" as "eteint" | "essai" | "actif" }));
const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn().mockResolvedValue({}),
  journal: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    trainingSession: { update: (...a: unknown[]) => m.update(...a) },
    sessionChangementModaliteLieu: { create: (...a: unknown[]) => m.journal(...a) },
  };
  return {
    prisma: {
      trainingSession: {
        findUnique: (...a: unknown[]) => m.findUnique(...a),
        update: (...a: unknown[]) => m.update(...a),
      },
      adminUser: { findUnique: vi.fn().mockResolvedValue({ name: "Will" }) },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "u1", role: "admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "u1", role: "admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/socle/interrupteurs", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/socle/interrupteurs")>()),
  lireInterrupteurQualiopi: vi.fn(async () => etat.valeur),
}));

import { logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { setSessionLieuAction } from "./sessions";

const ID = "11111111-1111-4111-8111-111111111111";
const AVANT = {
  modalite: "presentiel",
  lieuType: "nos_locaux",
  lieuIntitule: "Salle",
  lieuAdresse: null,
  lieuCodePostal: null,
  lieuVille: "Lyon",
  lieuSalle: null,
  lieuVisioUrl: null,
  contactSurPlaceNom: null,
  contactSurPlaceTelephone: null,
  consignesAcces: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  etat.valeur = "eteint";
  m.findUnique.mockResolvedValue({ ...AVANT, estTestInterne: false });
});

describe("setSessionLieuAction — une seule lecture, protégée", () => {
  it("lit estTestInterne dans la lecture `avant`, et le journal d'activité ne le porte pas", async () => {
    await setSessionLieuAction({ id: ID, lieuVille: "Lyon" });
    expect(m.findUnique).toHaveBeenCalledOnce();
    expect(m.findUnique.mock.calls[0]![0].select).toMatchObject({
      estTestInterne: true,
      modalite: true,
    });
    const log = vi.mocked(logQualiopiActivity).mock.calls[0]![0] as {
      changes: { avant: Record<string, unknown> };
    };
    expect(log.changes.avant).toEqual(AVANT);
  });
  it("base en échec : message propre, aucune exception", async () => {
    m.findUnique.mockRejectedValueOnce(new Error("base injoignable"));
    expect(await setSessionLieuAction({ id: ID, lieuVille: "Lyon" })).toEqual({
      error: "Erreur lors de la lecture de la session",
    });
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe("setSessionLieuAction — éteint = inchangé", () => {
  it("change la modalité sans motif ni lien, aucune ligne de journal", async () => {
    const r = await setSessionLieuAction({ id: ID, modalite: "distanciel" });
    expect(r).toEqual({ data: { id: ID } });
    expect(m.update).toHaveBeenCalledOnce();
    expect(m.journal).not.toHaveBeenCalled();
  });
});

describe("setSessionLieuAction — allumé", () => {
  beforeEach(() => {
    etat.valeur = "actif";
  });
  it("distanciel sans lien : refusé, rien n'est écrit", async () => {
    const r = await setSessionLieuAction({
      id: ID,
      modalite: "distanciel",
      motif: "Passage à distance",
    });
    expect(r).toEqual({ error: expect.stringContaining("obligatoire") });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("distanciel avec un lien non Zoom : refusé", async () => {
    const r = await setSessionLieuAction({
      id: ID,
      modalite: "distanciel",
      lieuVisioUrl: "https://meet.google.com/a-b-c",
      motif: "Passage à distance",
    });
    expect(r).toEqual({ error: expect.stringContaining("Zoom") });
  });
  it("changement sans motif : refusé", async () => {
    const r = await setSessionLieuAction({
      id: ID,
      modalite: "distanciel",
      lieuVisioUrl: "https://zoom.us/j/123456789",
    });
    expect(r).toEqual({ error: expect.stringContaining("motif") });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("changement motivé : mise à jour + une ligne modalité + une ligne lieu", async () => {
    const r = await setSessionLieuAction({
      id: ID,
      modalite: "distanciel",
      lieuVisioUrl: "https://zoom.us/j/123456789",
      motif: "Le client passe à distance",
    });
    expect(r).toEqual({ data: { id: ID } });
    expect(m.update).toHaveBeenCalledOnce();
    expect(m.journal.mock.calls.map((c) => c[0].data.nature)).toEqual(["modalite", "lieu"]);
    expect(m.journal.mock.calls[0]![0].data).toMatchObject({
      sessionId: ID,
      avant: { modalite: "presentiel" },
      apres: { modalite: "distanciel" },
      auteurNom: "Will",
    });
  });
  it("aucun changement réel : pas de motif exigé, pas de journal", async () => {
    const r = await setSessionLieuAction({ id: ID, lieuVille: "Lyon" });
    expect(r).toEqual({ data: { id: ID } });
    expect(m.journal).not.toHaveBeenCalled();
  });
  it("en essai, n'agit que sur une session du banc d'essai", async () => {
    etat.valeur = "essai";
    expect(await setSessionLieuAction({ id: ID, modalite: "distanciel" })).toEqual({
      data: { id: ID },
    });
    m.findUnique.mockResolvedValue({ ...AVANT, estTestInterne: true });
    expect(await setSessionLieuAction({ id: ID, modalite: "distanciel" })).toEqual({
      error: expect.any(String),
    });
  });
});
