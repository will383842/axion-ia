/**
 * QNC L12 — le chargeur ne lit que du RÉEL, et un lot absent ne verdit jamais.
 * (Les prédicats sont couverts par `les-voyants-exigent-une-trace-reelle.spec.ts`.)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  sessions: vi.fn(),
  enrollments: vi.fn(),
  setting: vi.fn(),
  journal: vi.fn(),
  veilles: vi.fn(),
  partenariats: vi.fn(),
  sessionUnique: vi.fn(),
  appreciations: vi.fn(),
  siteSetting: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: h.sessions, findUnique: h.sessionUnique },
    enrollment: { findMany: h.enrollments },
    remiseRetour: { findMany: vi.fn().mockResolvedValue([]) },
    activityLog: { findFirst: vi.fn().mockResolvedValue(null), findMany: h.journal },
    setting: { findUnique: h.setting },
    veille: { findMany: h.veilles },
    questionnaireCadrage: { findMany: vi.fn().mockResolvedValue([]) },
    moyenPedagogique: { count: vi.fn().mockResolvedValue(0) },
    trainerHabilitation: { findFirst: vi.fn().mockResolvedValue(null) },
    sessionFormateur: { findMany: vi.fn().mockResolvedValue([]) },
    trainer: { findMany: vi.fn().mockResolvedValue([]) },
    verificationRegistreSousTraitance: { findMany: vi.fn().mockResolvedValue([]) },
    revueDirection: { count: vi.fn().mockResolvedValue(0) },
    partenariat: { count: h.partenariats },
    appreciation: { findMany: h.appreciations },
    bilanFinFormation: { findMany: vi.fn().mockResolvedValue([]) },
    siteSetting: { findUnique: h.siteSetting },
    $queryRaw: vi.fn().mockResolvedValue([{ existe: false }]),
  },
}));
vi.mock("../../config/site-settings", () => ({ getQualiopiConfig: async () => "" }));

import { chargerTracesVoyants } from "../charger-traces-voyants";
import { construireVoyants } from "../voyants-indicateurs";

const NOW = new Date("2026-12-01T07:00:00Z");

beforeEach(() => {
  h.sessions.mockReset().mockResolvedValue([]);
  h.enrollments.mockReset().mockResolvedValue([]);
  h.setting.mockReset().mockResolvedValue(null);
  h.journal.mockReset().mockResolvedValue([]);
  h.veilles.mockReset().mockResolvedValue([]);
  h.partenariats.mockReset().mockResolvedValue(0);
  h.sessionUnique.mockReset().mockResolvedValue({
    clientId: "c1",
    formateurPrincipalId: "t1",
    financementType: "direct",
    opcoSubrogation: false,
    opcoStatut: "non_demande",
    sessionFormateurs: [],
    jours: [],
  });
  h.appreciations.mockReset().mockResolvedValue([]);
  h.siteSetting.mockReset().mockResolvedValue(null);
});

const SESSION = {
  id: "s1",
  formationId: "f",
  modalite: "presentiel",
  dateDebut: new Date("2026-11-10T08:00:00Z"),
  dateFin: new Date("2026-11-12T17:00:00Z"),
  formateurPrincipalId: null,
  projetId: null,
  estTestInterne: false,
};

/** Allume un lot : `qualiopi.<lot>.actif` = { etat: "actif" }. */
function allumer(...lots: string[]): void {
  h.setting.mockImplementation(async ({ where }: { where: { key: string } }) =>
    lots.some((l) => where.key === `qualiopi.${l}.actif`) ? { value: { etat: "actif" } } : null,
  );
}

describe("chargerTracesVoyants", () => {
  it("n'interroge que les sessions réelles (essai exclu à la requête)", async () => {
    await chargerTracesVoyants(["e1"], NOW);
    expect(h.sessions.mock.calls[0]![0].where).toMatchObject({ estTestInterne: false });
  });

  it("une session d'essai n'a aucune entrée de trace : rien n'est lu pour elle", async () => {
    expect((await chargerTracesVoyants(["e1"], NOW)).size).toBe(0);
    expect(h.enrollments).not.toHaveBeenCalled();
  });

  it("les inscriptions lues excluent l'essai et les sortis", async () => {
    h.sessions.mockResolvedValue([
      {
        id: "s1",
        formationId: "f",
        modalite: "presentiel",
        dateDebut: NOW,
        dateFin: NOW,
        formateurPrincipalId: null,
        projetId: null,
        estTestInterne: false,
      },
    ]);
    await chargerTracesVoyants(["s1"], NOW);
    const where = h.enrollments.mock.calls[0]![0].where;
    expect(where).toMatchObject({ estTestInterne: false, session: { estTestInterne: false } });
    expect(where.statut).toEqual({ notIn: ["abandon", "exclu"] });
  });

  it("L04 (temps 2) et L09 (étapes de réclamation) ne sont pas sur main : jamais verts", async () => {
    h.sessions.mockResolvedValue([
      {
        id: "s1",
        formationId: "f",
        modalite: "presentiel",
        dateDebut: new Date("2026-11-10T08:00:00Z"),
        dateFin: new Date("2026-11-12T17:00:00Z"),
        formateurPrincipalId: null,
        projetId: null,
        estTestInterne: false,
      },
    ]);
    const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
    expect(t.i6).toEqual({ lecture: "lot_absent" });
    expect(t.i31).toEqual({ lecture: "lot_absent" });
    const vs = construireVoyants(t, {
      dateDebut: NOW,
      dateFin: NOW,
      estTestInterne: false,
      maintenant: NOW,
    });
    expect(vs.find((v) => v.indicateur === 6)!.etat).toBe("non_evalue");
    expect(vs.find((v) => v.indicateur === 31)!.etat).toBe("non_evalue");
  });

  it("lots éteints (interrupteur absent) : recueil et moyens « non évalués », jamais verts", async () => {
    h.sessions.mockResolvedValue([
      {
        id: "s1",
        formationId: "f",
        modalite: "presentiel",
        dateDebut: NOW,
        dateFin: NOW,
        formateurPrincipalId: null,
        projetId: null,
        estTestInterne: false,
      },
    ]);
    const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
    expect(t.i4).toEqual({ lecture: "lot_eteint" });
    expect(t.i17).toEqual({ lecture: "lot_eteint" });
  });

  it("ind. 19 : L08 éteint → « lot éteint » (non mesuré), jamais rouge ni vert", async () => {
    h.sessions.mockResolvedValue([SESSION]);
    const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
    expect(t.i19).toEqual({ lecture: "lot_eteint" });
    const vs = construireVoyants(t, {
      dateDebut: SESSION.dateDebut,
      dateFin: SESSION.dateFin,
      estTestInterne: false,
      maintenant: NOW,
    });
    expect(vs.find((v) => v.indicateur === 19)!.etat).toBe("non_evalue");
  });

  it("ind. 19 : L08 allumé → la lecture des remises a lieu", async () => {
    allumer("pedagogie");
    h.sessions.mockResolvedValue([SESSION]);
    const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
    expect(t.i19?.lecture).not.toBe("lot_eteint");
  });

  describe("ind. 23 : seule la veille LÉGALE compte", () => {
    const decision = {
      action: "qualiopi.veille.decision",
      targetId: "v-metiers",
      adminUserId: "u1",
      changes: { decision: "Retenue" },
      createdAt: new Date("2026-10-01T10:00:00Z"),
    };

    it("une décision sur une veille non légale ne met pas le 23 au vert", async () => {
      allumer("veille");
      h.sessions.mockResolvedValue([SESSION]);
      h.journal.mockResolvedValue([decision]);
      // La base ne connaît aucune veille légale parmi les décidées.
      h.veilles.mockResolvedValue([]);
      const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
      expect(h.veilles.mock.calls[0]![0].where).toMatchObject({ type: "legale" });
      expect(t.i23).toMatchObject({ lecture: "lue", derniereDecisionLe: null });
      const vs = construireVoyants(t, {
        dateDebut: SESSION.dateDebut,
        dateFin: SESSION.dateFin,
        estTestInterne: false,
        maintenant: NOW,
      });
      expect(vs.find((v) => v.indicateur === 23)!.etat).not.toBe("vert");
    });

    it("une décision sur une veille légale date la trace", async () => {
      allumer("veille");
      h.sessions.mockResolvedValue([SESSION]);
      h.journal.mockResolvedValue([{ ...decision, targetId: "v-legale" }]);
      h.veilles.mockResolvedValue([{ id: "v-legale" }]);
      const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
      expect(t.i23).toMatchObject({
        lecture: "lue",
        derniereDecisionLe: decision.createdAt,
      });
    });
  });

  it("ind. 26 : le réseau handicap se lit comme le moteur de conformité", async () => {
    h.sessions.mockResolvedValue([SESSION]);
    await chargerTracesVoyants(["s1"], NOW);
    expect(h.partenariats).toHaveBeenCalledWith({
      where: { type: "reseau_handicap", actif: true },
    });
  });

  describe("ind. 30 : les autres parties prenantes ne sont lues que derrière l'interrupteur des voyants", () => {
    it("interrupteur éteint : « autresParties » absent, comportement d'avant", async () => {
      h.sessions.mockResolvedValue([SESSION]);
      const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
      expect(t.i30).toMatchObject({ lecture: "lue" });
      expect(t.i30).not.toHaveProperty("autresParties");
      // Aucune lecture des autres parties (financement, formateurs) : seule la
      // lecture d'essai de l'interrupteur interroge la session.
      for (const [arg] of h.sessionUnique.mock.calls) {
        expect(arg.select).not.toHaveProperty("financementType");
      }
      expect(h.appreciations).not.toHaveBeenCalled();
    });

    it("interrupteur allumé : « autresParties » présent, financement direct = tiers « non »", async () => {
      allumer("voyants");
      h.sessions.mockResolvedValue([SESSION]);
      const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
      expect(t.i30).toMatchObject({
        lecture: "lue",
        autresParties: {
          entreprise: { sollicitee: null, avis: null },
          formateur: { attendus: 1, avis: null },
          financeur: { tiers: "non", avis: null },
        },
      });
    });

    it("subrogation OPCO sur la session : tiers « oui » (jamais « non »)", async () => {
      allumer("voyants");
      h.sessions.mockResolvedValue([SESSION]);
      h.sessionUnique.mockResolvedValue({
        clientId: "c1",
        formateurPrincipalId: "t1",
        financementType: "direct",
        opcoSubrogation: true,
        opcoStatut: "non_demande",
        sessionFormateurs: [],
        jours: [],
      });
      const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
      expect(t.i30).toMatchObject({ autresParties: { financeur: { tiers: "oui" } } });
    });

    it("lecture en échec : « illisible », jamais vert", async () => {
      allumer("voyants");
      h.sessions.mockResolvedValue([SESSION]);
      h.sessionUnique.mockRejectedValue(new Error("base indisponible"));
      const t = (await chargerTracesVoyants(["s1"], NOW)).get("s1")!;
      expect(t.i30).toEqual({ lecture: "illisible" });
    });

    it("les appréciations d'essai marquées « hors preuve » sont écartées de la lecture", async () => {
      allumer("voyants");
      const essai = "99999999-9999-4999-8999-999999999999";
      h.siteSetting.mockResolvedValue({
        value: [
          {
            appreciationId: essai,
            motif: "essai du 04/08",
            marqueLe: "2026-10-19T00:00:00.000Z",
            marquePar: "a",
          },
        ],
      });
      h.sessions.mockResolvedValue([SESSION]);
      await chargerTracesVoyants(["s1"], NOW);
      expect(h.appreciations.mock.calls[0]![0].where).toMatchObject({ id: { notIn: [essai] } });
    });
  });
});
