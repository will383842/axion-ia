/**
 * Règle balayée « besoin d'adaptation déclaré, réponse non consignée » (ind. 10).
 *
 * Cas réel : l'alerte du geste a été fermée à la main après échange, la fiche
 * décochée, l'inscription laissée vide — et plus aucun signal nulle part.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const enrollmentFindMany = vi.fn();
const alerteFindMany = vi.fn();
const journalFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findMany: (a: unknown) => enrollmentFindMany(a) },
    alerteSysteme: { findMany: (a: unknown) => alerteFindMany(a) },
    activityLog: { findMany: (a: unknown) => journalFindMany(a) },
  },
}));

// Mêmes doubles qu'`evaluateur.spec.ts` : ce sont eux qui rendent l'évaluateur
// importable sans monter la chaîne d'authentification.
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("@/server/qualiopi/financements/bareme-opco", () => ({ listBaremesEnVigueur: vi.fn() }));
vi.mock("@/server/qualiopi/trainers/documents", () => ({
  listTrainerDocuments: vi.fn(),
  cumulAnnuelFormateurCents: vi.fn(),
}));

import { regleAdaptationReponseNonConsignee } from "./regle-adaptation-reponse";
import { ALERTE_CATALOGUE } from "./catalogue";
import { evaluerAlertesDetaille } from "./evaluateur";

const MAINTENANT = new Date("2026-09-15T08:00:00.000Z");

function inscription(over: {
  id?: string;
  situationHandicap?: boolean;
  reponses?: unknown[];
  traineeId?: string;
  adaptationsRealisees?: string | null;
}) {
  return {
    id: over.id ?? "enr-1",
    adaptationsRealisees: over.adaptationsRealisees ?? null,
    trainee: {
      id: over.traineeId ?? "tr-1",
      prenom: "Alice",
      nom: "Test",
      situationHandicap: over.situationHandicap ?? false,
    },
    session: {
      numero: "AXI-SESS-TEST",
      dateDebut: new Date("2026-09-05T07:00:00.000Z"),
      dateFin: new Date("2026-09-20T16:00:00.000Z"),
    },
    questionnaires: (over.reponses ?? []).map((reponses) => ({
      reponses,
      reponduAt: new Date("2026-09-01T08:00:00.000Z"),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  alerteFindMany.mockResolvedValue([]);
  journalFindMany.mockResolvedValue([]);
});

describe("adaptation_reponse_non_consignee", () => {
  it("🔴 le cas réel : « oui » au positionnement, fiche décochée, rien consigné → l'alerte se lève", async () => {
    enrollmentFindMany.mockResolvedValue([inscription({ reponses: [{ besoinAdaptation: true }] })]);
    const alertes = await regleAdaptationReponseNonConsignee(MAINTENANT);
    expect(alertes).toHaveLength(1);
    expect(alertes[0]).toMatchObject({
      code: "adaptation_reponse_non_consignee",
      cibleType: "Enrollment",
      cibleId: "enr-1",
    });
    expect(alertes[0]?.message).toContain("Alice Test");
    expect(alertes[0]?.message).toContain("aucune adaptation");
  });

  it("la requête lit les inscriptions actives, sur une session tenue et récente, réponse consignée OU non", async () => {
    enrollmentFindMany.mockResolvedValue([]);
    await regleAdaptationReponseNonConsignee(MAINTENANT);
    const where = (enrollmentFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    // 🔴 Relecture #1095 — PAS de filtre `adaptationsRealisees: null` : une réponse
    // consignée AVANT une nouvelle déclaration doit rester visible du balayage.
    expect(where).not.toHaveProperty("adaptationsRealisees");
    expect(JSON.stringify(where["statut"])).toContain("abandon");
    expect(JSON.stringify(where["session"])).toContain("annulee");
    expect(JSON.stringify(where["session"])).toContain("dateFin");
    expect(JSON.stringify(where)).toContain("besoinAdaptation");
    // Le détail chiffré n'est jamais chargé.
    expect(JSON.stringify(enrollmentFindMany.mock.calls[0]?.[0])).not.toContain("handicapDetails");
  });

  it("une saisie par l'organisme portant le booléen ne déclare rien", async () => {
    enrollmentFindMany.mockResolvedValue([
      inscription({ reponses: [{ saisie_admin: true, besoinAdaptation: true }] }),
    ]);
    expect(await regleAdaptationReponseNonConsignee(MAINTENANT)).toEqual([]);
  });

  it("🔑 une seule alerte par besoin : tant que l'alerte du GESTE est ouverte, la règle s'abstient", async () => {
    enrollmentFindMany.mockResolvedValue([
      inscription({ id: "enr-1", traineeId: "tr-1", situationHandicap: true }),
      inscription({ id: "enr-2", traineeId: "tr-2", situationHandicap: true }),
    ]);
    alerteFindMany.mockResolvedValue([{ cibleId: "tr-1" }]);
    const alertes = await regleAdaptationReponseNonConsignee(MAINTENANT);
    expect(alertes.map((a) => a.cibleId)).toEqual(["enr-2"]);
    const where = (alerteFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ code: "besoin_adaptation_declare", resolue: false });
  });

  it("🔴 se referme d'elle-même : entrée du catalogue en résolution automatique", () => {
    // `synchroniserAlertes` ne referme que les codes `resolutionAuto: true` du
    // catalogue ; sans cette entrée, l'alerte resterait ouverte après consignation.
    expect(ALERTE_CATALOGUE["adaptation_reponse_non_consignee"]?.resolutionAuto).toBe(true);
    expect(ALERTE_CATALOGUE["adaptation_reponse_non_consignee"]?.guichet).toBe("qualite");
  });

  it("est inscrite au balayage — une règle écrite mais jamais appelée ne garde rien", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test");
    enrollmentFindMany.mockResolvedValue([inscription({ reponses: [{ besoinAdaptation: true }] })]);
    const { candidates } = await evaluerAlertesDetaille();
    expect(candidates.some((c) => c.code === "adaptation_reponse_non_consignee")).toBe(true);
    vi.unstubAllEnvs();
  });

  describe("🔴 relecture #1095 — une réponse antérieure à une NOUVELLE déclaration ne couvre rien", () => {
    const REPONSE = "Échange avec le bénéficiaire : aucune adaptation nécessaire.";

    function journal(consigneeLe: string, declareLe: string | null) {
      journalFindMany.mockImplementation(async (a: { where: { action: string } }) => {
        if (a.where.action === "qualiopi.enrollment.adaptations") {
          return [
            {
              targetId: "enr-1",
              createdAt: new Date(consigneeLe),
              changes: { adaptationsRenseignees: true },
            },
          ];
        }
        return declareLe === null ? [] : [{ targetId: "tr-1", createdAt: new Date(declareLe) }];
      });
    }

    it("déclaration postérieure à la réponse → l'alerte se lève, et le dit — sans rien de la réponse", async () => {
      enrollmentFindMany.mockResolvedValue([
        inscription({ situationHandicap: true, adaptationsRealisees: "Supports agrandis" }),
      ]);
      journal("2026-09-02T08:00:00.000Z", "2026-09-10T08:00:00.000Z");
      const alertes = await regleAdaptationReponseNonConsignee(MAINTENANT);
      expect(alertes.map((a) => a.cibleId)).toEqual(["enr-1"]);
      expect(alertes[0]?.message).toContain("APRÈS la dernière réponse consignée");
      expect(alertes[0]?.message).not.toContain("agrandis");
    });

    it("déclaration antérieure à la réponse → rien", async () => {
      enrollmentFindMany.mockResolvedValue([
        inscription({ situationHandicap: true, adaptationsRealisees: REPONSE }),
      ]);
      journal("2026-09-10T08:00:00.000Z", "2026-09-02T08:00:00.000Z");
      expect(await regleAdaptationReponseNonConsignee(MAINTENANT)).toEqual([]);
    });

    it("la déclaration du journal ne vise que la PERSONNE, jamais le détail", async () => {
      enrollmentFindMany.mockResolvedValue([
        inscription({ situationHandicap: true, adaptationsRealisees: REPONSE }),
      ]);
      journal("2026-09-02T08:00:00.000Z", "2026-09-10T08:00:00.000Z");
      await regleAdaptationReponseNonConsignee(MAINTENANT);
      const wheres = journalFindMany.mock.calls.map((c) => (c[0] as { where: unknown }).where);
      expect(wheres).toContainEqual(
        expect.objectContaining({
          action: "qualiopi.trainee.besoin_adaptation.declare",
          targetType: "Trainee",
          targetId: { in: ["tr-1"] },
        }),
      );
    });
  });
});
