/**
 * Tests — compétences évaluées.
 *
 * Cette action ferme une non-conformité, pas un manque de confort :
 * `{domaine, niveauMaitrise, verifiedAt}` était LU par les PDF et par un
 * garde-fou, et ÉCRIT par aucun écran.
 * (2026-08-10 : les tests de `setTrainerAfestHabiliteAction` sont partis avec
 * l'action — module AFEST 1-to-1 supprimé, décision Will.)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { trainer: { update: (...a: unknown[]) => update(...a) } },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ user: { id: "admin-1" } })),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireAdminDelete: vi.fn(async () => ({ user: { id: "admin-1" } })),
  logQualiopiActivity: vi.fn(async () => undefined),
}));
vi.mock("@/server/qualiopi/trainers/trainers", () => ({
  isTrainerHabilite: vi.fn(() => ({ ok: true })),
}));
vi.mock("@/server/qualiopi/trainers/documents", () => ({
  getTrainerConformite: vi.fn(async () => ({})),
}));

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  update.mockReset();
  update.mockResolvedValue({ id: ID });
});

describe("setTrainerCompetencesAction", () => {
  it("écrit les trois clés, même quand niveau et date sont absents", async () => {
    const { setTrainerCompetencesAction } = await import("./trainers");
    const res = await setTrainerCompetencesAction({ id: ID, domaines: [{ domaine: "IA " }] });

    expect("data" in res).toBe(true);
    const payload = update.mock.calls[0]![0].data.domainesCompetences;
    // Géométrie STABLE : un objet à clés variables obligerait chaque lecteur à
    // re-tester leur existence.
    expect(payload).toEqual([{ domaine: "IA", niveauMaitrise: "", verifiedAt: "" }]);
  });

  it("conserve le niveau et la date de vérification — la preuve de l'indicateur 21", async () => {
    const { setTrainerCompetencesAction } = await import("./trainers");
    await setTrainerCompetencesAction({
      id: ID,
      domaines: [{ domaine: "IA générative", niveauMaitrise: "expert", verifiedAt: "2026-08-02" }],
    });

    expect(update.mock.calls[0]![0].data.domainesCompetences).toEqual([
      { domaine: "IA générative", niveauMaitrise: "expert", verifiedAt: "2026-08-02" },
    ]);
  });

  it("REMPLACE la liste : un domaine retiré disparaît vraiment", async () => {
    const { setTrainerCompetencesAction } = await import("./trainers");
    await setTrainerCompetencesAction({ id: ID, domaines: [{ domaine: "Seul restant" }] });

    const payload = update.mock.calls[0]![0].data.domainesCompetences as unknown[];
    expect(payload).toHaveLength(1);
  });

  it("refuse un niveau hors barème plutôt que de l'écrire", async () => {
    const { setTrainerCompetencesAction } = await import("./trainers");
    const res = await setTrainerCompetencesAction({
      id: ID,
      domaines: [{ domaine: "IA", niveauMaitrise: "dieu_vivant" }],
    });

    expect("error" in res).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuse un domaine vide", async () => {
    const { setTrainerCompetencesAction } = await import("./trainers");
    expect(
      "error" in (await setTrainerCompetencesAction({ id: ID, domaines: [{ domaine: "" }] })),
    ).toBe(true);
  });
});
