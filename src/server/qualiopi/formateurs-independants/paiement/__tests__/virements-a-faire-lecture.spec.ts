// @vitest-environment node

/**
 * Lot D (M9) — l'état de chaque virement de MISSION dans la vue « Virements à
 * faire » : IBAN affiché (fin + empreinte), rubriques suspendues lues par la
 * MÊME garde que le clic, supplément de retard calculé (affiché, jamais écrit).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const count = vi.fn();
const contexte = vi.fn();
const ibanAffiche = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}));
vi.mock("../virement-mission-base", () => ({
  contexteVirementMission: (...a: unknown[]) => contexte(...a),
  ibanAffichePourVirement: (...a: unknown[]) => ibanAffiche(...a),
}));

import {
  aUnVirementMissionDu,
  etatsVirementsMission,
  relevesDeMissionParmi,
} from "../virements-a-faire-lecture";
import { ISSUE_DESACCORD_NON_RETENU } from "../desaccord-regle";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T = "22222222-2222-4222-8222-222222222222";
const E = "e".repeat(64);
const MAINTENANT = new Date("2032-01-10T10:00:00Z");
const RETARD = { joursDeRetard: 0, penalitesCents: 0, indemniteRecouvrementCents: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([
    { id: A, trainerId: T, echeanceAt: new Date("2032-01-30T12:00:00Z"), totalTtcCents: 42_000 },
  ]);
  ibanAffiche.mockResolvedValue({ fin4: "0189", empreinte: E });
  contexte.mockResolvedValue({ verdict: { autorise: true, motifs: [], retard: RETARD } });
});

describe("etatsVirementsMission", () => {
  it("lit les seuls relevés de mission demandés, avec l'empreinte affichée", async () => {
    const m = await etatsVirementsMission([A], MAINTENANT);
    expect(findMany.mock.calls[0]![0]).toMatchObject({
      where: { id: { in: [A] }, origine: "passage_mission" },
    });
    expect(contexte.mock.calls[0]![2]).toBe(E);
    expect(m.get(A)).toEqual({ fin4: "0189", empreinte: E, motifs: [], retard: RETARD });
  });

  it("attestation échue à la mission : la rubrique suspendue est rendue", async () => {
    contexte.mockResolvedValue({
      verdict: {
        autorise: false,
        motifs: ["attestation_urssaf_echue_a_la_mission"],
        retard: RETARD,
      },
    });
    expect((await etatsVirementsMission([A], MAINTENANT)).get(A)!.motifs).toEqual([
      "attestation_urssaf_echue_a_la_mission",
    ]);
  });

  it("IBAN illisible : pas d'empreinte, la garde dit « IBAN absent »", async () => {
    ibanAffiche.mockResolvedValue(null);
    contexte.mockResolvedValue({
      verdict: { autorise: false, motifs: ["iban_absent"], retard: RETARD },
    });
    const e = (await etatsVirementsMission([A], MAINTENANT)).get(A)!;
    expect(e.empreinte).toBeNull();
    expect(contexte.mock.calls[0]![2]).toBeNull();
    expect(e.motifs).toEqual(["iban_absent"]);
  });

  it("liste vide : aucune lecture ; lecture en échec : ligne présentée comme suspendue", async () => {
    expect((await etatsVirementsMission([], MAINTENANT)).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    contexte.mockRejectedValue(new Error("clé"));
    expect((await etatsVirementsMission([A], MAINTENANT)).get(A)!.motifs).toEqual(["iban_absent"]);
  });
});

describe("relevesDeMissionParmi (défaut 1)", () => {
  it("ne garde que les relevés d'origine passage_mission", async () => {
    findMany.mockResolvedValue([{ id: A }]);
    const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect(await relevesDeMissionParmi([A, B])).toEqual(new Set([A]));
    expect(findMany.mock.calls[0]![0].where).toEqual({
      id: { in: [A, B] },
      origine: "passage_mission",
    });
  });

  it("aucun identifiant : aucune lecture", async () => {
    expect(await relevesDeMissionParmi([])).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("aUnVirementMissionDu (défaut 2)", () => {
  it("cherche un relevé de mission facture reçue, non payé, de CE formateur", async () => {
    count.mockResolvedValue(1);
    expect(await aUnVirementMissionDu(T)).toBe(true);
    expect(count.mock.calls[0]![0].where).toEqual({
      trainerId: T,
      origine: "passage_mission",
      statut: "facture_recue",
      payeAt: null,
      OR: [{ contesteeAt: null }, { contestationCloseIssue: ISSUE_DESACCORD_NON_RETENU }],
    });
  });

  it("seul relevé dû contesté, non tranché : il ne compte pas (l'IBAN ne se révèle pas)", async () => {
    // Le `count` reçoit la même règle que la transition du « payé » : un relevé
    // contesté n'est un virement dû que si le désaccord est clos « non retenu ».
    count.mockResolvedValue(0);
    expect(await aUnVirementMissionDu(T)).toBe(false);
    const where = count.mock.calls[0]![0].where;
    expect(where.OR).toContainEqual({ contesteeAt: null });
    expect(where.OR).toContainEqual({ contestationCloseIssue: ISSUE_DESACCORD_NON_RETENU });
    expect(where.OR).toHaveLength(2);
  });

  it("aucun relevé dû : faux", async () => {
    count.mockResolvedValue(0);
    expect(await aUnVirementMissionDu(T)).toBe(false);
  });
});
