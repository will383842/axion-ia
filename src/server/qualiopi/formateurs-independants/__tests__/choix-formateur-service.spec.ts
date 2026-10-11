/**
 * Lots L11b et L11h — choix enregistré, rang suivant (T15), désistement (T16),
 * et l'interrupteur ABSENT qui ne change rien.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SESSION = UUID(1);
const A = UUID(11);
const B = UUID(12);
const C = UUID(13);
const MISSION = UUID(21);

const h = vi.hoisted(() => {
  const etat = {
    settings: new Map<string, unknown>(),
    session: null as Record<string, unknown> | null,
    choix: [] as Array<Record<string, unknown>>,
    missions: [] as Array<Record<string, unknown>>,
    missionUnique: null as Record<string, unknown> | null,
    vivantes: 0,
    placePrise: false,
    ecritures: [] as string[],
  };
  const tx = {
    choixFormateurSession: {
      findMany: vi.fn(async () => etat.choix),
      update: vi.fn(async (a: unknown) => {
        etat.ecritures.push(`choix.update ${JSON.stringify(a)}`);
        return {};
      }),
      create: vi.fn(async (a: unknown) => {
        etat.ecritures.push(`choix.create ${JSON.stringify(a)}`);
        return {};
      }),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    trainingSession: {
      updateMany: vi.fn(async (a: unknown) => {
        etat.ecritures.push(`session.updateMany ${JSON.stringify(a)}`);
        return { count: etat.placePrise ? 0 : 1 };
      }),
    },
    sessionFormateur: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    missionFormateur: {
      updateMany: vi.fn(async (a: unknown) => {
        etat.ecritures.push(`mission.updateMany ${JSON.stringify(a)}`);
        return { count: 1 };
      }),
    },
    documentGenere: {
      updateMany: vi.fn(async (a: unknown) => {
        etat.ecritures.push(`document.updateMany ${JSON.stringify(a)}`);
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.settings.has(where.key) ? { value: etat.settings.get(where.key) } : null,
      ),
    },
    trainingSession: {
      findUnique: vi.fn(async () => etat.session),
      findMany: vi.fn(async () => (etat.session ? [{ id: SESSION }] : [])),
    },
    trainer: { findUnique: vi.fn(async () => ({ tarifJourneeHtCents: null })) },
    missionFormateur: {
      count: vi.fn(async () => etat.vivantes),
      findMany: vi.fn(async () => etat.missions),
      findUnique: vi.fn(async () => etat.missionUnique),
    },
    choixFormateurSession: {
      findMany: vi.fn(async () => etat.choix),
      findUnique: vi.fn(async () => etat.choix[0] ?? null),
      updateMany: vi.fn(async (a: unknown) => {
        etat.ecritures.push(`choix.updateMany ${JSON.stringify(a)}`);
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (f: (t: typeof tx) => unknown) => f(tx)),
  };
  return {
    etat,
    tx,
    prisma,
    evaluer: vi.fn(async (_t: string) => ({ refus: [] as unknown[], avertissements: [] })),
    proposer: vi.fn(async () => ({ proposee: true, missionId: "m", emailEnvoye: true })),
    envoyer: vi.fn(async () => "envoye"),
    telegram: vi.fn(async () => true),
    journaliser: vi.fn(async () => true),
    archiver: vi.fn(async () => 1),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: h.telegram }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: h.journaliser }));
vi.mock("../envois", () => ({ envoyer: h.envoyer }));
vi.mock("../evaluer-affectation", () => ({ evaluerAffectation: h.evaluer }));
vi.mock("@/server/qualiopi/trainers/affectation-retiree", () => ({
  lireAffectationsAvantRetrait: vi.fn(async () => []),
  archiverAffectationsRetirees: h.archiver,
}));
vi.mock("@/server/qualiopi/trainers/mission-formateur", () => ({
  STATUTS_ACCORD_DONNE: ["acceptee", "accord_hors_outil"],
  LIBELLE_STATUT_MISSION: { en_attente: "En attente de réponse", refusee: "Refusée" },
  proposerMissionFormateur: h.proposer,
}));

import {
  MOTIF_CHOIX_REMPLACE,
  MOTIF_LETTRE_DESISTEMENT,
  enregistrerChoix,
  proposerRangSuivant,
  proposerRangsSuivants,
  seDesister,
} from "../choix-formateur-service";
import { lireConditionsFigees } from "../conditions-figees";
import { champsF23Honoraires } from "../proposition-chiffree";

const MAINTENANT = new Date("2026-10-11T10:00:00Z");
const CHOISI = new Date("2026-10-11T09:00:00Z");

function allumer(...cles: string[]) {
  for (const c of cles) h.etat.settings.set(`formateurs.${c}`, { actif: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.settings.clear();
  h.etat.session = {
    id: SESSION,
    numero: "AXI-SESS-TEST",
    titreSession: "IA pour managers",
    formationId: UUID(2),
    dateDebut: new Date("2026-11-04T08:00:00Z"),
    dateFin: new Date("2026-11-07T16:00:00Z"),
    statut: "planifiee",
    lieuType: "sur_site",
    lieuCodePostal: "69003",
    modalite: "presentiel",
    formateurPrincipalId: null,
  };
  h.etat.choix = [
    { trainerId: A, rang: 1, sauteAt: null, updatedAt: CHOISI },
    { trainerId: B, rang: 2, sauteAt: null, updatedAt: CHOISI },
    { trainerId: C, rang: 3, sauteAt: null, updatedAt: CHOISI },
  ];
  h.etat.missions = [];
  h.etat.missionUnique = null;
  h.etat.vivantes = 0;
  h.etat.placePrise = false;
  h.etat.ecritures = [];
  h.evaluer.mockImplementation(async () => ({ refus: [], avertissements: [] }));
});

describe("interrupteurs ABSENTS : exactement le comportement d'avant", () => {
  it("aucun rang suivant, aucune lecture au-delà de l'interrupteur", async () => {
    expect(await proposerRangSuivant(SESSION, "refus", MAINTENANT)).toEqual({ fait: "coupe" });
    expect(await proposerRangsSuivants(MAINTENANT)).toEqual({ proposes: 0, aPourvoir: 0 });
    expect(h.prisma.trainingSession.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.trainingSession.findMany).not.toHaveBeenCalled();
    expect(h.proposer).not.toHaveBeenCalled();
  });
  it("aucun désistement depuis l'espace, rien n'est écrit", async () => {
    const r = await seDesister({ trainerId: A, missionId: MISSION, maintenant: MAINTENANT });
    expect(r.ok).toBe(false);
    expect(h.prisma.missionFormateur.findUnique).not.toHaveBeenCalled();
    expect(h.etat.ecritures).toEqual([]);
  });
  it("aucune condition figée recopiée, aucune variante chiffrée de F23", async () => {
    expect(await lireConditionsFigees(SESSION, A)).toBeNull();
    expect(h.prisma.choixFormateurSession.findUnique).not.toHaveBeenCalled();
    expect(await champsF23Honoraires(MISSION)).toBeNull();
  });
});

describe("conditions figées (L11b) : recopiées seulement depuis un choix vivant", () => {
  it("rang 1 à 3 non sauté : tarif et forfait", async () => {
    allumer("choix_cartes");
    h.etat.choix = [
      { rang: 2, sauteAt: null, tarifHtCents: 35_000, forfaitDeplacementParJourHtCents: 8_000 },
    ];
    expect(await lireConditionsFigees(SESSION, B)).toEqual({
      tarifHtCents: 35_000,
      forfaitDeplacementParJourHtCents: 8_000,
    });
  });
  it("choix archivé (au-delà du rang 3) ou sauté : rien", async () => {
    allumer("choix_cartes");
    h.etat.choix = [
      { rang: 5, sauteAt: MAINTENANT, tarifHtCents: 35_000, forfaitDeplacementParJourHtCents: 0 },
    ];
    expect(await lireConditionsFigees(SESSION, B)).toBeNull();
  });
});

describe("enregistrer le choix : rien ne s'efface", () => {
  it("les anciens rangs sont rangés au-delà de 3, l'écarté marqué, aucun delete", async () => {
    h.etat.choix = [
      { id: UUID(31), trainerId: A, rang: 1, sauteAt: null },
      { id: UUID(32), trainerId: B, rang: 2, sauteAt: null },
    ];
    await enregistrerChoix(
      SESSION,
      [
        { trainerId: B, rang: 1, tarifHtCents: 35_000, forfaitDeplacementParJourHtCents: 0 },
        { trainerId: C, rang: 2, tarifHtCents: 35_000, forfaitDeplacementParJourHtCents: 8_000 },
      ],
      MAINTENANT,
    );
    expect(h.tx.choixFormateurSession.delete).not.toHaveBeenCalled();
    expect(h.tx.choixFormateurSession.deleteMany).not.toHaveBeenCalled();
    const e = h.etat.ecritures.join("\n");
    expect(e).toContain(`"rang":4`);
    expect(e).toContain(`"rang":5`);
    expect(e).toContain(MOTIF_CHOIX_REMPLACE);
    expect(h.tx.choixFormateurSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: SESSION,
        trainerId: C,
        rang: 2,
        forfaitDeplacementParJourHtCents: 8_000,
      }),
    });
  });
});

describe("rang suivant (T15)", () => {
  beforeEach(() => allumer("choix_suivants"));

  it("refus au rang 1 : le rang 2 est proposé, place prise par écriture conditionnelle", async () => {
    h.etat.missions = [{ trainerId: A, solliciteAt: new Date("2026-10-11T09:05:00Z") }];
    const r = await proposerRangSuivant(SESSION, "refus", MAINTENANT);
    expect(r).toEqual({ fait: "propose", rang: 2, trainerId: B, proposee: true });
    expect(h.tx.trainingSession.updateMany).toHaveBeenCalledWith({
      where: { id: SESSION, formateurPrincipalId: null },
      data: { formateurPrincipalId: B },
    });
    expect(h.proposer).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION, trainerId: B }),
    );
  });

  it("un rang devenu inéligible est sauté (journal + alerte sans nom), puis le suivant", async () => {
    h.etat.missions = [{ trainerId: A, solliciteAt: new Date("2026-10-11T09:05:00Z") }];
    h.evaluer.mockImplementation(async (t: string) =>
      t === B
        ? {
            refus: [
              {
                code: "garde",
                texte: "L'attestation de vigilance URSSAF n'est pas valable aujourd'hui.",
                levee: null,
              },
            ],
            avertissements: [],
          }
        : { refus: [], avertissements: [] },
    );
    const r = await proposerRangSuivant(SESSION, "refus", MAINTENANT);
    expect(r).toMatchObject({ fait: "propose", rang: 3, trainerId: C });
    expect(h.prisma.choixFormateurSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: SESSION, trainerId: B, sauteAt: null } }),
    );
    expect(h.journaliser).toHaveBeenCalledWith(
      h.prisma,
      expect.objectContaining({ action: "qualiopi.mission.rang_saute", targetId: SESSION }),
    );
    const alerte = String(
      (h.telegram.mock.calls[0] as unknown[])[0] && JSON.stringify(h.telegram.mock.calls[0]),
    );
    expect(alerte).toContain("AXI-SESS-TEST");
    expect(alerte).not.toMatch(/URSSAF|IA pour managers/);
  });

  it("jamais deux propositions vivantes : une place tenue arrête tout", async () => {
    h.etat.vivantes = 1;
    expect(await proposerRangSuivant(SESSION, "passage", MAINTENANT)).toMatchObject({
      fait: "rien",
    });
    h.etat.vivantes = 0;
    h.etat.session = { ...h.etat.session!, formateurPrincipalId: A };
    expect(await proposerRangSuivant(SESSION, "passage", MAINTENANT)).toMatchObject({
      fait: "rien",
    });
    expect(h.proposer).not.toHaveBeenCalled();
  });

  it("place prise entre-temps par la console : rien n'est proposé", async () => {
    h.etat.placePrise = true;
    expect(await proposerRangSuivant(SESSION, "refus", MAINTENANT)).toMatchObject({ fait: "rien" });
    expect(h.proposer).not.toHaveBeenCalled();
  });

  it("plus personne : « à pourvoir », alerte une fois sur un événement", async () => {
    h.etat.missions = [A, B, C].map((t) => ({
      trainerId: t,
      solliciteAt: new Date("2026-10-11T09:30:00Z"),
    }));
    expect(await proposerRangSuivant(SESSION, "refus", MAINTENANT)).toEqual({
      fait: "a_pourvoir",
      sautes: 0,
    });
    expect(h.telegram).toHaveBeenCalledTimes(1);
    h.telegram.mockClear();
    expect(await proposerRangSuivant(SESSION, "passage", MAINTENANT)).toEqual({
      fait: "a_pourvoir",
      sautes: 0,
    });
    expect(h.telegram).not.toHaveBeenCalled();
  });

  it("une session sans choix en cartes n'est jamais touchée", async () => {
    h.etat.choix = [];
    expect(await proposerRangSuivant(SESSION, "refus", MAINTENANT)).toMatchObject({ fait: "rien" });
    expect(h.telegram).not.toHaveBeenCalled();
  });
});

describe("désistement (T16)", () => {
  beforeEach(() => {
    allumer("choix_suivants");
    h.etat.missionUnique = {
      id: MISSION,
      trainerId: A,
      sessionId: SESSION,
      statut: "acceptee",
      session: {
        numero: "AXI-SESS-TEST",
        titreSession: "IA pour managers",
        dateDebut: new Date("2026-11-04T08:00:00Z"),
        statut: "planifiee",
      },
      trainer: { prenom: "Marie", email: "marie@example.test" },
    };
  });

  it("la mission d'un AUTRE formateur répond comme une mission inconnue", async () => {
    const r = await seDesister({ trainerId: B, missionId: MISSION, maintenant: MAINTENANT });
    expect(r).toEqual({ ok: false, erreur: "Mission introuvable." });
    expect(h.etat.ecritures).toEqual([]);
  });

  it("seulement une mission acceptée, avant le début", async () => {
    h.etat.missionUnique = { ...h.etat.missionUnique!, statut: "en_attente" };
    expect(
      (await seDesister({ trainerId: A, missionId: MISSION, maintenant: MAINTENANT })).ok,
    ).toBe(false);
    h.etat.missionUnique = {
      ...h.etat.missionUnique!,
      statut: "acceptee",
      session: {
        numero: "X",
        titreSession: "Y",
        dateDebut: new Date("2026-10-01T08:00:00Z"),
        statut: "planifiee",
      },
    };
    expect(
      (await seDesister({ trainerId: A, missionId: MISSION, maintenant: MAINTENANT })).ok,
    ).toBe(false);
    expect(h.etat.ecritures).toEqual([]);
  });

  it("désistée, affectation retirée, lettre NON signée annulée, F48, I10 sans nom, rang suivant", async () => {
    const r = await seDesister({
      trainerId: A,
      missionId: MISSION,
      motif: "Imprévu",
      remplacant: "Jean Exemple",
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ ok: true });
    const e = h.etat.ecritures.join("\n");
    expect(e).toContain(`"statut":"desistee"`);
    expect(e).toContain(MOTIF_LETTRE_DESISTEMENT);
    // Seule la lettre sans signature du formateur est annulée.
    expect(e).toContain(`"signatures":{"none":{"revokedAt":null,"partie":"formateur"}}`);
    expect(h.archiver).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ motif: "desistement_formateur" }),
    );
    expect(h.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "formateur-desistement-recu",
        entityId: A,
        payload: expect.objectContaining({ etape: 2 }),
      }),
    );
    const alerte = JSON.stringify(h.telegram.mock.calls);
    expect(alerte).toContain("AXI-SESS-TEST");
    expect(alerte).not.toMatch(/Marie|Jean|Imprévu|IA pour managers/);
    const journal = JSON.stringify(h.journaliser.mock.calls);
    expect(journal).not.toMatch(/Marie|Jean|Imprévu/);
    expect(h.journaliser).toHaveBeenCalledWith(
      h.prisma,
      expect.objectContaining({ action: "qualiopi.mission.desistement", targetId: MISSION }),
    );
    // Aucune pénalité : aucun incident consigné contre le formateur.
    expect(e).not.toMatch(/incident/i);
  });
});
