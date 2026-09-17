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
    // Le marqueur d'état du dernier balayage (2026-09-13) : il vit dans
    // `site_settings`, comme le marqueur d'activation du CRM.
    siteSetting: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
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
  creerOuActualiser,
  resoudreAlertesParCode,
  resoudreAlerte,
  marquerLu,
  marquerToutLu,
  listAlertes,
  countNonLues,
  synchroniserAlertes,
  lireDernierBalayage,
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
  // ⚠️ Le modèle est déclaré DEUX FOIS — fabrique `vi.mock` ET ce cast — et les
  // deux sont tenus séparément. En oublier un fait échouer le typecheck ou,
  // pire, lever à l'exécution dans une règle avalée par le fail-soft.
  siteSetting: {
    upsert: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
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
      expect(result).toEqual({
        crees: 0,
        resolues: 0,
        tronquees: [],
        rafraichies: 0,
        // ⚠️ VIDE, jamais absent. Au build stub le moteur ne tourne pas : il n'a
        // rien constaté, et rendre le champ absent forcerait chaque lecteur à
        // distinguer « pas de règle en échec » de « champ manquant » — deux
        // sens pour une même absence, très exactement ce que ce champ existe
        // pour supprimer.
        reglesEnEchec: [],
      });
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

  /**
   * 🔴 `resolutionAuto: false` NE TENAIT PAS SA PROMESSE — 2026-09-07.
   *
   * Le dé-doublonnage ne regardait que les alertes NON résolues. Une alerte
   * fermée à la main était donc recréée à l'identique au balayage suivant, tant
   * que sa règle produisait le candidat. Pour un code dont la cause est un fait
   * PASSÉ, aucun geste ne pouvait la fermer : on cliquait « Résoudre » et on la
   * retrouvait le lendemain matin.
   *
   * 🔑 Le drapeau ne pilotait QUE la résolution automatique, jamais la
   * re-création — son nom disait l'inverse de ce qu'il faisait, et c'est ce qui
   * a rendu le défaut invisible. Huit codes étaient concernés.
   */
  describe("🔴 une alerte à fermeture HUMAINE ne se recrée pas à l'identique", () => {
    // Le double de catalogue de ce fichier (en tête) déclare `satisfaction_manquante`
    // avec `resolutionAuto: false` — c'est lui qui fait foi ici, pas le vrai
    // catalogue : on éprouve le MÉCANISME, pas la table.
    const SANS_AUTO = "satisfaction_manquante";

    it("ne recrée PAS quand une alerte résolue porte le même message", async () => {
      mp.alerteSysteme.findFirst
        .mockResolvedValueOnce(null) // aucune ouverte
        .mockResolvedValueOnce(makeAlerte()); // une RÉSOLUE, même message

      const r = await creerOuDedup({
        code: SANS_AUTO,
        niveau: "critique",
        titre: "T",
        message: "Taux de satisfaction 42 % sur AXI-SESS-2026-001",
        cibleId: "sess-1",
      });

      expect(mp.alerteSysteme.create).not.toHaveBeenCalled();
      expect(r).toBeNull();
    });

    it("🔑 recrée si le MESSAGE a changé — c'est un fait nouveau", async () => {
      // Contre-témoin capital. Un « ne jamais recréer après résolution » serait
      // faux : une habilitation renouvelée puis ré-expirée des années plus tard
      // doit crier de nouveau. Le message porte la donnée qui distingue les deux
      // cas — date d'échéance, valeur mesurée. La recherche doit donc le filtrer.
      mp.alerteSysteme.findFirst.mockResolvedValue(null);

      await creerOuDedup({
        code: SANS_AUTO,
        niveau: "critique",
        titre: "T",
        message: "Taux de satisfaction 31 % sur AXI-SESS-2026-007",
        cibleId: "sess-1",
      });

      expect(mp.alerteSysteme.create).toHaveBeenCalledOnce();
      expect(mp.alerteSysteme.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resolue: true,
            message: "Taux de satisfaction 31 % sur AXI-SESS-2026-007",
          }),
        }),
      );
    });

    it("🔑 ne regarde PAS les résolues pour un code à résolution AUTO", async () => {
      // Second contre-témoin. Ces codes-là s'éteignent et se rallument par
      // construction : leur appliquer la garde les rendrait muets pour toujours
      // après une seule résolution — on aurait échangé une alerte ineffaçable
      // contre une alerte définitivement éteinte, ce qui est pire.
      mp.alerteSysteme.findFirst.mockResolvedValue(null);

      await creerOuDedup({
        code: "referent_handicap_absent", // resolutionAuto: true dans le double
        niveau: "critique",
        titre: "T",
        message: "M",
        cibleId: "sess-2",
      });

      expect(mp.alerteSysteme.create).toHaveBeenCalledOnce();
      // Une seule lecture : celle des non résolues. La seconde n'a pas lieu.
      expect(mp.alerteSysteme.findFirst).toHaveBeenCalledOnce();
    });
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

// ─────────────────────────────────────────────────────────────────────────────
// Le marqueur d'état du dernier balayage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 CE MARQUEUR EXISTE PARCE QUE LE BALAYAGE NOMINAL EST UN CRON.
 *
 * Une règle qui LÈVE est avalée par le fail-soft par règle, et son échec
 * suspend la résolution automatique de TOUTES les alertes. Le tableau se fige,
 * ce qui devrait se fermer s'accumule, et la lecture devient du bruit.
 *
 * La seule trace était un `console.warn` dans le worker. Personne ne le lit.
 */
describe("le moteur dit quand il boite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.alerteSysteme.createMany.mockResolvedValue({ count: 0 });
    mp.alerteSysteme.findMany.mockResolvedValue([]);
    mp.alerteSysteme.updateMany.mockResolvedValue({ count: 0 });
    mp.siteSetting.upsert.mockResolvedValue({});
    mp.siteSetting.findUnique.mockResolvedValue(null);
    mockEvaluerAlertes.mockResolvedValue([]);
  });

  it("🔴 consigne les règles en échec, PAR LEUR NOM", async () => {
    (evaluerAlertesDetaille as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      candidates: [],
      reglesEnEchec: ["contrat_cdd_non_remis"],
      reglesTronquees: [],
    });
    const r = await synchroniserAlertes();
    expect(r.reglesEnEchec).toStrictEqual(["contrat_cdd_non_remis"]);

    const valeur = (mp.siteSetting.upsert.mock.calls[0]?.[0] as { update: { value: unknown } })
      .update.value as { reglesEnEchec: string[] };
    expect(valeur.reglesEnEchec).toStrictEqual(["contrat_cdd_non_remis"]);
  });

  it("🔑 CONSIGNE AUSSI UN BALAYAGE SAIN — sinon le bandeau mentirait après la réparation", async () => {
    // La moitié de la correction. Un marqueur posé seulement en cas d'échec
    // resterait affiché des semaines après que la panne a été réparée, et on
    // apprendrait à ignorer ce bandeau-là aussi.
    const r = await synchroniserAlertes();
    expect(r.reglesEnEchec).toStrictEqual([]);
    expect(mp.siteSetting.upsert).toHaveBeenCalledTimes(1);
    const valeur = (mp.siteSetting.upsert.mock.calls[0]?.[0] as { update: { value: unknown } })
      .update.value as { reglesEnEchec: string[] };
    expect(valeur.reglesEnEchec).toStrictEqual([]);
  });

  it("⚠️ un marqueur NON ÉCRIT ne fait pas échouer le balayage", async () => {
    // La trace est un confort de lecture ; les alertes sont le travail. Faire
    // tomber le balayage sur l'écriture du marqueur échangerait un petit
    // problème contre un gros.
    mp.siteSetting.upsert.mockRejectedValue(new Error("colonne absente (test)"));
    await expect(synchroniserAlertes()).resolves.toBeDefined();
  });

  it("🔴 `null` quand AUCUN balayage n'a été consigné — pas « tout va bien »", async () => {
    // Confondre « on ne sait pas » avec « sain » rétablirait le silence qu'on
    // corrige. L'écran formule les deux cas différemment.
    mp.siteSetting.findUnique.mockResolvedValue(null);
    await expect(lireDernierBalayage()).resolves.toBeNull();
  });

  it("relit ce qui a été consigné", async () => {
    mp.siteSetting.findUnique.mockResolvedValue({
      value: { at: "2026-09-13T02:00:00.000Z", reglesEnEchec: ["une_regle"] },
    });
    await expect(lireDernierBalayage()).resolves.toStrictEqual({
      at: "2026-09-13T02:00:00.000Z",
      reglesEnEchec: ["une_regle"],
    });
  });

  it("🔑 une valeur MALFORMÉE rend null, jamais une forme inventée", async () => {
    // ⚠️ `value` est une colonne Json : rien ne garantit sa forme côté
    // application. On teste la forme au lieu de caster — un cast ferait
    // planter l'écran des alertes sur une valeur écrite à la main.
    mp.siteSetting.findUnique.mockResolvedValue({ value: "une chaîne" });
    await expect(lireDernierBalayage()).resolves.toBeNull();
    mp.siteSetting.findUnique.mockResolvedValue({ value: ["un", "tableau"] });
    await expect(lireDernierBalayage()).resolves.toBeNull();
    mp.siteSetting.findUnique.mockResolvedValue({ value: { at: 42 } });
    await expect(lireDernierBalayage()).resolves.toBeNull();
  });

  it("⚠️ des noms de règles NON TEXTUELS sont écartés, la lecture survit", async () => {
    mp.siteSetting.findUnique.mockResolvedValue({
      value: { at: "2026-09-13T02:00:00.000Z", reglesEnEchec: ["ok", 7, null] },
    });
    const r = await lireDernierBalayage();
    expect(r?.reglesEnEchec).toStrictEqual(["ok"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// creerOuActualiser — le fusible qui ne fondait qu'une fois (2026-09-17)
// ─────────────────────────────────────────────────────────────────────────────

describe("creerOuActualiser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
  });

  const entree = {
    code: "emails_echecs_consecutifs",
    niveau: "critique" as const,
    titre: "19 envois d'e-mails échouent d'affilée",
    message: "19 envoi(s) ont échoué d'affilée vers 19 destinataires distincts.",
    metadata: { chaine: 19 },
  };

  it("🔴 RAFRAÎCHIT l'alerte ouverte au lieu de la dé-dupliquer en silence", async () => {
    // Le défaut exact : `creerOuDedup` rendait `null` et ne touchait à RIEN.
    // Le titre affiché restait celui du premier passage — « 3 » — pendant que
    // la panne montait à 19. Et comme ce code ne se referme pas tout seul, la
    // dé-duplication valait pour TOUTES les pannes suivantes.
    mp.alerteSysteme.findFirst.mockResolvedValue({
      id: VALID_UUID,
      titre: "3 envois d'e-mails échouent d'affilée",
      message: "ancien message",
      niveau: "critique",
    });
    mp.alerteSysteme.update.mockResolvedValue(makeAlerte({ titre: entree.titre }));

    const r = await creerOuActualiser(entree);

    expect(r).not.toBeNull();
    expect(mp.alerteSysteme.create).not.toHaveBeenCalled();
    const args = mp.alerteSysteme.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(args.where).toEqual({ id: VALID_UUID });
    expect(args.data["titre"]).toBe(entree.titre);
    expect(args.data["message"]).toBe(entree.message);
    expect(args.data["metadata"]).toEqual(entree.metadata);
  });

  it("🔑 repasse l'alerte NON LUE — l'état a changé, il mérite un second regard", async () => {
    mp.alerteSysteme.findFirst.mockResolvedValue({
      id: VALID_UUID,
      titre: "ancien",
      message: "ancien",
      niveau: "critique",
    });
    mp.alerteSysteme.update.mockResolvedValue(makeAlerte());

    await creerOuActualiser(entree);

    const args = mp.alerteSysteme.update.mock.calls[0]?.[0] as { data: { lu: boolean } };
    expect(args.data.lu).toBe(false);
  });

  it("🔑 CONTRE-TÉMOIN : n'écrit RIEN quand rien n'a bougé", async () => {
    // Sinon le passage horaire re-marquerait l'alerte « non lue » toutes les
    // heures : au bout d'une journée, la pastille ne dirait plus « du nouveau »
    // mais « le cron est passé ».
    mp.alerteSysteme.findFirst.mockResolvedValue({
      id: VALID_UUID,
      titre: entree.titre,
      message: entree.message,
      niveau: entree.niveau,
    });

    await expect(creerOuActualiser(entree)).resolves.toBeNull();
    expect(mp.alerteSysteme.update).not.toHaveBeenCalled();
  });

  it("🔑 ne touche PAS à createdAt — « depuis quand » doit rester le début de l'incident", async () => {
    mp.alerteSysteme.findFirst.mockResolvedValue({
      id: VALID_UUID,
      titre: "ancien",
      message: "ancien",
      niveau: "critique",
    });
    mp.alerteSysteme.update.mockResolvedValue(makeAlerte());

    await creerOuActualiser(entree);

    const args = mp.alerteSysteme.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(Object.keys(args.data)).not.toContain("createdAt");
  });

  it("CRÉE quand aucune alerte n'est ouverte", async () => {
    mp.alerteSysteme.findFirst.mockResolvedValue(null);
    mp.alerteSysteme.create.mockResolvedValue(makeAlerte());

    const r = await creerOuActualiser(entree);

    expect(r).not.toBeNull();
    expect(mp.alerteSysteme.create).toHaveBeenCalledTimes(1);
    expect(mp.alerteSysteme.update).not.toHaveBeenCalled();
  });

  it("reste muet au build (base stub)", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    await expect(creerOuActualiser(entree)).resolves.toBeNull();
    expect(mp.alerteSysteme.findFirst).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resoudreAlertesParCode — la fermeture par l'ÉMETTEUR, pas par le balayage
// ─────────────────────────────────────────────────────────────────────────────

describe("resoudreAlertesParCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
  });

  it("🔴 referme les alertes ouvertes des codes demandés, et elles seules", async () => {
    mp.alerteSysteme.updateMany.mockResolvedValue({ count: 2 });

    const n = await resoudreAlertesParCode(["emails_echecs_consecutifs"]);

    expect(n).toBe(2);
    const args = mp.alerteSysteme.updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(args.where).toMatchObject({
      code: { in: ["emails_echecs_consecutifs"] },
      resolue: false,
    });
    expect(args.data["resolue"]).toBe(true);
    expect(args.data["resolueAt"]).toBeInstanceOf(Date);
  });

  it("🔑 CONTRE-TÉMOIN : une liste vide n'écrit RIEN", async () => {
    // Sans cette garde, un appelant qui n'a rien à refermer déclencherait un
    // `updateMany` avec `code: { in: [] }` — inoffensif ici, mais c'est
    // exactement le genre de requête qui devient destructrice à la moindre
    // refonte du `where`.
    const n = await resoudreAlertesParCode([]);
    expect(n).toBe(0);
    expect(mp.alerteSysteme.updateMany).not.toHaveBeenCalled();
  });

  it("reste muet au build (base stub)", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    await expect(resoudreAlertesParCode(["emails_echecs_consecutifs"])).resolves.toBe(0);
    expect(mp.alerteSysteme.updateMany).not.toHaveBeenCalled();
  });
});
