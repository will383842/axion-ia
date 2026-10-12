// @vitest-environment node

/**
 * F24 — « La proposition de mission du … est close » (L11c). Relecture du
 * 2e tour de #1502 : aucun test ne couvrait ses interrupteurs ni le cas de
 * l'organisme sous-traitant.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  allumes: new Set<string>(),
  envoyer: vi.fn(async (..._a: unknown[]) => "envoye"),
}));

vi.mock("../envois", () => ({ envoyer: h.envoyer }));
vi.mock("../interrupteur-allume", () => ({
  interrupteurAllume: vi.fn(async (cle: string) => h.allumes.has(cle)),
}));
vi.mock("../interrupteurs-envoi", () => ({
  envoiAllume: vi.fn(async (cle: string) => h.allumes.has(cle)),
}));

import { notifierPropositionClose } from "../proposition-close";

const MISSION = {
  id: "00000000-0000-4000-8000-000000000021",
  solliciteAt: new Date("2026-10-05T08:00:00Z"),
  trainerId: "00000000-0000-4000-8000-000000000011",
  trainer: {
    statut: "sous_traitant",
    organismeSousTraitantId: null as string | null,
    prenom: "Marie",
    email: "marie@example.test",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.allumes.clear();
});

describe("F24 — proposition close", () => {
  it("interrupteurs absents : rien ne part", async () => {
    await notifierPropositionClose(MISSION);
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("un seul des deux interrupteurs du moteur : rien ne part", async () => {
    for (const seul of ["formateurs.lettre_auto", "lettre_auto", "lettre_v2"]) {
      h.allumes.clear();
      h.allumes.add(seul);
      await notifierPropositionClose(MISSION);
    }
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("les deux allumés : F24 part une fois, avec un jobId déterministe", async () => {
    h.allumes.add("lettre_auto").add("lettre_v2");
    await notifierPropositionClose(MISSION);
    expect(h.envoyer).toHaveBeenCalledTimes(1);
    expect(h.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "formateur-proposition-close",
        jobId: `formateur-proposition-close-${MISSION.id}`,
        payload: { prenom: "Marie", valeurs: { date: "5 octobre 2026" } },
      }),
    );
  });

  it("intervenant d'un organisme sous-traitant, ou salarié : rien ne part", async () => {
    h.allumes.add("lettre_auto").add("lettre_v2");
    await notifierPropositionClose({
      ...MISSION,
      trainer: { ...MISSION.trainer, organismeSousTraitantId: "org-1" },
    });
    await notifierPropositionClose({
      ...MISSION,
      trainer: { ...MISSION.trainer, statut: "salarie" },
    });
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("un envoi en erreur ne lève jamais", async () => {
    h.allumes.add("lettre_auto").add("lettre_v2");
    h.envoyer.mockRejectedValueOnce(new Error("file indisponible"));
    await expect(notifierPropositionClose(MISSION)).resolves.toBeUndefined();
  });
});
