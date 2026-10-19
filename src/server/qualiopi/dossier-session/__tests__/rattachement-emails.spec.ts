/**
 * Chantier QNC, lot P9 — `rattacherEnvoisAUneSession`, un cas par `entityType` connu.
 * Fonction pure au-dessus de lectures Prisma simulées : aucune base.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  questionnaire: { findMany: vi.fn() },
  documentGenere: { findMany: vi.fn() },
  sessionFormateur: { findMany: vi.fn() },
  missionFormateur: { findMany: vi.fn() },
  enrollment: { findMany: vi.fn() },
  trainingSession: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { rattacherEnvoisAUneSession } from "../rattachement-emails";

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SESSION = u(1);
const INSCRIPTION = u(2);
const QUESTIONNAIRE = u(3);
const PIECE = u(4);
const AFFECTATION = u(5);
const MISSION = u(6);

const envoi = (id: string, entityType: string | null, entityId: string | null) => ({
  id,
  template: "qualiopi-test",
  entityType,
  entityId,
});

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
  prismaMock.questionnaire.findMany.mockResolvedValue([
    { id: QUESTIONNAIRE, enrollmentId: INSCRIPTION },
  ]);
  prismaMock.documentGenere.findMany.mockResolvedValue([
    { id: PIECE, sessionId: SESSION, type: "convention" },
  ]);
  prismaMock.sessionFormateur.findMany.mockResolvedValue([{ id: AFFECTATION, sessionId: SESSION }]);
  prismaMock.missionFormateur.findMany.mockResolvedValue([{ id: MISSION, sessionId: SESSION }]);
  prismaMock.enrollment.findMany.mockResolvedValue([
    { id: INSCRIPTION, sessionId: SESSION, estTestInterne: false },
  ]);
  prismaMock.trainingSession.findMany.mockResolvedValue([{ id: SESSION, estTestInterne: false }]);
});

describe("rattacherEnvoisAUneSession", () => {
  it.each([
    ["TrainingSession", SESSION],
    ["Enrollment", INSCRIPTION],
    ["Questionnaire", QUESTIONNAIRE],
    ["DocumentGenere", PIECE],
    ["SessionFormateur", AFFECTATION],
    ["MissionFormateur", MISSION],
  ])("%s se rattache à sa session", async (type, id) => {
    const r = await rattacherEnvoisAUneSession([envoi("e1", type, id)]);
    expect(r.get("e1")).toMatchObject({ sessionId: SESSION, essai: false });
  });

  it("un entityType inconnu (PortailAcces, Trainee…) ne se rattache à rien", async () => {
    const r = await rattacherEnvoisAUneSession([
      envoi("e1", "PortailAcces", u(9)),
      envoi("e2", "Trainee", u(9)),
    ]);
    expect(r.size).toBe(0);
  });

  it("sans entité (null) ou avec un identifiant mal formé : non rattaché", async () => {
    const r = await rattacherEnvoisAUneSession([
      envoi("e1", null, null),
      envoi("e2", "Enrollment", null),
      envoi("e3", "Enrollment", "pas-un-uuid"),
    ]);
    expect(r.size).toBe(0);
  });

  it("une session inconnue de la base n'est pas un rattachement", async () => {
    prismaMock.trainingSession.findMany.mockResolvedValue([]);
    const r = await rattacherEnvoisAUneSession([envoi("e1", "TrainingSession", SESSION)]);
    expect(r.size).toBe(0);
  });

  it("une inscription du banc d'essai marque l'envoi `essai`", async () => {
    prismaMock.enrollment.findMany.mockResolvedValue([
      { id: INSCRIPTION, sessionId: SESSION, estTestInterne: true },
    ]);
    const r = await rattacherEnvoisAUneSession([envoi("e1", "Enrollment", INSCRIPTION)]);
    expect(r.get("e1")?.essai).toBe(true);
  });

  it("une lecture qui échoue rend « non rattaché », sans lever", async () => {
    prismaMock.trainingSession.findMany.mockRejectedValue(new Error("db"));
    const r = await rattacherEnvoisAUneSession([envoi("e1", "TrainingSession", SESSION)]);
    expect(r.size).toBe(0);
  });

  it("liste vide, ou base stub du build : aucune lecture", async () => {
    expect((await rattacherEnvoisAUneSession([])).size).toBe(0);
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const r = await rattacherEnvoisAUneSession([envoi("e1", "TrainingSession", SESSION)]);
    expect(r.size).toBe(0);
    expect(prismaMock.trainingSession.findMany).not.toHaveBeenCalled();
  });
});
