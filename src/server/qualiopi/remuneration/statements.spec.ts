/**
 * Tests — statements.ts (persisteur du run mensuel).
 *
 * Ce module est le seul de la zone à écrire en base. On y teste ce que les
 * moteurs purs ne peuvent pas garantir : le rattachement des prestations au bon
 * mois PARISIEN, la conversion des `Decimal` Prisma, l'idempotence (les lignes
 * fantômes d'un run précédent disparaissent), le respect du passé validé, et la
 * prise du verrou qui sérialise deux runs concurrents.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrainingFindMany = vi.fn();
const mockCoachingFindMany = vi.fn();
const mockAuditFindMany = vi.fn();
const mockTrainerFindMany = vi.fn();
const mockRuleFindMany = vi.fn();

const tx = {
  $executeRawUnsafe: vi.fn(),
  trainerFeeLine: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  trainerStatement: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
};

const mockTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: (...a: unknown[]) => mockTrainingFindMany(...a) },
    coachingSession: { findMany: (...a: unknown[]) => mockCoachingFindMany(...a) },
    auditMission: { findMany: (...a: unknown[]) => mockAuditFindMany(...a) },
    trainer: { findMany: (...a: unknown[]) => mockTrainerFindMany(...a) },
    trainerCompensationRule: { findMany: (...a: unknown[]) => mockRuleFindMany(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...(a as [never])),
  },
}));

import { fenetreUtcElargie, runRemunerationMensuelle } from "./statements";

const JUIN = { year: 2026, month: 6 } as const;

/** Imite un `Prisma.Decimal` : seul `toNumber()` est consommé par le module. */
function decimal(n: number): { toNumber: () => number } {
  return { toNumber: () => n };
}

function sessionRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "s1",
    dateDebut: new Date("2026-06-15T08:00:00Z"),
    statut: "realisee",
    montantHtCents: 0,
    formation: { slug: "formation-ia", dureeHeures: 7 },
    sessionFormateurs: [{ trainerId: "t1", heuresAnimees: null }],
    ...over,
  };
}

function trainerRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "t1",
    statut: "sous_traitant",
    tarifJourneeHtCents: null,
    regimeTvaHonoraires: "assujetti_20",
    ...over,
  };
}

function ruleRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "r1",
    trainerId: "t1",
    prestationType: null,
    interventionSlug: null,
    model: "taux_journalier",
    tauxJourneeHtCents: 90_000,
    tauxHoraireHtCents: null,
    commissionPct: null,
    forfaitHtCents: null,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTrainingFindMany.mockResolvedValue([]);
  mockCoachingFindMany.mockResolvedValue([]);
  mockAuditFindMany.mockResolvedValue([]);
  mockTrainerFindMany.mockResolvedValue([]);
  mockRuleFindMany.mockResolvedValue([]);
  tx.trainerFeeLine.findMany.mockResolvedValue([]);
  tx.trainerFeeLine.deleteMany.mockResolvedValue({ count: 0 });
  tx.trainerFeeLine.createMany.mockResolvedValue({ count: 0 });
  tx.trainerStatement.findUnique.mockResolvedValue(null);
  tx.trainerStatement.upsert.mockResolvedValue({ id: "st1" });
  tx.trainerStatement.delete.mockResolvedValue({});
  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
});

/* ────────────────────────────────────────────────────────────────────────────── */

describe("fenetreUtcElargie", () => {
  it("déborde d'un jour de chaque côté du mois", () => {
    const { debut, fin } = fenetreUtcElargie(JUIN);
    expect(debut.toISOString()).toBe("2026-05-31T00:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-07-02T00:00:00.000Z");
  });

  it("le filet couvre le 1er du mois à 00h00 heure de Paris (= 31 à 22h UTC)", () => {
    const { debut } = fenetreUtcElargie({ year: 2026, month: 8 });
    expect(debut.getTime()).toBeLessThan(new Date("2026-07-31T22:00:00Z").getTime());
  });

  it("gère le passage d'année", () => {
    const { debut, fin } = fenetreUtcElargie({ year: 2026, month: 12 });
    expect(debut.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(fin.toISOString()).toBe("2027-01-02T00:00:00.000Z");
  });
});

describe("runRemunerationMensuelle — rattachement au mois parisien", () => {
  it("écarte une session du filet qui appartient au mois SUIVANT à Paris", async () => {
    // 2026-06-30T22:30:00Z = 1er juillet 00h30 à Paris → pas de juin.
    mockTrainingFindMany.mockResolvedValue([
      sessionRow({ dateDebut: new Date("2026-06-30T22:30:00Z") }),
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    const res = await runRemunerationMensuelle(JUIN, { dryRun: true });
    expect(res.prestationsLues).toBe(0);
    expect(res.lignesEcrites).toBe(0);
  });

  it("garde une session du 30 juin à 20h UTC (22h à Paris)", async () => {
    mockTrainingFindMany.mockResolvedValue([
      sessionRow({ dateDebut: new Date("2026-06-30T20:00:00Z") }),
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    const res = await runRemunerationMensuelle(JUIN, { dryRun: true });
    expect(res.prestationsLues).toBe(1);
    expect(res.lignesEcrites).toBe(1);
  });
});

describe("runRemunerationMensuelle — conversion des Decimal", () => {
  it("convertit `heuresAnimees` (Decimal) en number pour le moteur", async () => {
    mockTrainingFindMany.mockResolvedValue([
      sessionRow({ sessionFormateurs: [{ trainerId: "t1", heuresAnimees: decimal(14) }] }),
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    await runRemunerationMensuelle(JUIN);

    const lignes = tx.trainerFeeLine.createMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >[];
    expect(lignes[0]?.heures).toBe(14);
    expect(lignes[0]?.nbJours).toBe(2);
    expect(lignes[0]?.montantHtCents).toBe(180_000); // 2 j × 900 €
  });

  it("convertit `commissionPct` (Decimal) et l'applique au CA", async () => {
    mockTrainingFindMany.mockResolvedValue([sessionRow({ montantHtCents: 1_000_000 })]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([
      ruleRow({ model: "commission_ca_pct", tauxJourneeHtCents: null, commissionPct: decimal(30) }),
    ]);

    await runRemunerationMensuelle(JUIN);

    const lignes = tx.trainerFeeLine.createMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >[];
    expect(lignes[0]?.commissionPctSnapshot).toBe(30);
    expect(lignes[0]?.montantHtCents).toBe(300_000);
  });

  it("`heuresAnimees` null retombe sur la durée de la formation (pas sur 0)", async () => {
    mockTrainingFindMany.mockResolvedValue([
      sessionRow({
        formation: { slug: "f", dureeHeures: 21 },
        sessionFormateurs: [{ trainerId: "t1", heuresAnimees: null }],
      }),
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    await runRemunerationMensuelle(JUIN);
    const lignes = tx.trainerFeeLine.createMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >[];
    expect(lignes[0]?.heures).toBe(21);
    expect(lignes[0]?.montantHtCents).toBe(270_000); // 3 j × 900 €
  });
});

describe("runRemunerationMensuelle — coaching", () => {
  it("déduit les heures du créneau et signale le CA absent sur une commission", async () => {
    mockCoachingFindMany.mockResolvedValue([
      {
        id: "c1",
        trainerId: "t1",
        dateSeance: new Date("2026-06-10T08:00:00Z"),
        dateSeanceFin: new Date("2026-06-10T11:00:00Z"), // 3 h
        statut: "realisee",
        interventionSlug: "coaching-dirigeant",
      },
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([
      ruleRow({ model: "commission_ca_pct", tauxJourneeHtCents: null, commissionPct: decimal(40) }),
    ]);

    const res = await runRemunerationMensuelle(JUIN, { dryRun: true });
    // Le CA d'un coaching vit sur le contrat → assiette nulle, montant 0, ANOMALIE.
    expect(res.anomalies.map((a) => a.motif)).toContain("assiette_ca_absente");
  });

  it("une séance sans `dateSeanceFin` (legacy) donne 0 h et le signale", async () => {
    mockCoachingFindMany.mockResolvedValue([
      {
        id: "c1",
        trainerId: "t1",
        dateSeance: new Date("2026-06-10T08:00:00Z"),
        dateSeanceFin: null,
        statut: "realisee",
        interventionSlug: "coaching",
      },
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]); // taux_journalier

    const res = await runRemunerationMensuelle(JUIN, { dryRun: true });
    expect(res.anomalies.map((a) => a.motif)).toContain("heures_absentes");
  });
});

describe("runRemunerationMensuelle — invariant 1 : le passé validé", () => {
  it.each(["valide", "facture_recue", "paye", "annule"] as const)(
    "saute intégralement un formateur dont le relevé est `%s`",
    async (statut) => {
      mockTrainingFindMany.mockResolvedValue([sessionRow()]);
      mockTrainerFindMany.mockResolvedValue([trainerRow()]);
      mockRuleFindMany.mockResolvedValue([ruleRow()]);
      tx.trainerStatement.findUnique.mockResolvedValue({ id: "st1", statut });

      const res = await runRemunerationMensuelle(JUIN);

      expect(res.formateursIgnores).toEqual([{ trainerId: "t1", statutReleve: statut }]);
      expect(tx.trainerFeeLine.deleteMany).not.toHaveBeenCalled();
      expect(tx.trainerFeeLine.createMany).not.toHaveBeenCalled();
      expect(tx.trainerStatement.upsert).not.toHaveBeenCalled();
      expect(res.lignesEcrites).toBe(0);
    },
  );

  it.each(["brouillon", "a_valider"] as const)("recalcule un relevé `%s`", async (statut) => {
    mockTrainingFindMany.mockResolvedValue([sessionRow()]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);
    tx.trainerStatement.findUnique.mockResolvedValue({ id: "st1", statut });

    const res = await runRemunerationMensuelle(JUIN);

    expect(res.formateursIgnores).toEqual([]);
    expect(tx.trainerFeeLine.deleteMany).toHaveBeenCalled();
    expect(tx.trainerFeeLine.createMany).toHaveBeenCalled();
  });
});

describe("runRemunerationMensuelle — idempotence et lignes fantômes", () => {
  it("efface les lignes d'un formateur qui n'a plus de prestation ce mois-ci", async () => {
    // Aucune prestation ce mois, mais `t9` a des lignes d'un run précédent.
    tx.trainerFeeLine.findMany.mockResolvedValue([{ trainerId: "t9" }]);
    tx.trainerStatement.findUnique.mockResolvedValue({ id: "st9", statut: "brouillon" });

    await runRemunerationMensuelle(JUIN);

    expect(tx.trainerFeeLine.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ trainerId: "t9", periodeYear: 2026, periodeMonth: 6 }),
      }),
    );
    // ...et son relevé fantôme aussi.
    expect(tx.trainerStatement.delete).toHaveBeenCalledWith({ where: { id: "st9" } });
    expect(tx.trainerFeeLine.createMany).not.toHaveBeenCalled();
  });

  it("ne touche pas aux lignes `valide` en effaçant", async () => {
    mockTrainingFindMany.mockResolvedValue([sessionRow()]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    await runRemunerationMensuelle(JUIN);

    expect(tx.trainerFeeLine.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ statut: { not: "valide" } }),
      }),
    );
  });
});

describe("runRemunerationMensuelle — relevé et rattachement des lignes", () => {
  it("rattache au relevé les lignes DUES, et elles seules", async () => {
    mockTrainingFindMany.mockResolvedValue([
      sessionRow({ id: "s1", statut: "realisee" }),
      sessionRow({
        id: "s2",
        statut: "planifiee",
        dateDebut: new Date("2026-06-20T08:00:00Z"),
      }),
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    await runRemunerationMensuelle(JUIN);

    const lignes = tx.trainerFeeLine.createMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >[];
    const calculee = lignes.find((l) => l.statut === "calcule");
    const previsionnelle = lignes.find((l) => l.statut === "previsionnel");
    expect(calculee?.statementId).toBe("st1");
    // Le prévisionnel n'est pas dû : il ne rejoint pas la facture.
    expect(previsionnelle?.statementId).toBeNull();
  });

  it("un salarié produit une ligne analytique et AUCUN relevé", async () => {
    mockTrainingFindMany.mockResolvedValue([sessionRow()]);
    mockTrainerFindMany.mockResolvedValue([
      trainerRow({ statut: "salarie", regimeTvaHonoraires: null }),
    ]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    const res = await runRemunerationMensuelle(JUIN);

    expect(tx.trainerStatement.upsert).not.toHaveBeenCalled();
    expect(res.relevesEcrits).toBe(0);
    const lignes = tx.trainerFeeLine.createMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >[];
    expect(lignes[0]?.nature).toBe("analytique");
    expect(lignes[0]?.statementId).toBeNull();
  });

  it("un indépendant sans régime de TVA : pas de relevé, une anomalie", async () => {
    mockTrainingFindMany.mockResolvedValue([sessionRow()]);
    mockTrainerFindMany.mockResolvedValue([trainerRow({ regimeTvaHonoraires: null })]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    const res = await runRemunerationMensuelle(JUIN);

    expect(tx.trainerStatement.upsert).not.toHaveBeenCalled();
    expect(res.anomalies.map((a) => a.motif)).toContain("regime_tva_absent");
    // La ligne existe quand même : le coût est connu, seule la facture est bloquée.
    expect(tx.trainerFeeLine.createMany).toHaveBeenCalled();
  });

  it("le statut d'un relevé existant n'est JAMAIS réécrit par le run", async () => {
    mockTrainingFindMany.mockResolvedValue([sessionRow()]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);
    tx.trainerStatement.findUnique.mockResolvedValue({ id: "st1", statut: "a_valider" });

    await runRemunerationMensuelle(JUIN);

    const arg = tx.trainerStatement.upsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    expect(arg.update).not.toHaveProperty("statut");
    expect(arg.create.statut).toBe("brouillon");
  });

  it("persiste le motif d'anomalie sur la ligne concernée", async () => {
    mockTrainingFindMany.mockResolvedValue([
      sessionRow({
        formation: { slug: "f", dureeHeures: 0 },
        sessionFormateurs: [{ trainerId: "t1", heuresAnimees: decimal(0) }],
      }),
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    await runRemunerationMensuelle(JUIN);

    const lignes = tx.trainerFeeLine.createMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >[];
    expect(lignes[0]?.motif).toBe("heures_absentes");
  });
});

describe("runRemunerationMensuelle — verrou et dryRun", () => {
  it("prend un advisory lock par période, dans la transaction", async () => {
    mockTrainingFindMany.mockResolvedValue([sessionRow()]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    await runRemunerationMensuelle(JUIN);

    const sql = tx.$executeRawUnsafe.mock.calls[0]?.[0] as string;
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("remuneration_run_2026_6");
  });

  it("dryRun n'ouvre aucune transaction et n'écrit rien", async () => {
    mockTrainingFindMany.mockResolvedValue([sessionRow()]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([ruleRow()]);

    const res = await runRemunerationMensuelle(JUIN, { dryRun: true });

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(tx.trainerFeeLine.createMany).not.toHaveBeenCalled();
    expect(res.dryRun).toBe(true);
    // ...mais il compte ce qu'il AURAIT écrit.
    expect(res.lignesEcrites).toBe(1);
    expect(res.relevesEcrits).toBe(1);
  });
});

describe("runRemunerationMensuelle — source AUDIT", () => {
  it("un audit réalisé avec formateur génère une ligne rattachée à l'audit", async () => {
    mockAuditFindMany.mockResolvedValue([
      {
        id: "a1",
        dateDebut: new Date("2026-06-12T09:00:00Z"),
        dateFin: new Date("2026-06-12T16:00:00Z"), // 7 h
        dureeHeures: null,
        statut: "realisee",
        montantHtCents: 500_000, // 5 000 € : assiette de la commission
        formateurId: "t1",
      },
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([
      ruleRow({ model: "commission_ca_pct", tauxJourneeHtCents: null, commissionPct: decimal(40) }),
    ]);

    await runRemunerationMensuelle(JUIN);

    const lignes = tx.trainerFeeLine.createMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >[];
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.prestationType).toBe("audit");
    expect(lignes[0]?.auditMissionId).toBe("a1");
    expect(lignes[0]?.sessionId).toBeNull();
    // 40 % de 5 000 € = 2 000 €.
    expect(lignes[0]?.montantHtCents).toBe(200_000);
  });

  it("un audit SANS formateur ne produit aucune ligne (silence, pas anomalie)", async () => {
    mockAuditFindMany.mockResolvedValue([
      {
        id: "a2",
        dateDebut: new Date("2026-06-12T09:00:00Z"),
        dateFin: new Date("2026-06-12T16:00:00Z"),
        dureeHeures: null,
        statut: "realisee",
        montantHtCents: 500_000,
        formateurId: null,
      },
    ]);
    const res = await runRemunerationMensuelle(JUIN, { dryRun: true });
    expect(res.lignesEcrites).toBe(0);
    expect(res.anomalies).toEqual([]);
  });

  it("un audit `en_cours` est traité comme planifié (rien de dû encore)", async () => {
    mockAuditFindMany.mockResolvedValue([
      {
        id: "a3",
        dateDebut: new Date("2026-06-12T09:00:00Z"),
        dateFin: new Date("2026-06-12T16:00:00Z"),
        dureeHeures: null,
        statut: "en_cours",
        montantHtCents: 500_000,
        formateurId: "t1",
      },
    ]);
    mockTrainerFindMany.mockResolvedValue([trainerRow()]);
    mockRuleFindMany.mockResolvedValue([
      ruleRow({ model: "commission_ca_pct", tauxJourneeHtCents: null, commissionPct: decimal(40) }),
    ]);
    await runRemunerationMensuelle(JUIN);
    const lignes = tx.trainerFeeLine.createMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >[];
    // Ligne prévisionnelle (pas encore dûe).
    expect(lignes[0]?.statut).toBe("previsionnel");
  });
});
