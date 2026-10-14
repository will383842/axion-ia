// @vitest-environment node

/**
 * Lot D (M9) — F37 « Virement effectué » et F38 « Virement en attente : attestation URSSAF ».
 *   · F37 : un e-mail par formateur et par lot de « Virements faits », numéros triés,
 *     montant = somme des TTC payés (centimes entiers) ; clé d'idempotence stable ;
 *   · seuls les relevés de MISSION payés sont annoncés (le mensuel est inchangé) ;
 *   · F38 : une fois par facture.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const findUnique = vi.fn();
const envoyer = vi.fn();
const traces = vi.fn();
const tracer = vi.fn();
const f37Anciens = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findMany: (...a: unknown[]) => findMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
    },
    activityLog: {
      findMany: (...a: unknown[]) => traces(...a),
      create: (...a: unknown[]) => tracer(...a),
    },
    emailLog: { count: (...a: unknown[]) => f37Anciens(...a) },
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({
  envoyer: (...a: unknown[]) => envoyer(...a),
}));

import {
  ACTION_F37_TRAITE,
  envoyerVirementEnAttente,
  envoyerVirementsFaits,
  montantEnTexte,
  reprendreVirementsFaitsSansF37,
} from "../virement-fait-envoi";

const T1 = "22222222-2222-4222-8222-222222222222";
const T2 = "33333333-3333-4333-8333-333333333333";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PAYE = new Date("2032-01-05T10:00:00Z");

function r(id: string, trainerId: string, numero: string, ttc: number) {
  return {
    id,
    trainerId,
    numeroFacture: numero,
    totalTtcCents: ttc,
    payeAt: PAYE,
    trainer: { email: `${trainerId.slice(0, 2)}@exemple.fr`, prenom: "Camille" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  envoyer.mockResolvedValue("envoye");
  traces.mockResolvedValue([]);
  tracer.mockResolvedValue({});
  f37Anciens.mockResolvedValue(0);
});

describe("montant en texte (centimes entiers, jamais de flottant)", () => {
  it.each([
    [0, "0,00"],
    [5, "0,05"],
    [35_000, "350,00"],
    [123_456_78, "123 456,78"],
    [1_210, "12,10"],
  ])("%i centimes → %s", (c, t) => {
    expect(montantEnTexte(c).replace(/\s/g, " ")).toBe(t);
  });
});

describe("F37 — virements faits", () => {
  it("un e-mail par formateur, numéros triés, montant = somme TTC", async () => {
    findMany.mockResolvedValue([
      r(B, T1, "AXI-AUTOF-0012", 42_000),
      r(A, T1, "AXI-AUTOF-0009", 35_000),
      r(C, T2, "AXI-AUTOF-0010", 21_010),
    ]);
    await envoyerVirementsFaits([B, A, C]);
    expect(findMany.mock.calls[0]![0]).toMatchObject({
      where: { id: { in: [B, A, C] }, statut: "paye", origine: "passage_mission", avoirDeId: null },
    });
    expect(envoyer).toHaveBeenCalledTimes(2);
    const p1 = envoyer.mock.calls.find((c) => c[0].entityId === T1)![0];
    expect(p1.gabarit).toBe("formateur-virement-fait");
    expect(p1.entityType).toBe("Trainer");
    expect(p1.payload.valeurs.numéro).toBe("AXI-AUTOF-0009, AXI-AUTOF-0012");
    // 350,00 + 420,00 = 770,00 € TTC
    expect(p1.payload.valeurs.montant.replace(/\s/g, " ")).toBe("770,00");
    expect(p1.payload.valeurs.date).toBe("5 janvier 2032");
    expect(p1.payload.prenom).toBe("Camille");
  });

  it("idempotent : même lot, même clé, quel que soit l'ordre des cases cochées", async () => {
    findMany.mockResolvedValue([r(A, T1, "N1", 100), r(B, T1, "N2", 200)]);
    await envoyerVirementsFaits([A, B]);
    await envoyerVirementsFaits([B, A]);
    const [k1, k2] = envoyer.mock.calls.map((c) => c[0].jobId as string);
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^formateur-virement-fait-[0-9a-f]{24}$/);
  });

  it("aucun relevé de mission payé : rien ne part", async () => {
    findMany.mockResolvedValue([]);
    await envoyerVirementsFaits([A]);
    expect(envoyer).not.toHaveBeenCalled();
    await envoyerVirementsFaits([]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("un échec d'envoi ne remonte jamais (le virement est acquis)", async () => {
    findMany.mockRejectedValue(new Error("base"));
    await expect(envoyerVirementsFaits([A])).resolves.toBeUndefined();
  });
});

describe("🔴 8B — reprise de F37 après un lot interrompu (relecture de #1514)", () => {
  const MAINTENANT = new Date("2032-01-05T14:00:00Z");

  it("F37 traité : une trace PAR relevé du lot (identifiants seuls)", async () => {
    findMany.mockResolvedValue([r(A, T1, "N1", 100), r(B, T1, "N2", 200)]);
    await envoyerVirementsFaits([A, B]);
    const ecrites = tracer.mock.calls.map((c) => c[0].data);
    expect(ecrites.map((d) => d.targetId).sort()).toEqual([A, B].sort());
    for (const d of ecrites) {
      expect(d.action).toBe(ACTION_F37_TRAITE);
      expect(d.targetType).toBe("TrainerStatement");
      expect(JSON.stringify(d)).not.toContain("Camille");
    }
  });

  it("F37 indisponible (file en panne) : aucune trace, le passage suivant le reprendra", async () => {
    findMany.mockResolvedValue([r(A, T1, "N1", 100)]);
    envoyer.mockResolvedValue("indisponible");
    await envoyerVirementsFaits([A]);
    expect(tracer).not.toHaveBeenCalled();
  });

  it("lot interrompu : les relevés payés sans F37 partent au passage suivant, une fois", async () => {
    // 1er appel : la lecture de la reprise ; 2e : celle de `envoyerVirementsFaits`.
    findMany
      .mockResolvedValueOnce([
        { id: A, trainerId: T1, payeAt: PAYE },
        { id: B, trainerId: T1, payeAt: PAYE },
      ])
      .mockResolvedValueOnce([r(A, T1, "N1", 100), r(B, T1, "N2", 200)]);
    expect(await reprendreVirementsFaitsSansF37(MAINTENANT)).toBe(2);
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(envoyer.mock.calls[0]![0].payload.valeurs.numéro).toBe("N1, N2");
    // Fenêtre : payés depuis 30 min au moins (un lot en cours n'est pas repris) et
    // depuis 7 jours au plus. Seuls les relevés de mission.
    const w = findMany.mock.calls[0]![0].where;
    expect(w).toMatchObject({ statut: "paye", origine: "passage_mission", avoirDeId: null });
    expect(w.payeAt.lte).toEqual(new Date("2032-01-05T13:30:00Z"));
    expect(w.payeAt.gte).toEqual(new Date("2031-12-29T14:00:00Z"));
    expect(tracer).toHaveBeenCalledTimes(2);
  });

  it("déjà tracé : rien ne repart (une seule fois)", async () => {
    findMany.mockResolvedValueOnce([{ id: A, trainerId: T1, payeAt: PAYE }]);
    traces.mockResolvedValue([{ targetId: A }]);
    expect(await reprendreVirementsFaitsSansF37(MAINTENANT)).toBe(0);
    expect(envoyer).not.toHaveBeenCalled();
    expect(traces.mock.calls[0]![0].where).toEqual({
      action: ACTION_F37_TRAITE,
      targetId: { in: [A] },
    });
  });

  it("payé avant la trace (ancien code) avec son F37 au journal des envois : rien ne repart", async () => {
    findMany.mockResolvedValueOnce([{ id: A, trainerId: T1, payeAt: PAYE }]);
    f37Anciens.mockResolvedValue(1);
    expect(await reprendreVirementsFaitsSansF37(MAINTENANT)).toBe(0);
    expect(envoyer).not.toHaveBeenCalled();
    expect(f37Anciens.mock.calls[0]![0].where).toMatchObject({
      template: "formateur-virement-fait",
      entityType: "Trainer",
      entityId: T1,
      status: { not: "failed" },
      createdAt: { gte: PAYE, lte: new Date("2032-01-05T11:00:00Z") },
    });
  });

  it("ne lève jamais", async () => {
    findMany.mockRejectedValue(new Error("base"));
    await expect(reprendreVirementsFaitsSansF37(MAINTENANT)).resolves.toBe(0);
  });
});

describe("F38 — virement en attente de l'attestation URSSAF", () => {
  it("une fois par facture, relevé de mission non payé seulement", async () => {
    findUnique.mockResolvedValue({
      ...r(A, T1, "AXI-AUTOF-0009", 35_000),
      statut: "facture_recue",
      origine: "passage_mission",
      payeAt: null,
    });
    expect(await envoyerVirementEnAttente(A)).toBe("envoye");
    const e = envoyer.mock.calls[0]![0];
    expect(e.gabarit).toBe("formateur-virement-en-attente");
    expect(e.jobId).toBe(`formateur-virement-en-attente-${A}`);
    expect(e.payload.valeurs.numéro).toBe("AXI-AUTOF-0009");
  });

  it("relevé mensuel, payé ou sans numéro : rien", async () => {
    for (const over of [
      { origine: "releve_mensuel" },
      { statut: "paye" },
      { numeroFacture: null },
    ]) {
      findUnique.mockResolvedValueOnce({
        ...r(A, T1, "N", 1),
        statut: "facture_recue",
        origine: "passage_mission",
        payeAt: null,
        ...over,
      });
      expect(await envoyerVirementEnAttente(A)).toBe("ignore");
    }
    expect(envoyer).not.toHaveBeenCalled();
  });
});
