/**
 * Tests — enregistrerVerificationMoyensAction (chantier QNC, lot L07).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ valeur: "eteint" as "eteint" | "essai" | "actif", test: false }));
const log = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const SID = "11111111-1111-4111-8111-111111111111";

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi
    .fn()
    .mockResolvedValue({ userId: "22222222-2222-4222-8222-222222222222", role: "admin" }),
}));
vi.mock("@/server/qualiopi/socle/interrupteurs", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/socle/interrupteurs")>()),
  lireInterrupteurQualiopi: vi.fn(async () => etat.valeur),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: vi.fn(async () => ({
        dateDebut: new Date(Date.now() + 86_400_000),
        lieuType: "nos_locaux",
        estTestInterne: etat.test,
      })),
    },
    activityLog: { create: (...a: unknown[]) => log(...a) },
  },
}));

import { enregistrerVerificationMoyensAction } from "./verification-moyens";

const BLOC = {
  sessionId: SID,
  salle: true,
  wifi: true,
  projection: true,
  postes: true,
  comptes: true,
  materielStagiaire: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  etat.valeur = "eteint";
  etat.test = false;
});

describe("enregistrerVerificationMoyensAction", () => {
  it("éteint : refus, aucune écriture", async () => {
    expect(await enregistrerVerificationMoyensAction(BLOC)).toEqual({
      error: expect.stringContaining("pas activée"),
    });
    expect(log).not.toHaveBeenCalled();
  });
  it("actif : enregistre une vérification datée avant le début", async () => {
    etat.valeur = "actif";
    expect(await enregistrerVerificationMoyensAction(BLOC)).toEqual({ data: { sessionId: SID } });
    expect(log).toHaveBeenCalledOnce();
  });
  it("essai : seulement sur une session du banc d'essai", async () => {
    etat.valeur = "essai";
    expect(await enregistrerVerificationMoyensAction(BLOC)).toEqual({ error: expect.any(String) });
    etat.test = true;
    expect(await enregistrerVerificationMoyensAction(BLOC)).toEqual({ data: { sessionId: SID } });
  });
});
