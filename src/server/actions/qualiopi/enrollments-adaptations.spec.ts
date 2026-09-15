/**
 * Indicateur 10 — consigner la RÉPONSE de l'organisme ferme les alertes.
 *
 * Avant : `besoin_adaptation_declare` se fermait à la main, et rien ne gardait
 * ce qui avait été répondu. Cas réel : fermée après échange, inscription vide,
 * aucune trace. La fermeture suit désormais la consignation — et elle seule.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const enrollmentUpdate = vi.fn();
const enrollmentFindUnique = vi.fn();
const enrollmentFindMany = vi.fn();
const alerteUpdateMany = vi.fn();
const journalFindMany = vi.fn();
const logActivity = vi.fn(async (_i: unknown) => undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    enrollment: {
      update: (a: unknown) => enrollmentUpdate(a),
      findUnique: (a: unknown) => enrollmentFindUnique(a),
      findMany: (a: unknown) => enrollmentFindMany(a),
    },
    alerteSysteme: { updateMany: (a: unknown) => alerteUpdateMany(a) },
    activityLog: { findMany: (a: unknown) => journalFindMany(a) },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "admin-1", role: "super_admin" })),
  logQualiopiActivity: (i: unknown) => logActivity(i),
}));
vi.mock("@/server/qualiopi/satisfaction/satisfaction-service", () => ({
  creerQuestionnaire: vi.fn(),
}));

import { setEnrollmentAdaptationsAction } from "./enrollments";
import { REPONSE_AUCUNE_ADAPTATION } from "@/server/qualiopi/adaptation/reponse-organisme";

const ENR = "11111111-2222-4333-8444-555555555555";
const TRAINEE = "99999999-2222-4333-8444-555555555555";

function codesFermes(): Array<{ code: unknown; cibleId: unknown }> {
  return alerteUpdateMany.mock.calls.map((c) => {
    const where = (c[0] as { where: Record<string, unknown> }).where;
    return { code: where["code"], cibleId: where["cibleId"] };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  enrollmentUpdate.mockResolvedValue({ traineeId: TRAINEE });
  enrollmentFindUnique.mockResolvedValue({ adaptationsRealisees: null });
  enrollmentFindMany.mockResolvedValue([]);
  alerteUpdateMany.mockResolvedValue({ count: 1 });
  journalFindMany.mockResolvedValue([]);
});

describe("setEnrollmentAdaptationsAction — la réponse ferme les alertes", () => {
  it("🔴 « aucune adaptation nécessaire » : libellé écrit par le serveur, alertes fermées", async () => {
    const r = await setEnrollmentAdaptationsAction({
      id: ENR,
      adaptationsRealisees: "texte ignoré",
      aucuneAdaptationNecessaire: true,
    });
    expect(r).toEqual({ data: { id: ENR } });
    expect(enrollmentUpdate.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ENR },
      data: { adaptationsRealisees: REPONSE_AUCUNE_ADAPTATION },
    });
    expect(codesFermes()).toEqual([
      { code: "adaptation_reponse_non_consignee", cibleId: ENR },
      { code: "besoin_adaptation_declare", cibleId: TRAINEE },
    ]);
  });

  it("🔑 le journal DATE la réponse, sans jamais en recopier le texte", async () => {
    await setEnrollmentAdaptationsAction({ id: ENR, adaptationsRealisees: "Supports agrandis" });
    expect(logActivity).toHaveBeenCalledOnce();
    const trace = logActivity.mock.calls[0]?.[0] as { action: string; changes: object };
    expect(trace.action).toBe("qualiopi.enrollment.adaptations");
    expect(trace.changes).toMatchObject({ adaptationsRenseignees: true, reponse: "adaptation" });
    expect(JSON.stringify(trace)).not.toContain("agrandis");
  });

  it("l'alerte du geste reste ouverte tant qu'une AUTRE inscription de la personne attend sa réponse", async () => {
    enrollmentFindMany.mockResolvedValue([
      {
        id: "enr-autre",
        adaptationsRealisees: null,
        session: { dateFin: new Date("2026-10-20T16:00:00.000Z") },
        trainee: { situationHandicap: false },
        questionnaires: [
          { reponses: { besoinAdaptation: true }, reponduAt: new Date("2026-09-01T08:00:00.000Z") },
        ],
      },
    ]);
    await setEnrollmentAdaptationsAction({
      id: ENR,
      adaptationsRealisees: "Salle au rez-de-chaussée",
    });
    expect(codesFermes()).toEqual([{ code: "adaptation_reponse_non_consignee", cibleId: ENR }]);
    const where = (enrollmentFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where).toMatchObject({ traineeId: TRAINEE, id: { not: ENR } });
    // 🔴 Relecture #1095 — pas de filtre sur la colonne : une réponse antérieure à
    // une nouvelle déclaration attend, elle aussi, sa réponse.
    expect(where).not.toHaveProperty("adaptationsRealisees");
  });

  it("🔴 l'alerte du geste reste ouverte si une AUTRE inscription porte une réponse ANTÉRIEURE à une nouvelle déclaration", async () => {
    enrollmentFindMany.mockResolvedValue([
      {
        id: "enr-autre",
        adaptationsRealisees: REPONSE_AUCUNE_ADAPTATION,
        session: { dateFin: new Date("2026-10-20T16:00:00.000Z") },
        trainee: { situationHandicap: true },
        questionnaires: [],
      },
    ]);
    journalFindMany.mockImplementation(async (a: { where: { action: string } }) =>
      a.where.action === "qualiopi.enrollment.adaptations"
        ? [
            {
              targetId: "enr-autre",
              createdAt: new Date("2026-09-02T08:00:00.000Z"),
              changes: { adaptationsRenseignees: true },
            },
          ]
        : [{ targetId: TRAINEE, createdAt: new Date("2026-09-10T08:00:00.000Z") }],
    );
    await setEnrollmentAdaptationsAction({ id: ENR, adaptationsRealisees: "Sous-titrage" });
    expect(codesFermes()).toEqual([{ code: "adaptation_reponse_non_consignee", cibleId: ENR }]);

    // Contre-épreuve : la même inscription, réponse POSTÉRIEURE à la déclaration
    // → elle est couverte, et l'alerte du geste se ferme.
    alerteUpdateMany.mockClear();
    journalFindMany.mockImplementation(async (a: { where: { action: string } }) =>
      a.where.action === "qualiopi.enrollment.adaptations"
        ? [
            {
              targetId: "enr-autre",
              createdAt: new Date("2026-09-12T08:00:00.000Z"),
              changes: { adaptationsRenseignees: true },
            },
          ]
        : [{ targetId: TRAINEE, createdAt: new Date("2026-09-10T08:00:00.000Z") }],
    );
    await setEnrollmentAdaptationsAction({ id: ENR, adaptationsRealisees: "Sous-titrage" });
    expect(codesFermes()).toEqual([
      { code: "adaptation_reponse_non_consignee", cibleId: ENR },
      { code: "besoin_adaptation_declare", cibleId: TRAINEE },
    ]);
  });

  it("effacer la réponse ne ferme rien — et le journal le dit", async () => {
    await setEnrollmentAdaptationsAction({ id: ENR, adaptationsRealisees: "" });
    expect(alerteUpdateMany).not.toHaveBeenCalled();
    const trace = logActivity.mock.calls[0]?.[0] as { changes: object };
    expect(trace.changes).toMatchObject({ adaptationsRenseignees: false, reponse: "effacee" });
  });

  it("🔴 « aucune adaptation » ne remplace JAMAIS une adaptation déjà consignée", async () => {
    enrollmentFindUnique.mockResolvedValue({ adaptationsRealisees: "Supports agrandis" });
    const r = await setEnrollmentAdaptationsAction({
      id: ENR,
      adaptationsRealisees: "",
      aucuneAdaptationNecessaire: true,
    });
    expect("error" in r).toBe(true);
    expect(enrollmentUpdate).not.toHaveBeenCalled();
  });

  it("une panne de fermeture n'annule pas la réponse consignée", async () => {
    alerteUpdateMany.mockRejectedValueOnce(new Error("base indisponible"));
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await setEnrollmentAdaptationsAction({
      id: ENR,
      adaptationsRealisees: "Sous-titrage",
    });
    expect(r).toEqual({ data: { id: ENR } });
    expect(logActivity).toHaveBeenCalledOnce();
    erreur.mockRestore();
  });
});
