/**
 * Lot S1 (ADR 0066) — les portes qui ACTIVENT un formateur passent toutes par
 * l'écrivain unique et sa garde.
 *
 * Constat de départ, chaque `it` marqué 🔴 était ROUGE avant le lot :
 * - `setTrainerActifAction` activait un `sous_traitant` sans regarder une pièce ;
 * - un `editor` pouvait l'activer ;
 * - `createTrainerAction` créait un `sous_traitant` ACTIF (colonne `@default(true)`) ;
 * - `updateTrainerAction` requalifiait un salarié actif en `sous_traitant` actif ;
 * - la désactivation laissait ouvertes les propositions de mission en attente.
 *
 * Les salariés et dirigeants gardent leur comportement : un `editor` les
 * (dés)active comme avant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

const m = vi.hoisted(() => ({
  trainerCreate: vi.fn(),
  trainerUpdate: vi.fn(),
  trainerUpdateMany: vi.fn(),
  trainerFindUnique: vi.fn(),
  missionUpdateMany: vi.fn(),
  activityLogCreate: vi.fn(),
  session: { userId: "admin-uuid", role: "super_admin" } as { userId: string; role: string },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      create: (...a: unknown[]) => m.trainerCreate(...a),
      update: (...a: unknown[]) => m.trainerUpdate(...a),
      updateMany: (...a: unknown[]) => m.trainerUpdateMany(...a),
      findUnique: (...a: unknown[]) => m.trainerFindUnique(...a),
    },
    missionFormateur: { updateMany: (...a: unknown[]) => m.missionUpdateMany(...a) },
    activityLog: { create: (...a: unknown[]) => m.activityLogCreate(...a) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => m.session),
  requireHabilitation: vi.fn(async () => m.session),
  requireAdminDelete: vi.fn(async () => m.session),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/admin-planning/queries", () => ({ getTrainerConflicts: vi.fn() }));
vi.mock("@/server/qualiopi/trainers/documents", () => ({ getTrainerConformite: vi.fn() }));

import { createTrainerAction, setTrainerActifAction, updateTrainerAction } from "./trainers";

const TRAINER_ID = "22222222-2222-2222-2222-222222222222";
const JOUR = 24 * 3600 * 1000;
const ilYa = (jours: number) => new Date(Date.now() - jours * JOUR);

/** Indépendant SANS aucune pièce — le cas qu'on activait d'un clic. */
function independantNu(extra: Record<string, unknown> = {}) {
  return {
    statut: "sous_traitant",
    actif: false,
    sousTraitantVerifieAt: null,
    sousTraitantNda: null,
    sousTraitantContratSigneAt: null,
    documents: [],
    ...extra,
  };
}

/** Indépendant dont le dossier est COMPLET. */
function independantComplet(extra: Record<string, unknown> = {}) {
  return independantNu({
    sousTraitantVerifieAt: ilYa(10),
    sousTraitantNda: "84691234569",
    sousTraitantContratSigneAt: ilYa(9),
    documents: [
      {
        type: "attestation_vigilance_urssaf",
        statutValidation: "valide",
        fichierUrl: "https://stockage.example/vigilance.pdf",
        dateEmission: ilYa(20),
        dateExpiration: null,
      },
      {
        type: "kbis_avis_sirene",
        statutValidation: "valide",
        fichierUrl: "https://stockage.example/sirene.pdf",
        dateEmission: ilYa(20),
        dateExpiration: null,
      },
    ],
    ...extra,
  });
}

/** Une écriture `actif: true` a-t-elle été envoyée, par quelque chemin que ce soit ? */
function aEcritActifVrai(): boolean {
  const appels = [...m.trainerUpdate.mock.calls, ...m.trainerUpdateMany.mock.calls];
  return appels.some((c) => (c[0] as { data?: { actif?: boolean } })?.data?.actif === true);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.session = { userId: "admin-uuid", role: "super_admin" };
  m.trainerUpdate.mockResolvedValue({ id: TRAINER_ID });
  m.trainerUpdateMany.mockResolvedValue({ count: 1 });
  m.trainerCreate.mockResolvedValue({ id: TRAINER_ID });
  m.missionUpdateMany.mockResolvedValue({ count: 0 });
});

describe("setTrainerActifAction — activation d'un indépendant", () => {
  it("🔴 REFUSE d'activer un sous-traitant sans pièces, et dit ce qui manque", async () => {
    m.trainerFindUnique.mockResolvedValue(independantNu());
    const r = await setTrainerActifAction({ id: TRAINER_ID, actif: true });
    expect(r).toHaveProperty("error");
    if ("error" in r) {
      expect(r.error).toMatch(/déclaration d'activité/);
      expect(r.error).toMatch(/vigilance URSSAF/);
      expect(r.error).toMatch(/contrat-cadre/);
    }
    expect(aEcritActifVrai()).toBe(false);
  });

  it("🔴 REFUSE à un `editor` d'activer un sous-traitant, même au dossier complet", async () => {
    m.session = { userId: "editeur-uuid", role: "editor" };
    m.trainerFindUnique.mockResolvedValue(independantComplet());
    const r = await setTrainerActifAction({ id: TRAINER_ID, actif: true });
    expect(r).toHaveProperty("error");
    expect(aEcritActifVrai()).toBe(false);
  });

  it("REFUSE une attestation de vigilance de plus de 6 mois, même « valable jusqu'en 2099 »", async () => {
    m.trainerFindUnique.mockResolvedValue(
      independantComplet({
        documents: [
          {
            type: "attestation_vigilance_urssaf",
            statutValidation: "valide",
            fichierUrl: "https://stockage.example/vigilance.pdf",
            dateEmission: ilYa(250),
            dateExpiration: new Date("2099-12-31T00:00:00Z"),
          },
          {
            type: "kbis_avis_sirene",
            statutValidation: "valide",
            fichierUrl: "https://stockage.example/sirene.pdf",
            dateEmission: ilYa(20),
            dateExpiration: null,
          },
        ],
      }),
    );
    const r = await setTrainerActifAction({ id: TRAINER_ID, actif: true });
    expect(r).toHaveProperty("error");
    expect(aEcritActifVrai()).toBe(false);
  });

  it("un administrateur active un sous-traitant au dossier complet", async () => {
    m.trainerFindUnique.mockResolvedValue(independantComplet());
    const r = await setTrainerActifAction({ id: TRAINER_ID, actif: true });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
    expect(aEcritActifVrai()).toBe(true);
  });
});

describe("setTrainerActifAction — salariés et dirigeants : INCHANGÉ", () => {
  it.each(["salarie", "dirigeant"])(
    "un `editor` (ré)active un %s sans pièce de sous-traitance",
    async (statut) => {
      m.session = { userId: "editeur-uuid", role: "editor" };
      m.trainerFindUnique.mockResolvedValue({ ...independantNu(), statut });
      const r = await setTrainerActifAction({ id: TRAINER_ID, actif: true });
      expect(r).toEqual({ data: { id: TRAINER_ID } });
      expect(aEcritActifVrai()).toBe(true);
    },
  );

  it("un `editor` désactive un salarié", async () => {
    m.session = { userId: "editeur-uuid", role: "editor" };
    const r = await setTrainerActifAction({ id: TRAINER_ID, actif: false });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
  });
});

describe("setTrainerActifAction — la désactivation FERME", () => {
  it("🔴 retire les propositions EN ATTENTE du formateur, jamais les acceptées", async () => {
    m.missionUpdateMany.mockResolvedValue({ count: 2 });
    const r = await setTrainerActifAction({ id: TRAINER_ID, actif: false });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
    expect(m.missionUpdateMany).toHaveBeenCalledTimes(1);
    const arg = m.missionUpdateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ trainerId: TRAINER_ID, statut: "en_attente" });
    expect(arg.data).toEqual({ statut: "retiree" });
  });
});

describe("createTrainerAction — un indépendant naît INACTIF", () => {
  it("🔴 sans `actif` fourni, un sous-traitant n'hérite PAS du défaut `true`", async () => {
    await createTrainerAction({
      nom: "N",
      prenom: "P",
      email: "p@example.com",
      statut: "sous_traitant",
    });
    const arg = m.trainerCreate.mock.calls[0]?.[0] as { data: { actif?: boolean } };
    expect(arg.data.actif).toBe(false);
  });

  it("🔴 `actif: true` demandé pour un sous-traitant est ignoré", async () => {
    await createTrainerAction({
      nom: "N",
      prenom: "P",
      email: "p@example.com",
      statut: "sous_traitant",
      actif: true,
    });
    const arg = m.trainerCreate.mock.calls[0]?.[0] as { data: { actif?: boolean } };
    expect(arg.data.actif).toBe(false);
  });

  it("un salarié créé sans `actif` garde le défaut de la colonne (INCHANGÉ)", async () => {
    await createTrainerAction({ nom: "N", prenom: "P", email: "p@example.com", statut: "salarie" });
    const arg = m.trainerCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data).not.toHaveProperty("actif");
  });
});

describe("updateTrainerAction — passage au statut sous-traitant", () => {
  it("🔴 un salarié ACTIF requalifié en sous-traitant sans pièces est désactivé", async () => {
    m.trainerFindUnique
      .mockResolvedValueOnce({ statut: "salarie" })
      .mockResolvedValue(independantNu({ actif: true }));
    const r = await updateTrainerAction({ id: TRAINER_ID, statut: "sous_traitant" });
    expect(r).toHaveProperty("data");
    const desactive = m.trainerUpdate.mock.calls.some(
      (c) => (c[0] as { data?: { actif?: boolean } })?.data?.actif === false,
    );
    expect(desactive).toBe(true);
    if ("data" in r) expect(r.data).toMatchObject({ desactive: true });
  });

  it("au dossier complet, le passage au statut sous-traitant laisse la fiche active", async () => {
    m.trainerFindUnique
      .mockResolvedValueOnce({ statut: "salarie" })
      .mockResolvedValue(independantComplet({ actif: true }));
    await updateTrainerAction({ id: TRAINER_ID, statut: "sous_traitant" });
    const desactive = m.trainerUpdate.mock.calls.some(
      (c) => (c[0] as { data?: { actif?: boolean } })?.data?.actif === false,
    );
    expect(desactive).toBe(false);
  });

  it("une mise à jour d'un salarié qui ne touche pas au statut n'examine aucune pièce", async () => {
    const r = await updateTrainerAction({ id: TRAINER_ID, telephone: "0102030405" });
    expect(r).toEqual({ data: { id: TRAINER_ID } });
    expect(m.trainerFindUnique).not.toHaveBeenCalled();
  });
});
