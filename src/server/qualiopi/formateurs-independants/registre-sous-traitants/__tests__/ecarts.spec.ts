// @vitest-environment node

/**
 * Qualiopi ind. 27 — le contrôle à preuves tracé, et ses suites :
 *   · contrôle de mission : la liste cochée est figée sur la trace, la mission doit être
 *     celle du formateur ;
 *   · écart MAJEUR (émargement absent…) : sous-traitant SUSPENDU, motif tracé ;
 *   · écart MINEUR : plan de correction à J+réglage (15 par défaut) ;
 *   · levée de la suspension : décision motivée, une seule fois ;
 *   · correction d'un écart mineur : motivée, une seule fois ;
 *   · interrupteur coupé : rien n'est tracé ni levé ;
 *   · le journal ne porte ni motif ni libellé libre.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const T1 = "11111111-1111-4111-8111-111111111111";
const R1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const M1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ADMIN = "66666666-6666-4666-8666-666666666666";
const MAINTENANT = new Date("2026-10-17T10:00:00Z");

const m = vi.hoisted(() => {
  const tx = {
    controleSousTraitant: { create: vi.fn() },
    ecartSousTraitant: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    suspensionSousTraitant: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    registreSousTraitantIndependant: { update: vi.fn() },
  };
  return {
    allume: vi.fn(),
    journaliser: vi.fn(),
    reglages: vi.fn(),
    tx,
    db: {
      ...tx,
      registreSousTraitantIndependant: {
        ...tx.registreSousTraitantIndependant,
        findUnique: vi.fn(),
      },
      missionFormateur: { findFirst: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: m.journaliser }));
vi.mock("../../interrupteur-allume", () => ({ interrupteurAllume: m.allume }));
vi.mock("../reglages", () => ({ lireReglagesInd27: m.reglages }));

import { PREUVES_MISSION } from "../controles.config";
import { corrigerEcart, leverSuspension, tracerControlePreuves } from "../ecarts";

const toutes = PREUVES_MISSION.map((p) => p.code);
const base = {
  trainerId: T1,
  code: "controle_mission",
  missionId: M1,
  cochees: toutes as string[],
  motif: null,
  faitAt: new Date("2026-10-16T12:00:00Z"),
  auteurId: ADMIN,
  maintenant: MAINTENANT,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.allume.mockResolvedValue(true);
  m.reglages.mockResolvedValue({ delaiCorrectionJours: 15, revueCompleteMois: 12 });
  m.db.registreSousTraitantIndependant.findUnique.mockResolvedValue({ id: R1, statut: "actif" });
  m.db.missionFormateur.findFirst.mockResolvedValue({ id: M1 });
  m.tx.controleSousTraitant.create.mockResolvedValue({ id: "ctl-1" });
  m.tx.suspensionSousTraitant.findFirst.mockResolvedValue(null);
  m.tx.suspensionSousTraitant.create.mockResolvedValue({ id: "susp-1" });
});

describe("contrôle de mission tracé", () => {
  it("tout coché : conforme, aucune suite ; la liste est figée sur la trace", async () => {
    const r = await tracerControlePreuves(base);
    expect(r).toEqual({ ok: true, resultat: "conforme", majeurs: 0, mineurs: 0 });
    expect(m.tx.controleSousTraitant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registreId: R1,
        code: "controle_mission",
        missionId: M1,
        resultat: "conforme",
        auteurId: ADMIN,
        preuves: expect.arrayContaining([{ code: "emargement", gravite: "majeur", fournie: true }]),
      }),
      select: { id: true },
    });
    expect(m.tx.ecartSousTraitant.createMany).not.toHaveBeenCalled();
    expect(m.tx.suspensionSousTraitant.create).not.toHaveBeenCalled();
  });

  it("🔴 émargement absent : écart MAJEUR, sous-traitant SUSPENDU avec motif tracé", async () => {
    const r = await tracerControlePreuves({
      ...base,
      cochees: toutes.filter((c) => c !== "emargement"),
    });
    expect(r).toMatchObject({ ok: true, resultat: "non_conforme", majeurs: 1, suspendu: true });
    expect(m.tx.ecartSousTraitant.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          registreId: R1,
          controleId: "ctl-1",
          preuveCode: "emargement",
          gravite: "majeur",
          echeanceCorrectionAt: null,
        }),
      ],
    });
    expect(m.tx.suspensionSousTraitant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        registreId: R1,
        controleId: "ctl-1",
        suspenduAt: MAINTENANT,
        suspenduParId: ADMIN,
        motif: expect.stringContaining("Émargements"),
      }),
      select: { id: true },
    });
    expect(m.tx.registreSousTraitantIndependant.update).toHaveBeenCalledWith({
      where: { id: R1 },
      data: { statut: "suspendu", statutDepuis: MAINTENANT },
    });
  });

  it("une suspension déjà en cours n'est pas doublée", async () => {
    m.tx.suspensionSousTraitant.findFirst.mockResolvedValue({ id: "susp-0" });
    const r = await tracerControlePreuves({ ...base, cochees: [] });
    expect(r).toMatchObject({ ok: true, suspendu: true });
    expect(m.tx.suspensionSousTraitant.create).not.toHaveBeenCalled();
  });

  it("une ligne sortie n'est pas suspendue (la sortie est définitive)", async () => {
    m.db.registreSousTraitantIndependant.findUnique.mockResolvedValue({ id: R1, statut: "sorti" });
    const r = await tracerControlePreuves({ ...base, cochees: [] });
    expect(r).toMatchObject({ ok: true, suspendu: false });
    expect(m.tx.suspensionSousTraitant.create).not.toHaveBeenCalled();
    expect(m.tx.registreSousTraitantIndependant.update).not.toHaveBeenCalled();
  });

  it("écart MINEUR seul : plan de correction à J+15 (réglage), aucune suspension", async () => {
    const r = await tracerControlePreuves({
      ...base,
      cochees: toutes.filter((c) => c !== "bilan_formateur"),
    });
    expect(r).toMatchObject({ ok: true, resultat: "a_revoir", majeurs: 0, mineurs: 1 });
    expect(m.tx.ecartSousTraitant.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          preuveCode: "bilan_formateur",
          gravite: "mineur",
          constateAt: MAINTENANT,
          echeanceCorrectionAt: new Date("2026-11-01T10:00:00Z"),
        }),
      ],
    });
    expect(m.tx.suspensionSousTraitant.create).not.toHaveBeenCalled();
  });

  it("le délai suit le réglage modifié", async () => {
    m.reglages.mockResolvedValue({ delaiCorrectionJours: 7, revueCompleteMois: 12 });
    await tracerControlePreuves({
      ...base,
      cochees: toutes.filter((c) => c !== "bilan_formateur"),
    });
    expect(m.tx.ecartSousTraitant.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ echeanceCorrectionAt: new Date("2026-10-24T10:00:00Z") })],
    });
  });

  it("journal : codes et compteurs, jamais le motif", async () => {
    await tracerControlePreuves({ ...base, cochees: [], motif: "Feuilles perdues par le client" });
    const changes = m.journaliser.mock.calls[0]?.[1]?.changes;
    expect(changes).toEqual({
      code: "controle_mission",
      resultat: "non_conforme",
      missionId: M1,
      majeurs: 3,
      mineurs: 3,
      suspendu: true,
    });
    expect(JSON.stringify(m.journaliser.mock.calls)).not.toContain("Feuilles perdues");
  });

  it("refusé : mission absente, mission d'un autre formateur, mission sur une revue", async () => {
    expect((await tracerControlePreuves({ ...base, missionId: null })).ok).toBe(false);
    m.db.missionFormateur.findFirst.mockResolvedValue(null);
    expect((await tracerControlePreuves(base)).ok).toBe(false);
    expect(m.db.missionFormateur.findFirst).toHaveBeenCalledWith({
      where: { id: M1, trainerId: T1 },
      select: { id: true },
    });
    expect((await tracerControlePreuves({ ...base, code: "revue_annuelle" })).ok).toBe(false);
    expect(m.tx.controleSousTraitant.create).not.toHaveBeenCalled();
  });

  it("refusé : contrôle sans liste de preuves, date future, hors registre", async () => {
    expect((await tracerControlePreuves({ ...base, code: "pieces_entree" })).ok).toBe(false);
    expect(
      (await tracerControlePreuves({ ...base, faitAt: new Date("2026-10-20T12:00:00Z") })).ok,
    ).toBe(false);
    m.db.registreSousTraitantIndependant.findUnique.mockResolvedValue(null);
    expect((await tracerControlePreuves(base)).ok).toBe(false);
    expect(m.tx.controleSousTraitant.create).not.toHaveBeenCalled();
  });

  it("la revue complète annuelle se trace sans mission", async () => {
    const r = await tracerControlePreuves({
      ...base,
      code: "revue_annuelle",
      missionId: null,
      cochees: [],
    });
    expect(r).toMatchObject({ ok: true, resultat: "non_conforme", suspendu: true });
  });

  it("coupé : rien n'est lu ni tracé", async () => {
    m.allume.mockResolvedValue(false);
    expect((await tracerControlePreuves(base)).ok).toBe(false);
    expect(m.db.registreSousTraitantIndependant.findUnique).not.toHaveBeenCalled();
    expect(m.db.$transaction).not.toHaveBeenCalled();
  });
});

describe("levée d'une suspension", () => {
  beforeEach(() => {
    m.tx.suspensionSousTraitant.findFirst.mockResolvedValue({ id: "susp-1" });
    m.db.registreSousTraitantIndependant.findUnique.mockResolvedValue({
      id: R1,
      statut: "suspendu",
      trainer: { actif: true, finCollaborationAt: null },
    });
  });

  it("décision motivée : levée datée, auteur, motif ; écarts majeurs clos ; ligne active", async () => {
    const r = await leverSuspension({
      trainerId: T1,
      motif: "Émargements retrouvés et versés au dossier",
      auteurId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ ok: true });
    expect(m.tx.suspensionSousTraitant.update).toHaveBeenCalledWith({
      where: { id: "susp-1" },
      data: {
        leveeAt: MAINTENANT,
        leveeParId: ADMIN,
        motifLevee: "Émargements retrouvés et versés au dossier",
      },
    });
    expect(m.tx.ecartSousTraitant.updateMany).toHaveBeenCalledWith({
      where: { registreId: R1, gravite: "majeur", corrigeAt: null },
      data: {
        corrigeAt: MAINTENANT,
        corrigeParId: ADMIN,
        motifCorrection: "Émargements retrouvés et versés au dossier",
      },
    });
    expect(m.tx.registreSousTraitantIndependant.update).toHaveBeenCalledWith({
      where: { id: R1 },
      data: { statut: "actif", statutDepuis: MAINTENANT },
    });
    expect(JSON.stringify(m.journaliser.mock.calls)).not.toContain("retrouvés");
  });

  it("fiche désactivée : la ligne reste suspendue après la levée", async () => {
    m.db.registreSousTraitantIndependant.findUnique.mockResolvedValue({
      id: R1,
      statut: "suspendu",
      trainer: { actif: false, finCollaborationAt: null },
    });
    await leverSuspension({
      trainerId: T1,
      motif: "Décision de la direction",
      auteurId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(m.tx.registreSousTraitantIndependant.update).not.toHaveBeenCalled();
  });

  it("refusée : sans motif, sans suspension en cours, interrupteur coupé", async () => {
    const lever = (motif: string) =>
      leverSuspension({ trainerId: T1, motif, auteurId: ADMIN, maintenant: MAINTENANT });
    expect((await lever("   ")).ok).toBe(false);
    m.tx.suspensionSousTraitant.findFirst.mockResolvedValue(null);
    expect((await lever("Décision de la direction")).ok).toBe(false);
    m.allume.mockResolvedValue(false);
    expect((await lever("Décision de la direction")).ok).toBe(false);
    expect(m.tx.suspensionSousTraitant.update).not.toHaveBeenCalled();
  });
});

describe("correction d'un écart mineur", () => {
  const corriger = (motif = "Bilan déposé le 20/10") =>
    corrigerEcart({ ecartId: "e-1", motif, auteurId: ADMIN, maintenant: MAINTENANT });

  it("motivée, datée, une seule fois", async () => {
    m.tx.ecartSousTraitant.findUnique.mockResolvedValue({
      id: "e-1",
      gravite: "mineur",
      corrigeAt: null,
      registre: { trainerId: T1 },
    });
    expect(await corriger()).toEqual({ ok: true });
    expect(m.tx.ecartSousTraitant.update).toHaveBeenCalledWith({
      where: { id: "e-1" },
      data: {
        corrigeAt: MAINTENANT,
        corrigeParId: ADMIN,
        motifCorrection: "Bilan déposé le 20/10",
      },
    });
  });

  it("refusée : déjà corrigé, écart majeur (c'est la levée qui le clôt), sans motif", async () => {
    m.tx.ecartSousTraitant.findUnique.mockResolvedValue({
      id: "e-1",
      gravite: "mineur",
      corrigeAt: new Date("2026-10-16T00:00:00Z"),
      registre: { trainerId: T1 },
    });
    expect((await corriger()).ok).toBe(false);
    m.tx.ecartSousTraitant.findUnique.mockResolvedValue({
      id: "e-1",
      gravite: "majeur",
      corrigeAt: null,
      registre: { trainerId: T1 },
    });
    expect((await corriger()).ok).toBe(false);
    expect((await corriger("")).ok).toBe(false);
    expect(m.tx.ecartSousTraitant.update).not.toHaveBeenCalled();
  });
});
