/**
 * 🔴 LE REMPLACEMENT D'UN FORMATEUR — LA SÉQUENCE COMPLÈTE (`D1` + `D6`).
 *
 * ## Ce que ces témoins rejouent
 *
 * A accepte la mission → l'organisme affecte B à sa place → B ne répond jamais.
 * C'est le cas le plus COURANT du désistement, et c'était celui qui n'alertait
 * pas. Un témoin qui n'exercerait pas le REMPLACEMENT ne mesurerait rien : le
 * défaut naît précisément entre l'acceptation de A et l'affectation de B.
 *
 * Deux défauts s'y nouent, et un seul geste les ferme — le passage par
 * `retirerMissionsOuvertes` + `archiverAffectationsRetirees` :
 *
 * - **`D1`** — la mission de A restait `acceptee` alors que sa ligne
 *   `SessionFormateur` venait d'être supprimée. Deux règles d'alerte lisent
 *   cette mission fantôme comme la preuve que quelqu'un tient la place
 *   (`missionsFormateur: { where: { statut: "acceptee" } }` puis `continue`) :
 *   elles se taisaient sur une session qui partait sans personne.
 * - **`D6`** — la suppression emportait le tarif SNAPSHOTÉ à l'affectation de A
 *   (celui que sa lettre de mission a repris) et la trace de ce qu'on lui avait
 *   déjà envoyé. Plus rien ne disait qu'il avait un jour été le formateur.
 *
 * ## Une base en mémoire, pas des `mockResolvedValue`
 *
 * Les `where` de Prisma sont exactement ce qu'il faut mesurer ici : un mock qui
 * rend une liste déjà filtrée ne distingue pas `statut: "en_attente"` de
 * `statut: { in: ["en_attente", "acceptee"] }` — c'est-à-dire précisément le
 * défaut. Le store ci-dessous APPLIQUE le `where` reçu.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SESSION_ID = "33333333-3333-3333-3333-333333333333";
const FORMATION_ID = "11111111-1111-1111-1111-111111111111";
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const DEBUT = new Date("2026-10-01T08:00:00Z");
const FIN = new Date("2026-10-01T17:00:00Z");
const AFFECTE_A_LE = new Date("2026-09-01T09:00:00Z");
const CONVOQUE_A_LE = new Date("2026-09-24T06:00:00Z");

interface MissionRow {
  id: string;
  sessionId: string;
  trainerId: string;
  role: string;
  statut: string;
}
interface AffectationRow {
  sessionId: string;
  trainerId: string;
  role: string;
  heuresAnimees: number | null;
  tarifHtCents: number | null;
  convocationJ7EnvoyeeAt: Date | null;
  rappelJ1EnvoyeAt: Date | null;
  createdAt: Date;
}

const { store, prismaMock, getTrainerConflictsMock } = vi.hoisted(() => {
  const store = {
    missions: [] as MissionRow[],
    affectations: [] as AffectationRow[],
    archives: [] as Record<string, unknown>[],
    formateurPrincipalId: null as string | null,
  };

  /** Applique le `where` REÇU — c'est lui qu'on mesure. */
  const correspond = (
    row: { sessionId: string; trainerId: string; role: string; statut?: string },
    where: Record<string, unknown>,
  ): boolean => {
    if (where["sessionId"] !== undefined && row.sessionId !== where["sessionId"]) return false;
    if (where["role"] !== undefined && row.role !== where["role"]) return false;
    const statut = where["statut"];
    if (typeof statut === "string" && row.statut !== statut) return false;
    if (statut !== undefined && typeof statut === "object" && statut !== null) {
      const dans = (statut as { in?: string[] }).in;
      if (Array.isArray(dans) && (row.statut === undefined || !dans.includes(row.statut))) {
        return false;
      }
    }
    const trainerId = where["trainerId"];
    if (typeof trainerId === "string" && row.trainerId !== trainerId) return false;
    if (trainerId !== undefined && typeof trainerId === "object" && trainerId !== null) {
      const pas = (trainerId as { not?: string }).not;
      if (typeof pas === "string" && row.trainerId === pas) return false;
    }
    return true;
  };

  const sessionFormateur = {
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      store.affectations.filter((a) => correspond(a, where)),
    ),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const restants = store.affectations.filter((a) => !correspond(a, where));
      const count = store.affectations.length - restants.length;
      store.affectations = restants;
      return { count };
    }),
    upsert: vi.fn(
      async ({
        where,
        create,
      }: {
        where: { sessionId_trainerId: { sessionId: string; trainerId: string } };
        create: Partial<AffectationRow>;
      }) => {
        store.affectations.push({
          sessionId: where.sessionId_trainerId.sessionId,
          trainerId: where.sessionId_trainerId.trainerId,
          role: create.role ?? "principal",
          heuresAnimees: null,
          tarifHtCents: create.tarifHtCents ?? null,
          convocationJ7EnvoyeeAt: null,
          rappelJ1EnvoyeAt: null,
          createdAt: new Date(),
        });
        return {};
      },
    ),
  };

  const missionFormateur = {
    updateMany: vi.fn(
      async ({ where, data }: { where: Record<string, unknown>; data: { statut: string } }) => {
        let count = 0;
        for (const m of store.missions) {
          if (correspond(m, where)) {
            m.statut = data.statut;
            count += 1;
          }
        }
        return { count };
      },
    ),
  };

  const prismaMock = {
    trainingSession: {
      findUnique: vi.fn(async () => ({
        formationId: FORMATION_ID,
        dateDebut: DEBUT,
        dateFin: FIN,
        statut: "planifiee",
      })),
      update: vi.fn(async ({ data }: { data: { formateurPrincipalId: string | null } }) => {
        store.formateurPrincipalId = data.formateurPrincipalId;
        return {};
      }),
    },
    trainer: {
      findUnique: vi.fn(async () => ({
        actif: true,
        statut: "sous_traitant",
        sousTraitantVerifieAt: new Date("2026-01-01T00:00:00Z"),
        tarifJourneeHtCents: 80000,
        habilitations: [{ formationId: FORMATION_ID }],
      })),
    },
    sessionFormateur,
    missionFormateur,
    sessionFormateurRetire: {
      createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
        store.archives.push(...data);
        return { count: data.length };
      }),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        trainingSession: prismaMock.trainingSession,
        sessionFormateur,
        missionFormateur,
      }),
    ),
  };

  return { store, prismaMock, getTrainerConflictsMock: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/admin-planning/queries", () => ({
  getTrainerConflicts: getTrainerConflictsMock,
}));
vi.mock("@/server/qualiopi/trainers/avertissements-affectation", () => ({
  avertissementsAffectation: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/server/qualiopi/trainers/conflits-indisponibilite", () => ({
  detecterIndisponibiliteFormateur: vi.fn().mockResolvedValue(null),
  formulerConflit: vi.fn(() => ""),
}));
// La proposition au NOUVEAU formateur est fail-soft et hors sujet ici : elle est
// neutralisée pour que le témoin ne mesure que le retrait de l'ANCIEN.
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ enqueued: false }),
}));

import { assignTrainerToSessionAction } from "./trainers";
import { affectationConfirmee } from "@/server/qualiopi/trainers/delai-reponse-mission";

const RACINE = process.cwd();
const lire = (p: string): string => readFileSync(join(RACINE, p), "utf8");

/** Étape 1 et 2 de la séquence : A est affecté, convoqué, et il a ACCEPTÉ. */
function aAccepteEtEstEnPlace(): void {
  store.missions = [
    { id: "m-A", sessionId: SESSION_ID, trainerId: A, role: "principal", statut: "acceptee" },
  ];
  store.affectations = [
    {
      sessionId: SESSION_ID,
      trainerId: A,
      role: "principal",
      heuresAnimees: null,
      tarifHtCents: 75000,
      convocationJ7EnvoyeeAt: CONVOQUE_A_LE,
      rappelJ1EnvoyeAt: null,
      createdAt: AFFECTE_A_LE,
    },
  ];
  store.archives = [];
  store.formateurPrincipalId = A;
}

beforeEach(() => {
  getTrainerConflictsMock.mockReset().mockResolvedValue([]);
  prismaMock.sessionFormateurRetire.createMany.mockClear();
  aAccepteEtEstEnPlace();
});

describe("🔴 D1 — la mission ACCEPTÉE d'un formateur écarté cesse de tenir la place", () => {
  it("A accepte, B est affecté : la mission de A passe de « acceptee » à « retiree »", async () => {
    const r = await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: B });
    expect("data" in r, "l'affectation de B a échoué").toBe(true);

    const missionDeA = store.missions.find((m) => m.trainerId === A);
    expect(
      missionDeA?.statut,
      "la mission de A survit en « acceptee » : elle affirme que la place est tenue alors " +
        "que son affectation vient d'être supprimée",
    ).toBe("retiree");
  });

  it("la mission du NOUVEAU formateur n'est pas emportée au passage", async () => {
    // La garde du `saufTrainerId` : élargir le `statut` sans elle retirerait
    // l'accord de celui qu'on vient d'affecter.
    store.missions.push({
      id: "m-B",
      sessionId: SESSION_ID,
      trainerId: B,
      role: "principal",
      statut: "acceptee",
    });
    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: B });
    expect(store.missions.find((m) => m.trainerId === B)?.statut).toBe("acceptee");
  });

  /**
   * LA CONSÉQUENCE, mesurée sur le prédicat que les règles emploient RÉELLEMENT.
   *
   * `regleMissionFormateurSansReponseDelai` et `regleMissionFormateurExpiree`
   * sélectionnent `missionsFormateur: { where: { statut: "acceptee" } }` puis
   * font `continue` dès qu'il en reste une. Le fantôme de A les faisait taire
   * toutes les deux.
   */
  it("après le remplacement, plus AUCUNE mission « acceptee » ne fait taire les alertes", async () => {
    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: B });
    // B, sous-traitant, n'a jamais répondu : le cron a passé sa mission en
    // `sans_reponse` et libéré la session.
    store.missions.push({
      id: "m-B",
      sessionId: SESSION_ID,
      trainerId: B,
      role: "principal",
      statut: "sans_reponse",
    });
    store.formateurPrincipalId = null;

    const accepteesRestantes = store.missions.filter((m) => m.statut === "acceptee");
    expect(
      accepteesRestantes,
      "une mission « acceptee » subsiste : les deux règles feront `continue` et la session " +
        "partira sans personne, en silence",
    ).toHaveLength(0);
  });

  it("le prédicat testé est bien celui du moteur d'alertes — dérivé, pas recopié", () => {
    // Si le moteur change sa forme de sélection, ce témoin doit le dire plutôt
    // que de rester vert sur une condition qui n'existe plus.
    const evaluateur = lire("src/server/qualiopi/alertes/evaluateur.ts");
    expect(
      evaluateur,
      'le moteur d\'alertes ne sélectionne plus `missionsFormateur` sur `statut: "acceptee"` : ' +
        "le prédicat mesuré ici n'est plus le sien",
    ).toMatch(/missionsFormateur:\s*\{\s*where:\s*\{\s*statut:\s*"acceptee"\s*\}/);
  });
});

describe("🔴 D6 — le remplacement n'efface plus la trace de l'ancien formateur", () => {
  it("le tarif snapshoté, la date d'affectation et la convocation déjà partie sont ARCHIVÉS", async () => {
    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: B });

    expect(
      store.archives,
      "aucune archive écrite : le tarif de A, sa date d'affectation et sa convocation " +
        "ont disparu avec sa ligne",
    ).toHaveLength(1);
    expect(store.archives[0]).toMatchObject({
      sessionId: SESSION_ID,
      trainerId: A,
      role: "principal",
      tarifHtCents: 75000,
      convocationJ7EnvoyeeAt: CONVOQUE_A_LE,
      affecteAt: AFFECTE_A_LE,
      motifRetrait: "remplacement",
      retireById: "admin-uuid",
    });
  });

  it("retirer SANS remplaçant est archivé comme une désaffectation, pas comme un remplacement", async () => {
    // Deux faits distincts : un auditeur ne lit pas « remplacé » comme
    // « retiré et personne derrière ».
    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: null });
    expect(store.archives[0]).toMatchObject({ trainerId: A, motifRetrait: "desaffectation" });
  });

  it("l'archive est écrite APRÈS la suppression, jamais avant", async () => {
    // Archiver d'abord écrirait un retrait qui n'a peut-être pas eu lieu : une
    // archive qui ment est pire qu'une archive absente.
    const ordre: string[] = [];
    prismaMock.sessionFormateur.deleteMany.mockImplementationOnce(async () => {
      ordre.push("suppression");
      store.affectations = [];
      return { count: 1 };
    });
    prismaMock.sessionFormateurRetire.createMany.mockImplementationOnce(async () => {
      ordre.push("archive");
      return { count: 1 };
    });
    await assignTrainerToSessionAction({ sessionId: SESSION_ID, trainerId: B });
    expect(ordre).toEqual(["suppression", "archive"]);
  });
});

describe("🔴 D1, seconde moitié — affecté n'est pas confirmé", () => {
  it("un sous-traitant affecté qui n'a rien accepté ne tient PAS la place", () => {
    // C'est l'état exact de B à la fin de la séquence : `formateurPrincipalId`
    // n'est pas nul, et pourtant personne n'a dit oui.
    expect(
      affectationConfirmee({ statutFormateur: "sous_traitant", missionAcceptee: false }),
      "un principal affecté mais muet est compté comme une place tenue : c'est ce qui " +
        "éteint les alertes de désistement",
    ).toBe(false);
  });

  it("un salarié ou un dirigeant tient la place SANS mission — on ne leur en crée aucune", () => {
    // Exiger une mission acceptée d'eux ferait crier pour toujours :
    // `proposerMissionFormateur` ne leur crée aucune sollicitation.
    expect(affectationConfirmee({ statutFormateur: "salarie", missionAcceptee: false })).toBe(true);
    expect(affectationConfirmee({ statutFormateur: "dirigeant", missionAcceptee: false })).toBe(
      true,
    );
  });

  it("personne d'affecté ne tient aucune place", () => {
    expect(affectationConfirmee({ statutFormateur: null, missionAcceptee: true })).toBe(false);
  });

  it("un sous-traitant qui a accepté tient la place", () => {
    expect(affectationConfirmee({ statutFormateur: "sous_traitant", missionAcceptee: true })).toBe(
      true,
    );
  });
});
