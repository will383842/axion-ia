/**
 * Tests — alertes/alertes-service.ts (T15 AGENT A).
 *
 * Stratégie : mock @/lib/prisma + ./evaluateur + ./catalogue.
 * Vérifie : stub-aware, creerOuDedup (dé-dup par code+cibleId), resoudreAlerte,
 * marquerLu, marquerToutLu, listAlertes, countNonLues, synchroniserAlertes
 * (création + résolution auto par (code,cibleId)).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alerteSysteme: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("./evaluateur", () => {
  const evaluerAlertes = vi.fn();
  return {
    evaluerAlertes,
    // La variante détaillée enveloppe le même mock : les tests existants
    // continuent de piloter les candidates via `evaluerAlertes`, zéro échec
    // par défaut. Le test « résolution suspendue » la surcharge directement.
    evaluerAlertesDetaille: vi.fn(async () => ({
      candidates: (await evaluerAlertes()) as unknown[],
      reglesEnEchec: [] as string[],
    })),
  };
});

vi.mock("./catalogue", () => ({
  ALERTE_CATALOGUE: {
    referent_handicap_absent: {
      niveau: "critique",
      titre: "Référent absent",
      resolutionAuto: true,
    },
    satisfaction_manquante: {
      niveau: "important",
      titre: "Satisfaction manquante",
      resolutionAuto: false,
    },
    opco_sans_accord: { niveau: "important", titre: "OPCO sans accord", resolutionAuto: true },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { evaluerAlertes, evaluerAlertesDetaille } from "./evaluateur";
import {
  creerOuDedup,
  resoudreAlerte,
  marquerLu,
  marquerToutLu,
  listAlertes,
  countNonLues,
  synchroniserAlertes,
} from "./alertes-service";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers typés
// ───────────────────────────────────────────────��─────────────────────────────

const mp = prisma as unknown as {
  alerteSysteme: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const mockEvaluerAlertes = evaluerAlertes as ReturnType<typeof vi.fn>;

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

function makeAlerte(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    code: "referent_handicap_absent",
    niveau: "critique" as const,
    titre: "Référent handicap absent",
    message: "Aucun référent.",
    cibleType: null,
    cibleId: null,
    lu: false,
    resolue: false,
    resolueAt: null,
    metadata: {},
    createdAt: new Date("2026-06-06T10:00:00Z"),
    updatedAt: new Date("2026-06-06T10:00:00Z"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests stub-aware
// ─────────────────────────────────────────────────────────────────────────────

describe("alertes-service — stub-aware", () => {
  it("creerOuDedup retourne null si stub.invalid", async () => {
    const orig = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const result = await creerOuDedup({
      code: "test",
      niveau: "info",
      titre: "Test",
      message: "Msg",
    });
    expect(result).toBeNull();
    process.env["DATABASE_URL"] = orig;
  });

  it("synchroniserAlertes retourne { crees:0, resolues:0 } si stub", async () => {
    const orig = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const result = await synchroniserAlertes();
    expect(result).toEqual({ crees: 0, resolues: 0 });
    process.env["DATABASE_URL"] = orig;
  });

  it("countNonLues retourne 0 si stub", async () => {
    const orig = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const result = await countNonLues();
    expect(result).toBe(0);
    process.env["DATABASE_URL"] = orig;
  });

  it("listAlertes retourne [] si stub", async () => {
    const orig = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const result = await listAlertes();
    expect(result).toEqual([]);
    process.env["DATABASE_URL"] = orig;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests creerOuDedup
// ─────────────────────────────────────────────────────────────────────────────

describe("creerOuDedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.findFirst.mockResolvedValue(null);
    mp.alerteSysteme.create.mockResolvedValue(makeAlerte());
  });

  it("crée une alerte si aucun doublon non résolu", async () => {
    const result = await creerOuDedup({
      code: "referent_handicap_absent",
      niveau: "critique",
      titre: "Titre",
      message: "Message",
    });
    expect(mp.alerteSysteme.create).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
  });

  it("retourne null si doublon non résolu existe (code+cibleId identiques)", async () => {
    mp.alerteSysteme.findFirst.mockResolvedValue(makeAlerte());

    const result = await creerOuDedup({
      code: "referent_handicap_absent",
      niveau: "critique",
      titre: "Titre",
      message: "Message",
    });
    expect(mp.alerteSysteme.create).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("dé-dup par (code, cibleId) — ne skip PAS si cibleId différent", async () => {
    mp.alerteSysteme.findFirst.mockResolvedValue(null); // pas de doublon pour ce cibleId

    await creerOuDedup({
      code: "emargement_manquant",
      niveau: "critique",
      titre: "Titre",
      message: "Message",
      cibleType: "Enrollment",
      cibleId: "enr-002",
    });
    expect(mp.alerteSysteme.create).toHaveBeenCalledOnce();
    // Vérifie que la recherche de doublon utilise le cibleId
    expect(mp.alerteSysteme.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cibleId: "enr-002" }),
      }),
    );
  });

  it("passe les cibleType/cibleId à la création", async () => {
    await creerOuDedup({
      code: "emargement_manquant",
      niveau: "critique",
      titre: "Titre",
      message: "Msg",
      cibleType: "Enrollment",
      cibleId: "enr-001",
    });
    const createCall = mp.alerteSysteme.create.mock.calls[0]?.[0];
    expect(createCall?.data?.cibleType).toBe("Enrollment");
    expect(createCall?.data?.cibleId).toBe("enr-001");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests resoudreAlerte
// ─────────────────────────────────────────────────────────────────────────────

describe("resoudreAlerte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.update.mockResolvedValue(makeAlerte({ resolue: true, resolueAt: new Date() }));
  });

  it("appelle prisma.update avec resolue=true et resolueAt", async () => {
    await resoudreAlerte(VALID_UUID);
    expect(mp.alerteSysteme.update).toHaveBeenCalledWith({
      where: { id: VALID_UUID },
      data: expect.objectContaining({ resolue: true, resolueAt: expect.any(Date) }),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests marquerLu
// ─────────────────────────────────────────────────────────────────────────────

describe("marquerLu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.update.mockResolvedValue(makeAlerte({ lu: true }));
  });

  it("appelle prisma.update avec lu=true", async () => {
    await marquerLu(VALID_UUID);
    expect(mp.alerteSysteme.update).toHaveBeenCalledWith({
      where: { id: VALID_UUID },
      data: { lu: true },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests marquerToutLu
// ─────────────────────────────────────────────────────────────────────────────

describe("marquerToutLu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.updateMany.mockResolvedValue({ count: 3 });
  });

  it("retourne { count: 3 }", async () => {
    const result = await marquerToutLu();
    expect(result.count).toBe(3);
  });

  it("appelle updateMany avec where lu=false", async () => {
    await marquerToutLu();
    expect(mp.alerteSysteme.updateMany).toHaveBeenCalledWith({
      where: { lu: false },
      data: { lu: true },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests listAlertes
// ─────────────────────────────────────────────────────────────────────────────

describe("listAlertes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.findMany.mockResolvedValue([makeAlerte()]);
  });

  it("retourne un tableau d'alertes", async () => {
    const result = await listAlertes();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("passe les filtres résolu/lu/niveau à prisma", async () => {
    await listAlertes({ resolue: false, lu: false, niveau: "critique" });
    expect(mp.alerteSysteme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resolue: false, lu: false, niveau: "critique" }),
      }),
    );
  });

  it("passe la limite à prisma", async () => {
    await listAlertes({ limit: 10 });
    expect(mp.alerteSysteme.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests countNonLues
// ─────────────────────────────────────────────────────────────────────────────

describe("countNonLues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.count.mockResolvedValue(5);
  });

  it("retourne le count", async () => {
    const result = await countNonLues();
    expect(result).toBe(5);
  });

  // 🔴 `resolue: false` manquait. La pastille additionnait les alertes RÉSOLUES
  // mais non lues — et résoudre une alerte ne la marque pas lue. Constaté en
  // production : pastille à 17, page à 5 alertes actives, écart irrattrapable.
  it("ne compte QUE les alertes encore actives", async () => {
    await countNonLues();
    expect(mp.alerteSysteme.count).toHaveBeenCalledWith({
      where: { lu: false, resolue: false },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests synchroniserAlertes
// ─────────────────────────────────────────────────────────────────────────────

describe("synchroniserAlertes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.findFirst.mockResolvedValue(null); // pas de doublons
    mp.alerteSysteme.create.mockImplementation((args: { data: { code: string } }) =>
      Promise.resolve(makeAlerte({ code: args.data.code })),
    );
    mp.alerteSysteme.findMany.mockResolvedValue([]); // pas d'alertes à résoudre auto
    mp.alerteSysteme.update.mockResolvedValue(makeAlerte());
  });

  it("retourne { crees, resolues } depuis evaluerAlertes", async () => {
    mockEvaluerAlertes.mockResolvedValue([
      {
        code: "referent_handicap_absent",
        niveau: "critique",
        titre: "Référent absent",
        message: "Msg",
      },
    ]);

    const result = await synchroniserAlertes();
    expect(result.crees).toBe(1);
    expect(result.resolues).toBe(0);
  });

  it("ne re-crée pas si doublon — crees=0", async () => {
    mockEvaluerAlertes.mockResolvedValue([
      { code: "referent_handicap_absent", niveau: "critique", titre: "T", message: "M" },
    ]);
    mp.alerteSysteme.findFirst.mockResolvedValue(makeAlerte()); // doublon existant

    const result = await synchroniserAlertes();
    expect(result.crees).toBe(0);
    expect(mp.alerteSysteme.create).not.toHaveBeenCalled();
  });

  it("résout auto les alertes dont la condition a disparu (resolutionAuto=true)", async () => {
    mockEvaluerAlertes.mockResolvedValue([]); // aucune alerte active

    // Une alerte referent_handicap_absent ouverte → doit être résolue auto (resolutionAuto=true)
    mp.alerteSysteme.findMany.mockResolvedValue([
      makeAlerte({ id: "alert-to-resolve", code: "referent_handicap_absent", cibleId: null }),
    ]);

    const result = await synchroniserAlertes();
    expect(result.resolues).toBe(1);
    expect(mp.alerteSysteme.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "alert-to-resolve" } }),
    );
  });

  it("ne résout PAS auto les alertes satisfaction_manquante (resolutionAuto=false)", async () => {
    mockEvaluerAlertes.mockResolvedValue([]); // aucune alerte active

    // Alerte satisfaction_manquante ouverte — resolutionAuto=false dans le mock catalogue
    // La requête prisma.findMany utilise `code: { in: codesAutoResolution }` donc ne
    // renverra que referent_handicap_absent et opco_sans_accord (resolutionAuto=true).
    // On configure findMany pour retourner UNIQUEMENT des alertes à résolution auto.
    mp.alerteSysteme.findMany.mockResolvedValue([]);
    // Aucune alerte auto-résolution ouverte → resolues = 0
    const result = await synchroniserAlertes();
    expect(result.resolues).toBe(0);
    // Vérifie que update n'a pas été appelé
    expect(mp.alerteSysteme.update).not.toHaveBeenCalled();
  });

  it("SUSPEND la résolution auto quand une règle a échoué (fail-soft ≠ disparu)", async () => {
    // Une règle en échec ne produit aucune candidate : sans ce garde, un
    // timeout DB un matin résoudrait EN MASSE toutes ses alertes ouvertes.
    (evaluerAlertesDetaille as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      candidates: [],
      reglesEnEchec: ["devis_expire_j7"],
    });
    mp.alerteSysteme.findMany.mockResolvedValue([
      makeAlerte({ id: "alert-ouverte", code: "referent_handicap_absent", cibleId: null }),
    ]);
    const result = await synchroniserAlertes();
    expect(result.resolues).toBe(0);
    expect(mp.alerteSysteme.update).not.toHaveBeenCalled();
  });

  it("dé-duplique par (code, cibleId) pour la résolution auto", async () => {
    mockEvaluerAlertes.mockResolvedValue([
      // opco_sans_accord actif pour ses-001 mais pas pour ses-002
      {
        code: "opco_sans_accord",
        niveau: "important",
        titre: "T",
        message: "M",
        cibleType: "TrainingSession",
        cibleId: "ses-001",
      },
    ]);

    // Deux alertes opco ouvertes : ses-001 (encore active) et ses-002 (disparue)
    mp.alerteSysteme.findMany.mockResolvedValue([
      makeAlerte({ id: "alert-ses-001", code: "opco_sans_accord", cibleId: "ses-001" }),
      makeAlerte({ id: "alert-ses-002", code: "opco_sans_accord", cibleId: "ses-002" }),
    ]);

    const result = await synchroniserAlertes();
    // Seule ses-002 doit être résolue (ses-001 est encore dans les candidates)
    expect(result.resolues).toBe(1);
    expect(mp.alerteSysteme.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "alert-ses-002" } }),
    );
    expect(mp.alerteSysteme.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "alert-ses-001" } }),
    );
  });
});
