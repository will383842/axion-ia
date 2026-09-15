/**
 * Règle balayée « besoin d'adaptation déclaré, réponse non consignée » (ind. 10).
 *
 * Cas réel : l'alerte du geste a été fermée à la main après échange, la fiche
 * décochée, l'inscription laissée vide — et plus aucun signal nulle part.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const enrollmentFindMany = vi.fn();
const alerteFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: { findMany: (a: unknown) => enrollmentFindMany(a) },
    alerteSysteme: { findMany: (a: unknown) => alerteFindMany(a) },
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
}) {
  return {
    id: over.id ?? "enr-1",
    trainee: {
      id: over.traineeId ?? "tr-1",
      prenom: "Alice",
      nom: "Test",
      situationHandicap: over.situationHandicap ?? false,
    },
    session: { numero: "AXI-SESS-TEST", dateDebut: new Date("2026-09-05T07:00:00.000Z") },
    questionnaires: (over.reponses ?? []).map((reponses) => ({ reponses })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  alerteFindMany.mockResolvedValue([]);
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

  it("la requête ne retient que les inscriptions SANS réponse, actives, sur une session tenue et récente", async () => {
    enrollmentFindMany.mockResolvedValue([]);
    await regleAdaptationReponseNonConsignee(MAINTENANT);
    const where = (enrollmentFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where["adaptationsRealisees"]).toBeNull();
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
});
