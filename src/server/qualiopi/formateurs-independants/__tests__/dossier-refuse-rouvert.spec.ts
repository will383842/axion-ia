/**
 * Lot 8A (décision du dirigeant, #1510-4) — un dossier REFUSÉ (F13, ligne
 * `refus_administrateur`) dont un NOUVEAU contrôle au registre redevient vert repasse
 * de lui-même « à vérifier ». Jamais activé : la décision reste humaine. Une trace au
 * journal, identifiants seuls.
 */

import { describe, expect, it, vi } from "vitest";

import { SOURCE_REFUS_ADMINISTRATEUR } from "../controle-regles";
import { controlerRegistreFormateur, type SourceRegistre } from "../controle";
import { SOURCE_REFUS_DOSSIER } from "../envois-dossier";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const SIREN = "123456782";
const SIRET = `${SIREN}00012`;
const NDA = "84380000000";
const TRAINER = "11111111-1111-4111-8111-111111111111";
const REFUS = "44444444-4444-4444-8444-444444444444";
const maintenant = new Date("2026-10-31T10:00:00Z");

const sourceVerte: SourceRegistre = {
  lireEntreprise: async () => ({
    siren: SIREN,
    etatAdministratif: "A",
    naf: "85.59A",
    etablissement: { siret: SIRET, ouvert: true },
  }),
  lireListeOF: async () => ({ ndaDuSiren: [NDA], sirenDuNda: SIREN }),
};
const sourceRouge: SourceRegistre = {
  ...sourceVerte,
  lireEntreprise: async () => ({
    siren: SIREN,
    etatAdministratif: "C",
    naf: "85.59A",
    etablissement: { siret: SIRET, ouvert: false },
  }),
};

function base(opts: { refus: boolean; vertDepuis?: boolean; rouverts?: number }) {
  const journal: Array<Record<string, unknown>> = [];
  const updateMany = vi.fn(async (_a: unknown) => ({ count: opts.rouverts ?? 1 }));
  const findFirst = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    if (where.source === SOURCE_REFUS_ADMINISTRATEUR)
      return opts.refus ? { id: REFUS, createdAt: new Date("2026-10-01T00:00:00Z") } : null;
    return opts.vertDepuis ? { id: "vert-entre-temps" } : null;
  });
  const db = {
    trainer: {
      findUnique: vi.fn(async () => ({
        id: TRAINER,
        statut: "sous_traitant",
        siret: SIRET,
        sousTraitantNda: NDA,
      })),
      update: vi.fn(async () => ({})),
      updateMany,
    },
    verificationRegistreSousTraitance: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "nouveau",
        ...data,
      })),
      findFirst,
    },
    activityLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        journal.push(data);
        return {};
      }),
    },
    setting: { findUnique: vi.fn(async () => null) },
    $executeRaw: vi.fn(async () => 0),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  return { db, journal, updateMany };
}

const controler = (db: unknown, source = sourceVerte) =>
  controlerRegistreFormateur(db as never, source, {
    trainerId: TRAINER,
    verifieParId: null,
    maintenant,
  });

describe("dossier refusé puis registre redevenu vert", () => {
  it("la source du refus est la même des deux côtés", () => {
    expect(SOURCE_REFUS_DOSSIER).toBe(SOURCE_REFUS_ADMINISTRATEUR);
  });

  it("premier vert après le refus : le dossier repasse « à vérifier », jamais activé", async () => {
    const { db, journal, updateMany } = base({ refus: true });
    await controler(db);
    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.data).toEqual({ dossierStatut: "a_verifier" });
    expect(arg.where).toMatchObject({
      id: TRAINER,
      activationValideeAt: null,
      finCollaborationAt: null,
    });
    // Aucune activation : seul le statut du dossier est écrit.
    expect(Object.keys(arg.data)).toEqual(["dossierStatut"]);
    const trace = journal.find((j) => j.action === "qualiopi.formateur.dossier_refus_leve");
    expect(trace).toMatchObject({ targetType: "Trainer", targetId: TRAINER });
    expect(trace?.changes).toEqual({ controleId: "nouveau", refusId: REFUS, rouvert: true });
  });

  it("aucun refus : rien ne bouge", async () => {
    const { db, journal, updateMany } = base({ refus: false });
    await controler(db);
    expect(updateMany).not.toHaveBeenCalled();
    expect(journal.some((j) => j.action === "qualiopi.formateur.dossier_refus_leve")).toBe(false);
  });

  it("un vert a déjà levé ce refus : pas de seconde réouverture", async () => {
    const { db, updateMany } = base({ refus: true, vertDepuis: true });
    await controler(db);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("contrôle encore rouge : le refus tient", async () => {
    const { db, updateMany } = base({ refus: true });
    await controler(db, sourceRouge);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("formateur déjà actif", () => {
  it("rien n'est réécrit, la levée du refus est tracée", async () => {
    const { db, journal, updateMany } = base({ refus: true });
    db.trainer.findUnique.mockResolvedValue({
      id: TRAINER,
      statut: "sous_traitant",
      siret: SIRET,
      sousTraitantNda: NDA,
      actif: true,
    } as never);
    await controler(db);
    expect(updateMany).not.toHaveBeenCalled();
    const trace = journal.find((j) => j.action === "qualiopi.formateur.dossier_refus_leve");
    expect(trace?.changes).toMatchObject({ rouvert: false });
  });
});
