/**
 * Alerte `fonds_opco_suspendus_session` (lot OPCO A7c, manque n°8) : session à
 * venir dont l'entreprise relève d'un OPCO / IDCC / effectif SUSPENDU dans
 * `EtatFondsOpco` (même résolution que le bandeau), ou qui commence après la
 * date limite d'engagement de l'année sans dépôt saisi à temps.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSessions, mockReleves } = vi.hoisted(() => ({
  mockSessions: vi.fn(),
  mockReleves: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: mockSessions },
    etatFondsOpco: { findMany: mockReleves },
  },
}));

import {
  candidatsFondsOpcoSuspendusSession,
  regleFondsOpcoSuspendusSession,
} from "./regle-fonds-opco-suspendus-session";
import type { SessionOpcoAVenir } from "./sessions-opco-a-venir";
import type { ReleveEtatFonds } from "@/server/qualiopi/financements/etat-fonds-opco";
import { ALERTE_CATALOGUE } from "./catalogue";
import { guichetPourCode } from "./routage";

const J = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`); // colonne @db.Date
const NOW = J("2026-10-04");

const session = (s: Partial<SessionOpcoAVenir> = {}): SessionOpcoAVenir => ({
  id: "s-1",
  numero: "AXI-SES-201",
  dateDebut: J("2026-11-10"),
  client: {
    id: "c-1",
    type: "entreprise",
    opco: "akto",
    opcoIdentifie: null,
    idcc: "1516",
    effectif: 12,
  },
  dossiersFinancement: [],
  ...s,
});

const releve = (r: Partial<ReleveEtatFonds> = {}): ReleveEtatFonds => ({
  id: "r-1",
  opco: "akto",
  idcc: "1516",
  statut: "suspendu",
  perimetre: null,
  effectifMaxExclu: null,
  dateLimiteDepot: null,
  sourceUrl: "https://www.akto.fr/",
  releveLe: D("2026-09-20"),
  note: null,
  createdAt: D("2026-09-20"),
  ...r,
});

describe("candidatsFondsOpcoSuspendusSession — suspension", () => {
  it("lève : la branche (OPCO × IDCC) de l'entreprise est suspendue", () => {
    const [a] = candidatsFondsOpcoSuspendusSession([session()], [releve()], NOW);
    expect(a?.code).toBe("fonds_opco_suspendus_session");
    expect(a?.niveau).toBe("critique");
    expect(a?.cibleType).toBe("TrainingSession");
    expect(a?.cibleId).toBe("s-1");
    expect(a?.message).toContain("AXI-SES-201");
    expect(a?.message).toContain("Akto");
    expect(a?.message).toContain("20/09/2026");
  });

  it("lit l'OPCO par la règle unique : un client qui n'a que l'ancien texte libre est vu", () => {
    const ancien = session({
      client: { ...session().client!, opco: null, opcoIdentifie: "akto" },
    });
    expect(candidatsFondsOpcoSuspendusSession([ancien], [releve()], NOW)).toHaveLength(1);
  });

  it("ne lève pas : suspension « moins de 50 salariés » et entreprise de 80 salariés", () => {
    const grande = session({ client: { ...session().client!, effectif: 80 } });
    const r = releve({ effectifMaxExclu: 50, perimetre: "moins de 50 salariés" });
    expect(candidatsFondsOpcoSuspendusSession([grande], [r], NOW)).toEqual([]);
  });

  it("ne lève pas : autre branche suspendue, ou fonds ouverts", () => {
    expect(
      candidatsFondsOpcoSuspendusSession([session()], [releve({ idcc: "0573" })], NOW),
    ).toEqual([]);
    expect(
      candidatsFondsOpcoSuspendusSession([session()], [releve({ statut: "ouvert" })], NOW),
    ).toEqual([]);
  });

  it("se résout : un relevé plus récent rouvre la branche", () => {
    const reouvert = releve({
      id: "r-2",
      statut: "ouvert",
      releveLe: D("2026-10-01"),
      createdAt: D("2026-10-01"),
    });
    expect(candidatsFondsOpcoSuspendusSession([session()], [releve()], NOW)).toHaveLength(1);
    expect(candidatsFondsOpcoSuspendusSession([session()], [releve(), reouvert], NOW)).toEqual([]);
  });

  it("client particulier ou sans OPCO reconnu : jamais alerté ici", () => {
    const particulier = session({ client: { ...session().client!, type: "particulier" } });
    const sansOpco = session({ client: { ...session().client!, opco: null } });
    expect(candidatsFondsOpcoSuspendusSession([particulier, sansOpco], [releve()], NOW)).toEqual(
      [],
    );
  });
});

describe("candidatsFondsOpcoSuspendusSession — date limite d'engagement de l'année", () => {
  const ouvertAvecLimite = releve({
    idcc: null,
    statut: "ouvert",
    dateLimiteDepot: D("2026-11-30"),
  });

  it("lève : la session commence après la date limite relevée, sans dépôt saisi", () => {
    const tardive = session({ dateDebut: J("2026-12-07") });
    const [a] = candidatsFondsOpcoSuspendusSession([tardive], [ouvertAvecLimite], NOW);
    expect(a?.code).toBe("fonds_opco_suspendus_session");
    expect(a?.niveau).toBe("important");
    expect(a?.message).toContain("30/11/2026");
    expect(a?.message).toContain("07/12/2026");
  });

  it("à défaut de relevé, lit la date limite annuelle du référentiel (Atlas : 31/12/2026)", () => {
    // Le 31/12 compte encore : seul un début en 2027 dépasserait, et c'est une autre année.
    const atlas = session({
      dateDebut: J("2026-12-31"),
      client: { ...session().client!, opco: "atlas" },
    });
    expect(candidatsFondsOpcoSuspendusSession([atlas], [], NOW)).toEqual([]);
  });

  it("🕐 fuseau de Paris : le jour du début se lit à Paris, pas en UTC", () => {
    // Paris est à UTC+1 en novembre : 22:30Z = 30/11 23 h 30 à Paris (le jour limite
    // compte encore) ; 23:30Z = 1/12 0 h 30 à Paris, alors que l'UTC dit encore le 30/11.
    const finDeJour = session({ dateDebut: new Date("2026-11-30T22:30:00.000Z") });
    expect(candidatsFondsOpcoSuspendusSession([finDeJour], [ouvertAvecLimite], NOW)).toEqual([]);
    const lendemainParis = session({ dateDebut: new Date("2026-11-30T23:30:00.000Z") });
    expect(
      candidatsFondsOpcoSuspendusSession([lendemainParis], [ouvertAvecLimite], NOW),
    ).toHaveLength(1);
  });

  it("ne lève pas : dépôt saisi au plus tard à la date limite", () => {
    const deposee = session({
      dateDebut: J("2026-12-07"),
      dossiersFinancement: [{ depotFaitLe: D("2026-11-20") }],
    });
    expect(candidatsFondsOpcoSuspendusSession([deposee], [ouvertAvecLimite], NOW)).toEqual([]);
  });

  it("ne lève pas : début l'année suivante (autre exercice)", () => {
    const janvier = session({ dateDebut: J("2027-01-12") });
    expect(candidatsFondsOpcoSuspendusSession([janvier], [ouvertAvecLimite], NOW)).toEqual([]);
  });
});

describe("regleFondsOpcoSuspendusSession — requête", () => {
  beforeEach(() => {
    mockSessions.mockReset();
    mockReleves.mockReset();
  });

  it("lit les sessions planifiées à 60 jours et les relevés des seuls OPCO concernés", async () => {
    mockSessions.mockResolvedValue([session()]);
    mockReleves.mockResolvedValue([releve()]);
    const alertes = await regleFondsOpcoSuspendusSession(NOW);
    expect(alertes).toHaveLength(1);
    const where = mockSessions.mock.calls[0]?.[0]?.where;
    expect(where.statut).toBe("planifiee");
    expect(where.dateDebut.lte.getTime() - NOW.getTime()).toBe(60 * 86_400_000);
    expect(mockSessions.mock.calls[0]?.[0]?.select.client.select).toMatchObject({
      opco: true,
      opcoIdentifie: true,
    });
    expect(mockReleves.mock.calls[0]?.[0]?.where).toEqual({ opco: { in: ["akto"] } });
  });

  it("aucune session : aucun relevé lu", async () => {
    mockSessions.mockResolvedValue([]);
    expect(await regleFondsOpcoSuspendusSession(NOW)).toEqual([]);
    expect(mockReleves).not.toHaveBeenCalled();
  });

  it("une panne de lecture LÈVE (la résolution automatique est alors suspendue)", async () => {
    mockSessions.mockResolvedValue([session()]);
    mockReleves.mockRejectedValue(new Error("db down"));
    await expect(regleFondsOpcoSuspendusSession(NOW)).rejects.toThrow("db down");
  });

  it("au catalogue : guichet direction, résolution automatique", () => {
    expect(ALERTE_CATALOGUE["fonds_opco_suspendus_session"]?.resolutionAuto).toBe(true);
    expect(guichetPourCode("fonds_opco_suspendus_session")).toBe("direction");
  });
});
