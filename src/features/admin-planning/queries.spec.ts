/**
 * Tests — queries.ts (planning unifié).
 *
 * Cœur de la vue calendrier : union formation + coaching, regroupement par jour
 * Europe/Paris, étalement des formations multi-jours, découpe au mois affiché,
 * filtres, et robustesse au build (Prisma stub → Map vide).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrainingFindMany = vi.fn();
const mockCoachingFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: (...args: unknown[]) => mockTrainingFindMany(...args) },
    coachingSession: { findMany: (...args: unknown[]) => mockCoachingFindMany(...args) },
  },
}));

import { getPlanningMonth } from "./queries";

const LIEU_VIDE = {
  lieuType: null,
  lieuIntitule: null,
  lieuAdresse: null,
  lieuCodePostal: null,
  lieuVille: null,
  lieuSalle: null,
  lieuVisioUrl: null,
};

function formationRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "f1",
    titreSession: "Formation IA",
    dateDebut: new Date("2026-07-09T07:00:00Z"), // 09:00 Paris
    dateFin: new Date("2026-07-09T15:00:00Z"),
    statut: "planifiee",
    ...LIEU_VIDE,
    formateurPrincipal: { prenom: "Ada", nom: "Lovelace" },
    client: { raisonSociale: "Meridian SAS" },
    ...over,
  };
}

function coachingRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "c1",
    interventionSlug: "dirigeant-vision-strategique",
    dateSeance: new Date("2026-07-09T12:00:00Z"), // 14:00 Paris
    dateSeanceFin: null,
    statut: "planifiee",
    beneficiaireNom: "Claire Fontaine",
    beneficiaireEntreprise: "Meridian SAS",
    ...LIEU_VIDE,
    trainer: { prenom: "Alan", nom: "Turing" },
    ...over,
  };
}

beforeEach(() => {
  mockTrainingFindMany.mockReset();
  mockCoachingFindMany.mockReset();
  mockTrainingFindMany.mockResolvedValue([]);
  mockCoachingFindMany.mockResolvedValue([]);
});

describe("getPlanningMonth", () => {
  it("Map vide quand aucune prestation", async () => {
    const byDay = await getPlanningMonth(2026, 7);
    expect(byDay.size).toBe(0);
  });

  it("place une formation d'un jour sur sa case", async () => {
    mockTrainingFindMany.mockResolvedValue([formationRow()]);
    const byDay = await getPlanningMonth(2026, 7);
    expect([...byDay.keys()]).toEqual(["2026-07-09"]);
    const [e] = byDay.get("2026-07-09") ?? [];
    expect(e?.key).toBe("formation:f1");
    expect(e?.formateurNom).toBe("Ada Lovelace");
    expect(e?.clientNom).toBe("Meridian SAS");
  });

  it("étale une formation multi-jours sur CHAQUE case traversée", async () => {
    mockTrainingFindMany.mockResolvedValue([
      formationRow({
        dateDebut: new Date("2026-07-08T07:00:00Z"),
        dateFin: new Date("2026-07-10T15:00:00Z"),
      }),
    ]);
    const byDay = await getPlanningMonth(2026, 7);
    expect([...byDay.keys()].sort()).toEqual(["2026-07-08", "2026-07-09", "2026-07-10"]);
  });

  it("ne garde que les jours DU mois affiché (formation à cheval)", async () => {
    mockTrainingFindMany.mockResolvedValue([
      formationRow({
        dateDebut: new Date("2026-07-31T07:00:00Z"),
        dateFin: new Date("2026-08-02T15:00:00Z"),
      }),
    ]);
    const byDay = await getPlanningMonth(2026, 7);
    expect([...byDay.keys()]).toEqual(["2026-07-31"]);
  });

  it("fusionne formation et coaching le même jour, triés par heure de début", async () => {
    mockTrainingFindMany.mockResolvedValue([formationRow()]); // 09:00 Paris
    mockCoachingFindMany.mockResolvedValue([coachingRow()]); // 14:00 Paris
    const byDay = await getPlanningMonth(2026, 7);
    const day = byDay.get("2026-07-09") ?? [];
    expect(day.map((e) => e.key)).toEqual(["formation:f1", "coaching:c1"]);
    expect(day[1]?.type).toBe("coaching");
  });

  it("le coaching sans dateSeanceFin a fin = null (journée entière)", async () => {
    mockCoachingFindMany.mockResolvedValue([coachingRow()]);
    const byDay = await getPlanningMonth(2026, 7);
    expect(byDay.get("2026-07-09")?.[0]?.fin).toBeNull();
  });

  it("formate le lieu quand il est renseigné", async () => {
    mockTrainingFindMany.mockResolvedValue([
      formationRow({ lieuType: "sur_site", lieuVille: "Grenoble", lieuSalle: "B2" }),
    ]);
    const byDay = await getPlanningMonth(2026, 7);
    expect(byDay.get("2026-07-09")?.[0]?.lieu).toBe("Sur site — Grenoble · Salle B2");
  });

  it("filtre type=formation : le coaching est écarté", async () => {
    mockTrainingFindMany.mockResolvedValue([formationRow()]);
    mockCoachingFindMany.mockResolvedValue([coachingRow()]);
    const byDay = await getPlanningMonth(2026, 7, { type: "formation" });
    expect(byDay.get("2026-07-09")?.map((e) => e.type)).toEqual(["formation"]);
  });

  it("statut=en_cours : le coaching n'est même pas interrogé (statut inexistant)", async () => {
    mockTrainingFindMany.mockResolvedValue([formationRow({ statut: "en_cours" })]);
    const byDay = await getPlanningMonth(2026, 7, { statut: "en_cours" });
    expect(mockCoachingFindMany).not.toHaveBeenCalled();
    expect(byDay.get("2026-07-09")?.[0]?.statut).toBe("en_cours");
  });

  it("statut=realisee : les deux sources sont interrogées", async () => {
    await getPlanningMonth(2026, 7, { statut: "realisee" });
    expect(mockTrainingFindMany).toHaveBeenCalled();
    expect(mockCoachingFindMany).toHaveBeenCalled();
  });

  it("filtre trainerId : propagé aux deux requêtes", async () => {
    await getPlanningMonth(2026, 7, { trainerId: "t-42" });
    const tsWhere = (mockTrainingFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    const csWhere = (mockCoachingFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(tsWhere["formateurPrincipalId"]).toBe("t-42");
    expect(csWhere["trainerId"]).toBe("t-42");
  });

  it("requête fenêtrée : les bornes couvrent le mois avec une marge d'un jour", async () => {
    await getPlanningMonth(2026, 7);
    const where = (mockTrainingFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    const debut = where["dateDebut"] as { lte: Date };
    const fin = where["dateFin"] as { gte: Date };
    expect(fin.gte.toISOString()).toBe("2026-06-30T00:00:00.000Z");
    expect(debut.lte.toISOString()).toBe("2026-08-02T00:00:00.000Z");
  });

  it("build-safety : une erreur Prisma rend une Map vide, sans throw", async () => {
    mockTrainingFindMany.mockRejectedValue(new Error("no db"));
    mockCoachingFindMany.mockRejectedValue(new Error("no db"));
    await expect(getPlanningMonth(2026, 7)).resolves.toBeInstanceOf(Map);
    expect((await getPlanningMonth(2026, 7)).size).toBe(0);
  });

  it("formateur non assigné → formateurNom null", async () => {
    mockTrainingFindMany.mockResolvedValue([formationRow({ formateurPrincipal: null })]);
    const byDay = await getPlanningMonth(2026, 7);
    expect(byDay.get("2026-07-09")?.[0]?.formateurNom).toBeNull();
  });
});
