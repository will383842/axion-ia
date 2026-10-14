// @vitest-environment node

/**
 * Lot 8A — la console d'une session à deux formateurs : seul celui qui anime la DERNIÈRE
 * journée doit le bilan ; l'autre est payé sur ses feuilles, et la console le dit avec la
 * même phrase que son espace.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION = "a5a5a5a5-0000-4000-8000-00000000000a";
const P = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const h = vi.hoisted(() => ({
  prisma: {
    trainingSession: { findUnique: vi.fn() },
    trainer: { findMany: vi.fn() },
    emargementContresignature: { findMany: vi.fn() },
    bilanFinFormation: { findMany: vi.fn() },
    setting: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: async () => true,
}));

import { lireBilansConsole } from "../console";
import { LIBELLE_BILAN_REMIS_PAR_LA_DERNIERE } from "../../paiement/formation-complete";

const jour = (d: string, trainerId: string | null) => ({
  date: new Date(`${d}T00:00:00Z`),
  heureDebut: "09:00",
  heureFin: "17:00",
  trainerId,
});

beforeEach(() => {
  h.prisma.trainingSession.findUnique.mockResolvedValue({
    formateurPrincipalId: P,
    sessionFormateurs: [{ trainerId: P }, { trainerId: CO }],
    jours: [jour("2026-11-04", CO), jour("2026-11-05", P)],
  });
  h.prisma.trainer.findMany.mockResolvedValue([
    { id: CO, nom: "Co", prenom: "Anne", statut: "sous_traitant", organismeSousTraitantId: null },
    {
      id: P,
      nom: "Principal",
      prenom: "Paul",
      statut: "sous_traitant",
      organismeSousTraitantId: null,
    },
  ]);
  h.prisma.emargementContresignature.findMany.mockResolvedValue([
    { trainerId: CO, date: new Date("2026-11-04T00:00:00Z"), demiJournee: "matin" },
    { trainerId: CO, date: new Date("2026-11-04T00:00:00Z"), demiJournee: "apres_midi" },
  ]);
  h.prisma.bilanFinFormation.findMany.mockResolvedValue([]);
  h.prisma.setting.findUnique.mockResolvedValue({
    value: { actif: true, allumeLe: "2026-10-01T08:00:00Z" },
    updatedAt: null,
  });
});

describe("console — co-formateur", () => {
  it("le principal (dernière journée) doit le bilan ; le co-formateur n'en doit aucun", async () => {
    const lignes = await lireBilansConsole(SESSION);
    const co = lignes?.find((l) => l.trainerId === CO);
    const principal = lignes?.find((l) => l.trainerId === P);
    expect(principal).toMatchObject({ remetLeBilan: true, exige: true });
    expect(co).toMatchObject({ remetLeBilan: false, exige: false });
    // Ses feuilles seules décident : complètes, rien ne retient son paiement.
    expect(co?.motif).toBeNull();
    expect(LIBELLE_BILAN_REMIS_PAR_LA_DERNIERE).toContain("dernière journée");
  });
});
