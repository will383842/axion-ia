/**
 * Lot L9 — l'écrivain unique applique la règle COMPLÈTE quand l'écran
 * « Vérifier et contresigner » est allumé, et SEULEMENT alors.
 *
 * 🔴 Interrupteurs absents : comportement d'aujourd'hui EXACTEMENT (règle
 * provisoire de S1, même écriture, aucun champ `activationValidee*`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  settings: [] as Array<{ key: string; value: unknown }>,
  trainer: null as Record<string, unknown> | null,
  updateMany: vi.fn(),
  activityLog: vi.fn(),
  logQualiopi: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    setting: { findMany: vi.fn(async () => h.settings) },
    trainer: {
      findUnique: vi.fn(async () => h.trainer),
      updateMany: h.updateMany,
      update: vi.fn(),
    },
    documentGenere: {
      findMany: vi.fn(async () => [
        {
          metadata: {
            renderData: {
              gabaritVersion: 3,
              data: { cocontractant: { siret: "12345678900011" } },
            },
          },
          statutSignature: "signee",
          annuleeAt: null,
        },
      ]),
    },
    verificationRegistreSousTraitance: {
      findMany: vi.fn(async () => [
        {
          verdict: "vert",
          source: "registre_entreprises+liste_of",
          verifieAt: new Date(Date.now() - 3600_000),
          createdAt: new Date(Date.now() - 3600_000),
          siret: "12345678900011",
        },
      ]),
    },
    preuveVigilance: {
      findMany: vi.fn(async () => [{ trainerDocumentId: "doc-att", resultat: "valide" }]),
    },
    activityLog: { create: h.activityLog },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
  };
  return { prisma: client };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: h.logQualiopi }));
vi.mock("@/server/qualiopi/trainers/mission-formateur", () => ({
  retirerSollicitationsDuFormateur: vi.fn(async () => 0),
}));

import { changerActivationFormateur } from "../activation";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const session = { userId: ADMIN, role: "admin" } as never;
const ilYa = (j: number) => new Date(Date.now() - j * 24 * 3600_000);

/** Une fiche qui passe la règle PROVISOIRE et la règle COMPLÈTE. */
function ficheComplete(): Record<string, unknown> {
  return {
    statut: "sous_traitant",
    actif: false,
    sousTraitantVerifieAt: ilYa(1),
    sousTraitantNda: "84691234569",
    sousTraitantContratSigneAt: ilYa(1),
    finCollaborationAt: null,
    siret: "12345678900011",
    ndaVerifieListeAt: ilYa(1),
    regimeTvaHonoraires: "franchise",
    iban: "enc:v2:xxx",
    declarationsVersion: "1",
    habilitations: [{ id: "h1" }],
    documents: [
      {
        id: "doc-att",
        type: "attestation_vigilance_urssaf",
        statutValidation: "valide",
        fichierUrl: "r2://a",
        dateEmission: ilYa(10),
        dateExpiration: null,
      },
      {
        id: "doc-ks",
        type: "kbis_avis_sirene",
        statutValidation: "valide",
        fichierUrl: "r2://k",
        dateEmission: ilYa(10),
        dateExpiration: null,
      },
      {
        id: "doc-cv",
        type: "cv",
        statutValidation: "valide",
        fichierUrl: "r2://cv",
        dateEmission: ilYa(10),
        dateExpiration: null,
      },
    ],
  };
}

function allumer(cles: Record<string, boolean>) {
  h.settings = Object.entries(cles).map(([k, actif]) => ({
    key: `formateurs.${k}`,
    value: { actif },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.settings = [];
  h.trainer = ficheComplete();
  h.updateMany.mockResolvedValue({ count: 1 });
});

describe("changerActivationFormateur — interrupteurs ABSENTS (comportement d'aujourd'hui)", () => {
  it("écrit exactement ce qu'écrivait S1 : `actif` seul, sans validation datée", async () => {
    const r = await changerActivationFormateur({
      trainerId: ID,
      actif: true,
      acteur: { type: "administrateur", session },
      motif: "Essai",
    });
    expect(r).toEqual({ ok: true, actif: true, inchange: false, sollicitationsRetirees: 0 });
    expect(h.updateMany).toHaveBeenCalledTimes(1);
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: ID, statut: "sous_traitant", actif: false },
      data: { actif: true },
    });
  });

  it("la règle complète n'est PAS appliquée : une fiche sans habilitation s'active comme avant", async () => {
    h.trainer = { ...ficheComplete(), habilitations: [], iban: null, declarationsVersion: null };
    const r = await changerActivationFormateur({
      trainerId: ID,
      actif: true,
      acteur: { type: "administrateur", session },
      motif: "Essai",
    });
    expect(r.ok).toBe(true);
  });
});

describe("changerActivationFormateur — activation_auto ALLUMÉ (lot L9)", () => {
  it("applique la règle complète : sans habilitation, refus avec le manque", async () => {
    allumer({ activation_auto: true });
    h.trainer = { ...ficheComplete(), habilitations: [] };
    const r = await changerActivationFormateur({
      trainerId: ID,
      actif: true,
      acteur: { type: "administrateur", session },
      motif: "Essai",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("garde");
      expect(r.manques).toEqual(["Aucune formation n'est cochée."]);
    }
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("active en datant et en attribuant la validation à la personne qui agit", async () => {
    allumer({ activation_auto: true });
    const r = await changerActivationFormateur({
      trainerId: ID,
      actif: true,
      acteur: { type: "administrateur", session },
      motif: "Contresignature",
    });
    expect(r).toEqual({ ok: true, actif: true, inchange: false, sollicitationsRetirees: 0 });
    const arg = h.updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({
      id: ID,
      statut: "sous_traitant",
      actif: false,
      finCollaborationAt: null,
    });
    expect(arg.data).toMatchObject({
      actif: true,
      activationValideeParId: ADMIN,
      activationValideeSource: "controle",
    });
    expect(arg.data.activationValideeAt).toBeInstanceOf(Date);
    // Journal écrit dans la transaction, cible = UUID de la fiche.
    expect(h.activityLog).toHaveBeenCalledTimes(1);
    const journal = h.activityLog.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(journal.data.targetId).toBe(ID);
  });

  it("un acteur système n'active jamais, même allumé", async () => {
    allumer({ activation_auto: true });
    const r = await changerActivationFormateur({
      trainerId: ID,
      actif: true,
      acteur: { type: "systeme", source: "worker" },
      motif: "Essai",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("acteur_systeme");
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("garde_activation coupée : retour à la règle provisoire", async () => {
    allumer({ activation_auto: true, garde_activation: false });
    h.trainer = { ...ficheComplete(), habilitations: [] };
    const r = await changerActivationFormateur({
      trainerId: ID,
      actif: true,
      acteur: { type: "administrateur", session },
      motif: "Essai",
    });
    expect(r.ok).toBe(true);
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: ID, statut: "sous_traitant", actif: false },
      data: { actif: true },
    });
  });
});
