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
      createMany: vi.fn(),
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
      reglesTronquees: [] as { nom: string; trouvees: number; retenues: number }[],
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
    createMany: ReturnType<typeof vi.fn>;
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

  // ⚠️ `try/finally` — et pas seulement par style. Les tests de ce bloc posent
  // `DATABASE_URL=stub.invalid` puis le restaurent APRÈS l'assertion. Quand
  // l'assertion échoue, la restauration ne s'exécute jamais : la variable reste
  // sur le stub et TOUS les tests suivants du fichier court-circuitent. Constaté
  // le 16/08 — une seule vraie défaillance en avait produit quinze fausses, et
  // c'est la plus longue partie du diagnostic.
  it("synchroniserAlertes ne touche à rien si stub", async () => {
    const orig = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const result = await synchroniserAlertes();
      expect(result).toEqual({ crees: 0, resolues: 0, tronquees: [], rafraichies: 0 });
    } finally {
      process.env["DATABASE_URL"] = orig;
    }
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

  // 🔴 T3a — la course que l'index unique rend DÉTECTABLE, et qu'il fallait
  // donc absorber. `portail.ts` appelle `void creerOuDedup(...)` sans `await` :
  // un rejet non traité y ferait planter la requête d'un stagiaire pour un
  // doublon dont la bonne réponse est « ne rien faire ».
  it("absorbe un conflit d'unicité concurrent (P2002) et rend null", async () => {
    mp.alerteSysteme.findFirst.mockResolvedValue(null); // rien au moment de la lecture
    mp.alerteSysteme.create.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );

    await expect(
      creerOuDedup({ code: "c", niveau: "info", titre: "T", message: "M" }),
    ).resolves.toBeNull();
  });

  it("mais laisse remonter TOUTE autre erreur", async () => {
    // Absorber sans distinguer transformerait une panne de base en silence.
    mp.alerteSysteme.findFirst.mockResolvedValue(null);
    mp.alerteSysteme.create.mockRejectedValue(
      Object.assign(new Error("connexion perdue"), { code: "P1001" }),
    );

    await expect(
      creerOuDedup({ code: "c", niveau: "info", titre: "T", message: "M" }),
    ).rejects.toThrow("connexion perdue");
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
    // T3a — le moteur écrit désormais en SALVE. `createMany` renvoie ce que la
    // base aurait inséré ; c'est elle, et non plus une lecture préalable, qui
    // tranche les doublons (index unique partiel).
    mp.alerteSysteme.createMany.mockImplementation((args: { data: unknown[] }) =>
      Promise.resolve({ count: args.data.length }),
    );
    mp.alerteSysteme.updateMany.mockImplementation((args: { where: { id: { in: string[] } } }) =>
      Promise.resolve({ count: args.where.id.in.length }),
    );
    mp.alerteSysteme.findMany.mockResolvedValue([]); // pas d'alertes à résoudre auto
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

  // 🔴 La dé-duplication a CHANGÉ DE MAIN. Elle reposait sur un `findFirst`
  // suivi d'un `create` : deux passages concurrents lisaient tous les deux
  // « aucun doublon » et écrivaient tous les deux. Elle est désormais garantie
  // par un index unique partiel, et `skipDuplicates` la fait respecter côté
  // base. Ce test vérifie donc ce qui compte maintenant : que le moteur
  // DEMANDE bien à la base d'ignorer les doublons, et qu'il rapporte ce que la
  // base a réellement inséré — pas ce qu'il croyait insérer.
  it("délègue la dé-duplication à la base, et rapporte ce qu'elle a inséré", async () => {
    mockEvaluerAlertes.mockResolvedValue([
      { code: "referent_handicap_absent", niveau: "critique", titre: "T", message: "M" },
    ]);
    mp.alerteSysteme.createMany.mockResolvedValue({ count: 0 }); // la base a refusé le doublon

    const result = await synchroniserAlertes();
    expect(result.crees).toBe(0);
    const args = mp.alerteSysteme.createMany.mock.calls[0]?.[0] as { skipDuplicates: boolean };
    expect(args.skipDuplicates, "sans skipDuplicates, un doublon lèverait").toBe(true);
  });

  it("dé-duplique aussi À L'INTÉRIEUR d'un même lot", async () => {
    // `ON CONFLICT DO NOTHING` ne protège pas contre deux lignes identiques
    // dans la MÊME commande sur toutes les versions de Postgres. Deux règles
    // peuvent parfaitement produire la même candidate.
    mockEvaluerAlertes.mockResolvedValue([
      { code: "opco_sans_accord", niveau: "important", titre: "T", message: "M", cibleId: "s-1" },
      { code: "opco_sans_accord", niveau: "important", titre: "T", message: "M", cibleId: "s-1" },
      { code: "opco_sans_accord", niveau: "important", titre: "T", message: "M", cibleId: "s-2" },
    ]);
    await synchroniserAlertes();
    const args = mp.alerteSysteme.createMany.mock.calls[0]?.[0] as { data: unknown[] };
    expect(args.data, "le lot contient deux fois la même alerte").toHaveLength(2);
  });

  it("🔴 UNE seule commande d'insertion, quel que soit le nombre d'alertes", async () => {
    // C'est tout l'objet de T3a : à 400 alertes, le moteur faisait 800 allers-
    // retours. Si ce test rougit, on est revenu à une écriture par alerte.
    mockEvaluerAlertes.mockResolvedValue(
      Array.from({ length: 120 }, (_, i) => ({
        code: "opco_sans_accord",
        niveau: "important" as const,
        titre: "T",
        message: "M",
        cibleId: `s-${i}`,
      })),
    );
    await synchroniserAlertes();
    expect(mp.alerteSysteme.createMany).toHaveBeenCalledTimes(1);
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
    expect(mp.alerteSysteme.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["alert-to-resolve"] } } }),
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
    // Rien à résoudre → aucune commande d'écriture, pas une commande vide.
    expect(mp.alerteSysteme.updateMany).not.toHaveBeenCalled();
  });

  it("SUSPEND la résolution auto quand une règle a échoué (fail-soft ≠ disparu)", async () => {
    // Une règle en échec ne produit aucune candidate : sans ce garde, un
    // timeout DB un matin résoudrait EN MASSE toutes ses alertes ouvertes.
    (evaluerAlertesDetaille as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      candidates: [],
      reglesEnEchec: ["devis_expire_j7"],
      reglesTronquees: [],
    });
    mp.alerteSysteme.findMany.mockResolvedValue([
      makeAlerte({ id: "alert-ouverte", code: "referent_handicap_absent", cibleId: null }),
    ]);
    const result = await synchroniserAlertes();
    expect(result.resolues).toBe(0);
    expect(mp.alerteSysteme.updateMany).not.toHaveBeenCalled();
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
    // Seule ses-002 doit être résolue (ses-001 est encore dans les candidates).
    // 🔴 La précision par (code, cibleId) est LA règle métier de ce bloc : c'est
    // elle qui empêche de clore une alerte encore vraie. Le passage à un
    // `updateMany` ne devait pas l'entamer d'un pouce.
    expect(result.resolues).toBe(1);
    const args = mp.alerteSysteme.updateMany.mock.calls[0]?.[0] as {
      where: { id: { in: string[] } };
    };
    expect(args.where.id.in).toEqual(["alert-ses-002"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Une correction de libellé doit ATTEINDRE les alertes déjà ouvertes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `createMany({ skipDuplicates: true })` insère ou ne fait RIEN. Une alerte déjà
 * ouverte gardait donc, pour toujours, le titre écrit le jour de sa création —
 * même après correction de la règle qui la produit.
 *
 * Cas réel du 2026-09-06 : `emargement_aucune_signature` affichait encore
 * « Liens d'émargement PARTIS, aucune signature » sur la prod, alors que le
 * titre avait été corrigé en « Lien d'émargement ÉMIS » la veille — la règle ne
 * sait rien d'un envoi, elle lit un jeton FABRIQUÉ. Le commentaire du catalogue
 * l'écrit lui-même : « une alerte qui nomme une cause fausse est pire qu'une
 * alerte absente — elle déplace l'attention ». Elle l'avait déplacée.
 */
describe("🔴 le libellé d'une alerte ouverte suit la règle qui la produit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.createMany.mockResolvedValue({ count: 0 }); // la base refuse le doublon
    mp.alerteSysteme.updateMany.mockResolvedValue({ count: 0 });
    mp.alerteSysteme.update.mockResolvedValue(makeAlerte());
    mp.alerteSysteme.findMany.mockResolvedValue([]);
  });

  it("réécrit titre, message et niveau quand la règle a changé d'avis", async () => {
    mockEvaluerAlertes.mockResolvedValue([
      {
        code: "referent_handicap_absent",
        niveau: "important",
        titre: "Lien d'émargement ÉMIS, aucune signature",
        message: "Le message corrigé.",
        cibleId: "ses-001",
      },
    ]);
    // 1er `findMany` = la lecture de rafraîchissement ; 2e = la résolution auto.
    mp.alerteSysteme.findMany.mockResolvedValueOnce([
      makeAlerte({
        id: "alerte-perimee",
        code: "referent_handicap_absent",
        cibleId: "ses-001",
        niveau: "critique",
        titre: "Liens d'émargement PARTIS, aucune signature",
        message: "L'ancien message.",
      }),
    ]);

    const result = await synchroniserAlertes();

    expect(result.rafraichies, "la ligne périmée n'a pas été rafraîchie").toBe(1);
    const args = mp.alerteSysteme.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(args.where.id).toBe("alerte-perimee");
    expect(args.data["titre"]).toBe("Lien d'émargement ÉMIS, aucune signature");
    expect(args.data["message"]).toBe("Le message corrigé.");
    expect(args.data["niveau"]).toBe("important");
  });

  it("🔴 ne touche NI `resolue`, NI `resolueAt`, NI `createdAt`", async () => {
    // L'ancienneté d'une alerte est une information que l'administrateur lit.
    // Un rafraîchissement qui la remettrait à zéro ferait rajeunir un problème
    // vieux de trois semaines — exactement le contraire du but.
    mockEvaluerAlertes.mockResolvedValue([
      {
        code: "referent_handicap_absent",
        niveau: "critique",
        titre: "Nouveau titre",
        message: "M",
        cibleId: "ses-001",
      },
    ]);
    mp.alerteSysteme.findMany.mockResolvedValueOnce([
      makeAlerte({
        id: "a1",
        code: "referent_handicap_absent",
        cibleId: "ses-001",
        titre: "Vieux",
      }),
    ]);

    await synchroniserAlertes();

    const args = mp.alerteSysteme.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(args.data).sort()).toEqual(["message", "niveau", "titre"]);
  });

  it("🔴 n'écrit RIEN quand le libellé n'a pas bougé — sinon il tourne chaque nuit", async () => {
    // Témoin du cas COURANT, et il est le plus important des trois : sans la
    // comparaison, chaque passage du cron réécrirait toutes les alertes
    // ouvertes, ferait tourner leur `updatedAt`, et noierait le signal « ce
    // texte a changé » dans un bruit quotidien.
    mockEvaluerAlertes.mockResolvedValue([
      {
        code: "referent_handicap_absent",
        niveau: "critique",
        titre: "Titre identique",
        message: "Message identique",
        cibleId: "ses-001",
      },
    ]);
    mp.alerteSysteme.findMany.mockResolvedValueOnce([
      makeAlerte({
        id: "a1",
        code: "referent_handicap_absent",
        cibleId: "ses-001",
        niveau: "critique",
        titre: "Titre identique",
        message: "Message identique",
      }),
    ]);

    const result = await synchroniserAlertes();

    expect(result.rafraichies).toBe(0);
    expect(
      mp.alerteSysteme.update,
      "une alerte inchangée a quand même été réécrite : le cron ferait tourner " +
        "`updatedAt` sur toute la table chaque nuit.",
    ).not.toHaveBeenCalled();
  });
});
