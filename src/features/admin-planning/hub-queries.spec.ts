// Tests — hub-queries.ts (couche de lecture du hub).
//
// Ce module ne calcule rien, il RASSEMBLE. Les deux pièges qu'on verrouille ici :
//   - la Map jour→events répète une prestation multi-jours sous chacun de ses
//     jours ; sans dédup, elle se signalerait en conflit avec elle-même et
//     compterait pour trois sessions non staffées ;
//   - on n'interroge la conformité QUE des formateurs affectés (coût), et un
//     formateur introuvable ne doit pas être accusé de non-conformité.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPlanningMonth = vi.fn();
const mockGetChargeMois = vi.fn();
const mockListTrainers = vi.fn();
const mockGetTrainerConformite = vi.fn();
const mockListReleves = vi.fn();
const mockListAnomalies = vi.fn();

vi.mock("./queries", () => ({ getPlanningMonth: (...a: unknown[]) => mockGetPlanningMonth(...a) }));
vi.mock("./charge-queries", () => ({
  getChargeMois: (...a: unknown[]) => mockGetChargeMois(...a),
}));
vi.mock("@/server/qualiopi/trainers/trainers", () => ({
  listTrainers: (...a: unknown[]) => mockListTrainers(...a),
}));
vi.mock("@/server/qualiopi/trainers/documents", () => ({
  getTrainerConformite: (...a: unknown[]) => mockGetTrainerConformite(...a),
}));
vi.mock("@/server/qualiopi/remuneration/queries", () => ({
  listRelevesPeriode: (...a: unknown[]) => mockListReleves(...a),
  listAnomaliesPeriode: (...a: unknown[]) => mockListAnomalies(...a),
}));

const mockListIndispos = vi.fn();
vi.mock("@/server/qualiopi/trainers/availability-queries", () => ({
  listIndisposEntre: (...a: unknown[]) => mockListIndispos(...a),
}));

import { deduplerEvents, formateursAffectes, getHubSignaux } from "./hub-queries";
import type { PlanningEvent } from "./types";

const MAINTENANT = new Date("2026-06-10T12:00:00Z");

function ev(over: Partial<PlanningEvent> = {}): PlanningEvent {
  return {
    key: "formation:1",
    type: "formation",
    id: "1",
    titre: "Formation IA",
    debut: new Date("2026-06-20T08:00:00Z"),
    fin: new Date("2026-06-22T17:00:00Z"),
    statut: "planifiee",
    formateurNom: "Ana Roux",
    formateurId: "t1",
    clientNom: "ACME",
    lieu: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPlanningMonth.mockResolvedValue(new Map());
  mockGetChargeMois.mockResolvedValue([]);
  mockListTrainers.mockResolvedValue([]);
  mockGetTrainerConformite.mockResolvedValue(null);
  mockListReleves.mockResolvedValue([]);
  mockListAnomalies.mockResolvedValue([]);
  mockListIndispos.mockResolvedValue([]);
});

describe("deduplerEvents", () => {
  it("INVARIANT : une prestation multi-jours ne ressort qu'UNE fois", () => {
    const e = ev({ key: "formation:multi" });
    const byDay = new Map([
      ["2026-06-20", [e]],
      ["2026-06-21", [e]],
      ["2026-06-22", [e]],
    ]);
    expect(deduplerEvents(byDay)).toHaveLength(1);
  });

  it("conserve les prestations distinctes", () => {
    const byDay = new Map([["2026-06-20", [ev({ key: "a" }), ev({ key: "b" })]]]);
    expect(
      deduplerEvents(byDay)
        .map((e) => e.key)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("une Map vide donne une liste vide", () => {
    expect(deduplerEvents(new Map())).toEqual([]);
  });
});

describe("formateursAffectes", () => {
  it("ignore les prestations sans formateur", () => {
    expect(formateursAffectes([ev({ formateurId: null })])).toEqual([]);
  });

  it("ignore les prestations annulées ou reportées", () => {
    expect(
      formateursAffectes([ev({ statut: "annulee" }), ev({ key: "b", statut: "reportee" })]),
    ).toEqual([]);
  });

  it("déduplique un formateur présent sur plusieurs prestations", () => {
    expect(formateursAffectes([ev({ key: "a" }), ev({ key: "b" })])).toEqual(["t1"]);
  });
});

describe("getHubSignaux", () => {
  it("n'interroge PAS la conformité quand aucun formateur n'est affecté", async () => {
    mockGetPlanningMonth.mockResolvedValue(new Map([["2026-06-20", [ev({ formateurId: null })]]]));
    await getHubSignaux(2026, 6, "adm", MAINTENANT);
    expect(mockGetTrainerConformite).not.toHaveBeenCalled();
    expect(mockListTrainers).not.toHaveBeenCalled();
  });

  it("interroge la conformité une seule fois par formateur affecté", async () => {
    mockGetPlanningMonth.mockResolvedValue(
      new Map([
        ["2026-06-20", [ev({ key: "a" }), ev({ key: "b" })]],
        ["2026-06-21", [ev({ key: "a" })]],
      ]),
    );
    mockListTrainers.mockResolvedValue([{ id: "t1", prenom: "Ana", nom: "Roux" }]);
    mockGetTrainerConformite.mockResolvedValue({ conforme: true, manquements: [] });

    await getHubSignaux(2026, 6, "adm", MAINTENANT);
    expect(mockGetTrainerConformite).toHaveBeenCalledTimes(1);
  });

  it("un formateur introuvable (conformité null) n'est PAS accusé de non-conformité", async () => {
    mockGetPlanningMonth.mockResolvedValue(new Map([["2026-06-20", [ev()]]]));
    mockListTrainers.mockResolvedValue([{ id: "t1", prenom: "Ana", nom: "Roux" }]);
    mockGetTrainerConformite.mockResolvedValue(null);

    const signaux = await getHubSignaux(2026, 6, "adm", MAINTENANT);
    expect(signaux.map((s) => s.code)).not.toContain("formateur_non_conforme");
  });

  it("ne compte que les manquements BLOQUANTS", async () => {
    mockGetPlanningMonth.mockResolvedValue(new Map([["2026-06-20", [ev()]]]));
    mockListTrainers.mockResolvedValue([{ id: "t1", prenom: "Ana", nom: "Roux" }]);
    mockGetTrainerConformite.mockResolvedValue({
      conforme: false,
      manquements: [
        { code: "a", gravite: "bloquant", type: null, message: "" },
        { code: "b", gravite: "alerte", type: null, message: "" },
        { code: "c", gravite: "bloquant", type: null, message: "" },
      ],
    });

    const signaux = await getHubSignaux(2026, 6, "adm", MAINTENANT);
    const s = signaux.find((x) => x.code === "formateur_non_conforme");
    expect(s?.items[0]?.label).toContain("2 pièces bloquantes");
  });

  it("ne retient que les relevés `brouillon` et `a_valider`", async () => {
    mockListReleves.mockResolvedValue([
      { id: "r1", trainerNom: "Ana", totalTtcCents: 1000, statut: "brouillon" },
      { id: "r2", trainerNom: "Bo", totalTtcCents: 2000, statut: "a_valider" },
      { id: "r3", trainerNom: "Cy", totalTtcCents: 9999, statut: "paye" },
      { id: "r4", trainerNom: "Di", totalTtcCents: 9999, statut: "facture_recue" },
    ]);
    const signaux = await getHubSignaux(2026, 6, "adm", MAINTENANT);
    const s = signaux.find((x) => x.code === "releve_a_valider");
    expect(s?.items).toHaveLength(2);
  });

  it("une formation multi-jours ne se signale pas en conflit avec elle-même", async () => {
    // Garanti par `findConflicts` (qui exclut la cible par sa `key`), PAS par la
    // dédup. Les deux protections sont distinctes ; ce test couvre la première.
    const e = ev({ key: "formation:multi" });
    mockGetPlanningMonth.mockResolvedValue(
      new Map([
        ["2026-06-20", [e]],
        ["2026-06-21", [e]],
        ["2026-06-22", [e]],
      ]),
    );
    mockListTrainers.mockResolvedValue([{ id: "t1", prenom: "Ana", nom: "Roux" }]);
    mockGetTrainerConformite.mockResolvedValue({ conforme: true, manquements: [] });

    const signaux = await getHubSignaux(2026, 6, "adm", MAINTENANT);
    expect(signaux.map((s) => s.code)).not.toContain("conflit_formateur");
  });

  it("RÉGRESSION : une session non staffée de 3 jours compte pour UNE, pas trois", async () => {
    // C'est CE test que la dédup protège : sans elle, le hub annoncerait
    // « 3 prestations sans formateur » là où il n'y en a qu'une, sur trois jours.
    const e = ev({ key: "formation:multi", formateurId: null, formateurNom: null });
    mockGetPlanningMonth.mockResolvedValue(
      new Map([
        ["2026-06-20", [e]],
        ["2026-06-21", [e]],
        ["2026-06-22", [e]],
      ]),
    );

    const signaux = await getHubSignaux(2026, 6, "adm", MAINTENANT);
    const s = signaux.find((x) => x.code === "session_non_staffee");
    expect(s?.items).toHaveLength(1);
    expect(s?.titre).toBe("1 prestation sans formateur");
  });

  it("un mois totalement sain ne produit aucun signal", async () => {
    const signaux = await getHubSignaux(2026, 6, "adm", MAINTENANT);
    expect(signaux).toEqual([]);
  });
});

describe("getHubSignaux — indisponibilités", () => {
  it("interroge une fenêtre ÉLARGIE d'un mois de part et d'autre", async () => {
    // Un congé de trois semaines à cheval sur deux mois doit être vu depuis le
    // mois affiché : filtrer sur la date de début le raterait.
    await getHubSignaux(2026, 6, "adm", MAINTENANT);
    const [debut, fin] = mockListIndispos.mock.calls[0] as [Date, Date];
    expect(debut.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("convertit les fenêtres en jours et signale le chevauchement", async () => {
    mockGetPlanningMonth.mockResolvedValue(
      new Map([
        [
          "2026-06-20",
          [ev({ debut: new Date("2026-06-20T08:00:00Z"), fin: new Date("2026-06-20T17:00:00Z") })],
        ],
      ]),
    );
    mockListTrainers.mockResolvedValue([{ id: "t1", prenom: "Ana", nom: "Roux" }]);
    mockGetTrainerConformite.mockResolvedValue({ conforme: true, manquements: [] });
    mockListIndispos.mockResolvedValue([
      {
        id: "a1",
        trainerId: "t1",
        type: "conge",
        debut: "2026-06-18",
        fin: "2026-06-22",
        motif: null,
      },
    ]);

    const signaux = await getHubSignaux(2026, 6, "adm", MAINTENANT);
    expect(signaux.map((s) => s.code)).toContain("formateur_indisponible");
  });
});
