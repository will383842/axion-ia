/**
 * `lancerRapportAvantAudit` : garde super_admin, interrupteur éteint par défaut, refus sans
 * réponse, et AUCUNE écriture (ni sur `clients`, ni sur la table) quand une garde refuse.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  acces: vi.fn(),
  enqueue: vi.fn(),
  log: vi.fn(),
  clientFindUnique: vi.fn(),
  clientUpdate: vi.fn(),
  questionnaires: vi.fn(),
  reponses: vi.fn(),
  enVol: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/features/dossier-client/acces", () => ({ exigerAccesEchanges: m.acces }));
vi.mock("@/server/queue/queues", () => ({ enqueueRapportAvantAudit: m.enqueue }));
vi.mock("../../questionnaire-preaudit/de-la-fiche", () => ({
  fichesCouvertes: async (id: string) => [id],
  questionnairesDesFiches: (ids: string[]) => ({ clientId: { in: ids } }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: m.clientFindUnique,
      update: m.clientUpdate,
      updateMany: m.clientUpdate,
    },
    questionnaireAvantAudit: { findMany: m.questionnaires },
    questionnaireAvantAuditEnvoi: { count: m.reponses },
    rapportAvantAudit: { count: m.enVol, create: m.create, updateMany: m.updateMany },
    activityLog: { create: m.log },
  },
}));

import { lancerRapportAvantAudit } from "../actions";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const ENV0 = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ENV0, RAPPORT_AVANT_AUDIT_ENABLED: "true" };
  m.acces.mockResolvedValue({ userId: "u-will", role: "super_admin" });
  m.clientFindUnique.mockResolvedValue({ id: CLIENT });
  m.questionnaires.mockResolvedValue([{ id: "q1" }, { id: "q2" }]);
  m.reponses.mockResolvedValue(3);
  m.enVol.mockResolvedValue(0);
  m.create.mockResolvedValue({ id: "r1" });
  m.enqueue.mockResolvedValue(true);
});
afterEach(() => {
  process.env = { ...ENV0 };
});

function aucuneEcriture() {
  expect(m.create).not.toHaveBeenCalled();
  expect(m.updateMany).not.toHaveBeenCalled();
  expect(m.enqueue).not.toHaveBeenCalled();
  expect(m.clientUpdate).not.toHaveBeenCalled();
}

describe("lancerRapportAvantAudit — gardes", () => {
  it.each(["admin", "editor", "viewer"])(
    "refuse le rôle « %s » (super_admin seulement)",
    async (role) => {
      m.acces.mockResolvedValue({ userId: "u", role });
      const r = await lancerRapportAvantAudit(CLIENT);
      expect(r.ok).toBe(false);
      aucuneEcriture();
      expect(m.clientFindUnique).not.toHaveBeenCalled();
    },
  );

  it("refuse une session absente ou hors liste A2", async () => {
    m.acces.mockRejectedValue(new Error("Session expirée : reconnectez-vous."));
    const r = await lancerRapportAvantAudit(CLIENT);
    expect(r).toEqual({ ok: false, erreur: "Session expirée : reconnectez-vous." });
    aucuneEcriture();
  });

  it("interrupteur ÉTEINT PAR DÉFAUT : variable absente → refus, rien n'est écrit", async () => {
    delete process.env["RAPPORT_AVANT_AUDIT_ENABLED"];
    const r = await lancerRapportAvantAudit(CLIENT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/RAPPORT_AVANT_AUDIT_ENABLED/);
    aucuneEcriture();
    expect(m.clientFindUnique).not.toHaveBeenCalled();
  });

  it("interrupteur à une autre valeur que « true » → refus", async () => {
    process.env["RAPPORT_AVANT_AUDIT_ENABLED"] = "1";
    expect((await lancerRapportAvantAudit(CLIENT)).ok).toBe(false);
    aucuneEcriture();
  });

  it("refuse une fiche sans aucune réponse reçue", async () => {
    m.reponses.mockResolvedValue(0);
    const r = await lancerRapportAvantAudit(CLIENT);
    expect(r.ok).toBe(false);
    aucuneEcriture();
  });

  it("refuse une fiche sans questionnaire envoyé", async () => {
    m.questionnaires.mockResolvedValue([]);
    expect((await lancerRapportAvantAudit(CLIENT)).ok).toBe(false);
    aucuneEcriture();
  });

  it("refuse un second lancement tant qu'un autre est en préparation", async () => {
    m.enVol.mockResolvedValue(1);
    expect((await lancerRapportAvantAudit(CLIENT)).ok).toBe(false);
    aucuneEcriture();
  });

  it("refuse un identifiant de fiche invalide", async () => {
    expect((await lancerRapportAvantAudit("pas-un-uuid")).ok).toBe(false);
    aucuneEcriture();
  });
});

describe("lancerRapportAvantAudit — lancement", () => {
  it("crée UNE ligne neuve, met { rapportId } en file et journalise, sans toucher la fiche", async () => {
    const r = await lancerRapportAvantAudit(CLIENT);
    expect(r).toEqual({ ok: true, rapportId: "r1" });
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.create.mock.calls[0]![0].data).toMatchObject({
      clientId: CLIENT,
      questionnaireIds: ["q1", "q2"],
      statut: "en_attente",
      lanceParId: "u-will",
    });
    expect(m.enqueue).toHaveBeenCalledWith("r1");
    expect(m.log).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "u-will",
        action: "rapport-avant-audit.lancer",
        targetType: "RapportAvantAudit",
        targetId: "r1",
      }),
    });
    expect(m.clientUpdate).not.toHaveBeenCalled();
  });

  it("file indisponible : la ligne passe en erreur (lisible), le refus est dit", async () => {
    m.enqueue.mockResolvedValue(false);
    const r = await lancerRapportAvantAudit(CLIENT);
    expect(r.ok).toBe(false);
    expect(m.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: "erreur" }) }),
    );
  });

  it("double lancement SIMULTANÉ : l'index unique refuse le second, un seul rapport en file", async () => {
    // Les deux clics passent le comptage (0 en vol) ; la base refuse la seconde ligne (P2002).
    m.create
      .mockResolvedValueOnce({ id: "r1" })
      .mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }));
    const [a, b] = await Promise.all([
      lancerRapportAvantAudit(CLIENT),
      lancerRapportAvantAudit(CLIENT),
    ]);
    const oks = [a, b].filter((r) => r.ok);
    expect(oks).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toEqual({
      ok: false,
      erreur: "Un rapport est déjà en préparation pour cette fiche.",
    });
    expect(m.enqueue).toHaveBeenCalledTimes(1);
    expect(m.enqueue).toHaveBeenCalledWith("r1");
  });

  it("une autre erreur de base n'est pas maquillée en doublon", async () => {
    m.create.mockRejectedValueOnce(Object.assign(new Error("panne"), { code: "P1001" }));
    await expect(lancerRapportAvantAudit(CLIENT)).rejects.toThrow("panne");
  });
});

describe("index unique partiel (migration additive)", () => {
  it("un seul lancement en vol par fiche, sans rien supprimer", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20261102130000_rapports_avant_audit_un_en_vol/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "rapports_avant_audit_un_en_vol_par_client"\s+ON "rapports_avant_audit" \("client_id"\)\s+WHERE "statut" IN \('en_attente', 'en_cours'\)/,
    );
    const code = sql.replace(/^\s*--.*$/gm, "");
    expect(code).not.toMatch(/(DROP|DELETE|TRUNCATE|UPDATE)/i);
  });
});
