/**
 * Tests — trainer-remuneration.ts (actions du commissionnement).
 *
 * Ici vivent les gardes que le moteur pur ne peut pas poser : on ne paie que sur
 * une facture REÇUE et CONFORME, valider fige les lignes, redescendre les
 * dégèle (sinon le run suivant double le mois), et un barème ne se modifie pas —
 * il se clôt et se recrée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminWrite = vi.fn();
const mockLog = vi.fn();
const mockRun = vi.fn();

const tx = {
  trainerStatement: { update: vi.fn() },
  trainerFeeLine: { updateMany: vi.fn() },
  trainerCompensationRule: { updateMany: vi.fn(), create: vi.fn() },
};

const mockStatementFindUnique = vi.fn();
const mockRuleFindUnique = vi.fn();
const mockRuleUpdate = vi.fn();
const mockTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: { findUnique: (...a: unknown[]) => mockStatementFindUnique(...a) },
    trainerCompensationRule: {
      findUnique: (...a: unknown[]) => mockRuleFindUnique(...a),
      update: (...a: unknown[]) => mockRuleUpdate(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...(a as [never])),
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => mockRequireAdminWrite(),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

vi.mock("@/server/qualiopi/remuneration/statements", () => ({
  runRemunerationMensuelle: (...a: unknown[]) => mockRun(...a),
}));

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const mockRevalidatePath = vi.fn();

vi.mock("next/navigation", () => ({ redirect: (u: string) => mockRedirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => mockRevalidatePath(p) }));

import {
  closeCompensationRuleAction,
  createCompensationRuleAction,
  runRemunerationFormAction,
  runRemunerationMensuelleAction,
  transitionStatementAction,
} from "./trainer-remuneration";

const ID = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";

function releve(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    statut: "facture_recue",
    totalTtcCents: 108_000,
    numeroFacture: "F-001",
    dateFacture: new Date("2026-07-01T00:00:00Z"),
    montantFactureTtcCents: 108_000,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  mockLog.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  tx.trainerStatement.update.mockResolvedValue({});
  tx.trainerFeeLine.updateMany.mockResolvedValue({ count: 0 });
  tx.trainerCompensationRule.updateMany.mockResolvedValue({ count: 0 });
  tx.trainerCompensationRule.create.mockResolvedValue({ id: "r-new" });
  mockRuleUpdate.mockResolvedValue({});
});

/* ────────────────────────────────────────────────────────────────────────────── */

describe("runRemunerationMensuelleAction", () => {
  it("refuse une période hors bornes", async () => {
    const res = await runRemunerationMensuelleAction({ year: 2026, month: 13 });
    expect(res).toEqual({ error: "Période invalide" });
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("ne journalise PAS un dryRun (rien n'a été écrit)", async () => {
    mockRun.mockResolvedValue({
      periode: { year: 2026, month: 6 },
      prestationsLues: 3,
      lignesEcrites: 2,
      relevesEcrits: 1,
      formateursIgnores: [],
      anomalies: [],
      dryRun: true,
    });
    const res = await runRemunerationMensuelleAction({ year: 2026, month: 6, dryRun: true });
    expect("data" in res && res.data.dryRun).toBe(true);
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("journalise un run réel", async () => {
    mockRun.mockResolvedValue({
      periode: { year: 2026, month: 6 },
      prestationsLues: 3,
      lignesEcrites: 2,
      relevesEcrits: 1,
      formateursIgnores: [],
      anomalies: [],
      dryRun: false,
    });
    await runRemunerationMensuelleAction({ year: 2026, month: 6 });
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "qualiopi.remuneration.run" }),
    );
  });
});

describe("transitionStatementAction — matrice", () => {
  it("refuse une transition interdite (valide → paye : on saute la facture)", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "valide" }));
    const res = await transitionStatementAction({ id: ID, to: "paye" });
    expect(res).toEqual({ error: "Transition « valide » → « paye » interdite." });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("refuse de sortir d'un état terminal", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "paye" }));
    const res = await transitionStatementAction({ id: ID, to: "annule" });
    expect("error" in res).toBe(true);
  });

  it("relevé introuvable", async () => {
    mockStatementFindUnique.mockResolvedValue(null);
    const res = await transitionStatementAction({ id: ID, to: "a_valider" });
    expect(res).toEqual({ error: "Relevé introuvable." });
  });
});

describe("transitionStatementAction — gate « facture conforme »", () => {
  it("REFUSE le paiement si le TTC facturé diffère du TTC dû", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ totalTtcCents: 108_000, montantFactureTtcCents: 120_000 }),
    );
    const res = await transitionStatementAction({ id: ID, to: "paye", moyenPaiement: "virement" });
    expect("error" in res && res.error).toContain("Facture non conforme");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("refuse le paiement sans montant de facture", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ montantFactureTtcCents: null }));
    const res = await transitionStatementAction({ id: ID, to: "paye", moyenPaiement: "virement" });
    expect("error" in res && res.error).toContain("impossible de payer");
  });

  it("refuse le paiement sans moyen de paiement", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    const res = await transitionStatementAction({ id: ID, to: "paye" });
    expect("error" in res && res.error).toContain("moyen de paiement");
  });

  it("accepte le paiement quand la facture est conforme, et horodate", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    const res = await transitionStatementAction({
      id: ID,
      to: "paye",
      moyenPaiement: "virement",
      referenceVirement: "VIR-42",
    });
    expect(res).toEqual({ data: { id: ID, statut: "paye" } });
    const data = tx.trainerStatement.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.statut).toBe("paye");
    expect(data.payeAt).toBeInstanceOf(Date);
    expect(data.moyenPaiement).toBe("virement");
  });

  it("exige numéro, date et montant pour passer en `facture_recue`", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "valide" }));
    const sansNumero = await transitionStatementAction({ id: ID, to: "facture_recue" });
    expect("error" in sansNumero && sansNumero.error).toContain("numéro");

    const sansDate = await transitionStatementAction({
      id: ID,
      to: "facture_recue",
      numeroFacture: "F-9",
    });
    expect("error" in sansDate && sansDate.error).toContain("date");

    const sansMontant = await transitionStatementAction({
      id: ID,
      to: "facture_recue",
      numeroFacture: "F-9",
      dateFacture: "2026-07-01",
    });
    expect("error" in sansMontant && sansMontant.error).toContain("montant");
  });
});

describe("transitionStatementAction — gel et dégel des lignes", () => {
  it("valider FIGE les lignes calculées et enregistre le validateur", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "a_valider" }));
    await transitionStatementAction({ id: ID, to: "valide" });

    expect(tx.trainerFeeLine.updateMany).toHaveBeenCalledWith({
      where: { statementId: ID, statut: "calcule" },
      data: { statut: "valide" },
    });
    const data = tx.trainerStatement.update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.validatedById).toBe("u1");
  });

  it("RÉGRESSION : redescendre en `a_valider` DÉGÈLE les lignes", async () => {
    // Sans dégel, le relevé redevient recalculable avec des lignes `valide` que
    // le run n'efface pas → il en recrée à côté → le mois est payé deux fois.
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "valide" }));
    await transitionStatementAction({ id: ID, to: "a_valider" });

    expect(tx.trainerFeeLine.updateMany).toHaveBeenCalledWith({
      where: { statementId: ID, statut: "valide" },
      data: { statut: "calcule" },
    });
  });

  it("passer en `facture_recue` ne touche pas aux lignes", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "valide" }));
    await transitionStatementAction({
      id: ID,
      to: "facture_recue",
      numeroFacture: "F-1",
      dateFacture: "2026-07-01",
      montantFactureTtcCents: 108_000,
    });
    expect(tx.trainerFeeLine.updateMany).not.toHaveBeenCalled();
  });

  it("le statut n'est jamais écrit sans passer par la matrice", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "brouillon" }));
    await transitionStatementAction({ id: ID, to: "valide" }); // brouillon → valide interdit
    expect(tx.trainerStatement.update).not.toHaveBeenCalled();
  });
});

describe("createCompensationRuleAction — versionnement", () => {
  const base = {
    trainerId: TRAINER,
    model: "taux_journalier" as const,
    tauxJourneeHtCents: 90_000,
    effectiveFrom: "2026-09-01",
  };

  it("exige le taux correspondant au modèle", async () => {
    const res = await createCompensationRuleAction({
      trainerId: TRAINER,
      model: "commission_ca_pct",
      effectiveFrom: "2026-09-01",
    });
    expect("error" in res && res.error).toContain("commission_ca_pct");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("CLÔT la version précédente à la date d'entrée en vigueur de la nouvelle", async () => {
    tx.trainerCompensationRule.updateMany.mockResolvedValue({ count: 1 });
    const res = await createCompensationRuleAction(base);

    expect("data" in res && res.data.cloturees).toBe(1);
    const where = tx.trainerCompensationRule.updateMany.mock.calls[0]?.[0]?.where as Record<
      string,
      unknown
    >;
    const data = tx.trainerCompensationRule.updateMany.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    // Sans trou ni chevauchement : `effectiveTo` (exclu) = `effectiveFrom` (inclus).
    expect(data.effectiveTo).toEqual(new Date("2026-09-01"));
    expect(where.trainerId).toBe(TRAINER);
    expect(where.prestationType).toBeNull();
    expect(where.interventionSlug).toBeNull();
  });

  it("ne clôt QUE la même cible (un autre type de prestation coexiste)", async () => {
    await createCompensationRuleAction({ ...base, prestationType: "coaching_1to1" });
    const where = tx.trainerCompensationRule.updateMany.mock.calls[0]?.[0]?.where as Record<
      string,
      unknown
    >;
    expect(where.prestationType).toBe("coaching_1to1");
  });

  it("la nouvelle règle naît ouverte et porte son auteur", async () => {
    await createCompensationRuleAction(base);
    const data = tx.trainerCompensationRule.create.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(data.effectiveTo).toBeNull();
    expect(data.createdById).toBe("u1");
    expect(data.tauxJourneeHtCents).toBe(90_000);
    // Les taux des autres modèles restent vides : pas de valeur fantôme.
    expect(data.commissionPct).toBeNull();
    expect(data.forfaitHtCents).toBeNull();
  });
});

describe("closeCompensationRuleAction", () => {
  it("refuse de clôturer avant l'entrée en vigueur", async () => {
    mockRuleFindUnique.mockResolvedValue({
      effectiveFrom: new Date("2026-09-01"),
      effectiveTo: null,
    });
    const res = await closeCompensationRuleAction({ id: ID, effectiveTo: "2026-08-01" });
    expect("error" in res && res.error).toContain("doit suivre");
    expect(mockRuleUpdate).not.toHaveBeenCalled();
  });

  it("refuse de re-clôturer une règle déjà close", async () => {
    mockRuleFindUnique.mockResolvedValue({
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: new Date("2026-06-01"),
    });
    const res = await closeCompensationRuleAction({ id: ID, effectiveTo: "2026-09-01" });
    expect("error" in res && res.error).toContain("déjà clôturé");
  });

  it("clôt une règle ouverte", async () => {
    mockRuleFindUnique.mockResolvedValue({
      effectiveFrom: new Date("2026-01-01"),
      effectiveTo: null,
    });
    const res = await closeCompensationRuleAction({ id: ID, effectiveTo: "2026-09-01" });
    expect(res).toEqual({ data: { id: ID } });
    expect(mockRuleUpdate).toHaveBeenCalled();
  });
});

describe("runRemunerationFormAction — redirection ouverte", () => {
  beforeEach(() => {
    mockRun.mockResolvedValue({
      periode: { year: 2026, month: 6 },
      prestationsLues: 0,
      lignesEcrites: 0,
      relevesEcrits: 0,
      formateursIgnores: [],
      anomalies: [],
      dryRun: true,
    });
  });

  /** Récupère l'URL passée à `redirect()` (qui lève par conception). */
  async function urlDeRedirection(retour: string): Promise<string> {
    const fd = new FormData();
    fd.set("year", "2026");
    fd.set("month", "6");
    fd.set("dryRun", "1");
    fd.set("retour", retour);
    try {
      await runRemunerationFormAction(fd);
    } catch {
      /* redirect() lève : c'est attendu */
    }
    return (mockRedirect.mock.calls.at(-1)?.[0] ?? "") as string;
  }

  it("accepte un chemin interne", async () => {
    const url = await urlDeRedirection("/fr/adm/qualiopi/remuneration");
    expect(url.startsWith("/fr/adm/qualiopi/remuneration?")).toBe(true);
  });

  it.each([
    ["https://evil.tld", "URL absolue"],
    ["//evil.tld", "protocol-relative"],
    ["/\\evil.tld", "antislash traité comme slash par les navigateurs"],
    ["javascript:alert(1)", "pseudo-protocole"],
  ])("REFUSE « %s » (%s) et retombe sur la racine", async (retour) => {
    const url = await urlDeRedirection(retour);
    expect(url.startsWith("/?")).toBe(true);
  });
});
