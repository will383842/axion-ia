// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  logQualiopiActivity: vi.fn(async () => {}),
}));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class extends Error {},
}));

import { ajouterEtiquette, retirerEtiquette } from "../etiquettes";
import { archiver, definirResponsable, desarchiver, lireProfil } from "../profil";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const SUPER = { userId: "u1", role: "super_admin" as const };
const ADMIN = { userId: "u2", role: "admin" as const };

interface Ligne {
  responsableLabel: string | null;
  archiveLe: Date | null;
  archiveMotif: string | null;
}

function fausseBase() {
  const profils = new Map<string, Ligne>();
  const etiquettes: { id: string; clientId: string; libelle: string }[] = [];
  const db = {
    clientProfil: {
      findUnique: vi.fn(
        async ({ where }: { where: { clientId: string } }) => profils.get(where.clientId) ?? null,
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { clientId: string };
          create: Partial<Ligne>;
          update: Partial<Ligne>;
        }) => {
          const avant = profils.get(where.clientId);
          profils.set(where.clientId, {
            responsableLabel: null,
            archiveLe: null,
            archiveMotif: null,
            ...(avant ?? create),
            ...(avant ? update : {}),
          });
        },
      ),
      delete: vi.fn(async () => {}),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    clientEtiquette: {
      findMany: vi.fn(async () => etiquettes),
      findFirst: vi.fn(
        async ({ where }: { where: { id?: string; clientId: string; libelle?: string } }) =>
          etiquettes.find(
            (e) =>
              e.clientId === where.clientId &&
              (where.id === undefined || e.id === where.id) &&
              (where.libelle === undefined || e.libelle === where.libelle),
          ) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: { clientId: string; libelle: string } }) => {
        etiquettes.push({ id: `e${etiquettes.length}`, ...data });
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        etiquettes.splice(
          etiquettes.findIndex((e) => e.id === where.id),
          1,
        );
      }),
    },
  };
  return { db: db as never, profils, etiquettes, brut: db };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("archivage", () => {
  it("refusé hors super-administrateur, sans toucher la base", async () => {
    const { db, brut } = fausseBase();
    await expect(
      archiver(db, { clientId: CLIENT, motif: "", maintenant: new Date(), acteur: ADMIN }),
    ).rejects.toThrow(/super-administrateur/);
    await expect(desarchiver(db, { clientId: CLIENT, acteur: ADMIN })).rejects.toThrow(
      /super-administrateur/,
    );
    expect(brut.clientProfil.findUnique).not.toHaveBeenCalled();
    expect(brut.clientProfil.upsert).not.toHaveBeenCalled();
  });

  it("archive puis désarchive, sans toucher au responsable", async () => {
    const { db, profils } = fausseBase();
    await definirResponsable(db, { clientId: CLIENT, libelle: "Camille", acteur: ADMIN });
    expect(
      await archiver(db, {
        clientId: CLIENT,
        motif: " fin de mission ",
        maintenant: new Date(),
        acteur: SUPER,
      }),
    ).toBe("fait");
    expect(profils.get(CLIENT)).toEqual({
      responsableLabel: "Camille",
      archiveLe: new Date("2026-10-30T10:00:00Z"),
      archiveMotif: "fin de mission",
      clientId: CLIENT,
    });
    expect(
      await archiver(db, {
        clientId: CLIENT,
        motif: "autre",
        maintenant: new Date(),
        acteur: SUPER,
      }),
    ).toBe("deja");
    expect(await desarchiver(db, { clientId: CLIENT, acteur: SUPER })).toBe("fait");
    expect(await lireProfil(db, CLIENT)).toEqual({
      responsable: "Camille",
      archiveLe: null,
      archiveMotif: null,
    });
    expect(await desarchiver(db, { clientId: CLIENT, acteur: SUPER })).toBe("deja");
  });

  it("n'emploie jamais delete sur la fiche", async () => {
    const { db, brut } = fausseBase();
    await definirResponsable(db, { clientId: CLIENT, libelle: "Camille", acteur: ADMIN });
    await archiver(db, { clientId: CLIENT, motif: "fin", maintenant: new Date(), acteur: SUPER });
    await desarchiver(db, { clientId: CLIENT, acteur: SUPER });
    await definirResponsable(db, { clientId: CLIENT, libelle: "", acteur: ADMIN });
    expect(brut.clientProfil.delete).not.toHaveBeenCalled();
    expect(brut.clientProfil.deleteMany).not.toHaveBeenCalled();
  });

  it("motif de plus de 200 caractères refusé", async () => {
    const { db } = fausseBase();
    await expect(
      archiver(db, {
        clientId: CLIENT,
        motif: "x".repeat(201),
        maintenant: new Date(),
        acteur: SUPER,
      }),
    ).rejects.toThrow(/200/);
  });
});

describe("responsable", () => {
  it("80 caractères au plus ; vide = retiré", async () => {
    const { db, profils } = fausseBase();
    await expect(
      definirResponsable(db, { clientId: CLIENT, libelle: "x".repeat(81), acteur: ADMIN }),
    ).rejects.toThrow(/80/);
    await definirResponsable(db, { clientId: CLIENT, libelle: "x".repeat(80), acteur: ADMIN });
    await definirResponsable(db, { clientId: CLIENT, libelle: "  ", acteur: ADMIN });
    expect(profils.get(CLIENT)?.responsableLabel).toBeNull();
  });
});

describe("étiquettes", () => {
  it("ajoute, refuse proprement un doublon et un libellé trop long, retire", async () => {
    const { db, etiquettes } = fausseBase();
    await ajouterEtiquette(db, { clientId: CLIENT, libelle: " BTP  Isère ", acteur: ADMIN });
    expect(etiquettes.map((e) => e.libelle)).toEqual(["BTP Isère"]);
    await expect(
      ajouterEtiquette(db, { clientId: CLIENT, libelle: "BTP Isère", acteur: ADMIN }),
    ).rejects.toThrow(/déjà sur la fiche/);
    await expect(
      ajouterEtiquette(db, { clientId: CLIENT, libelle: "y".repeat(61), acteur: ADMIN }),
    ).rejects.toThrow(/60/);
    await expect(
      ajouterEtiquette(db, { clientId: CLIENT, libelle: "   ", acteur: ADMIN }),
    ).rejects.toThrow();
    expect(await retirerEtiquette(db, { clientId: CLIENT, etiquetteId: "e0", acteur: ADMIN })).toBe(
      true,
    );
    expect(await retirerEtiquette(db, { clientId: CLIENT, etiquetteId: "e0", acteur: ADMIN })).toBe(
      false,
    );
    expect(etiquettes).toEqual([]);
  });

  it("la contrainte unique (course) donne le même message", async () => {
    const { db, brut } = fausseBase();
    brut.clientEtiquette.create.mockRejectedValueOnce(
      Object.assign(new Error("P2002"), { code: "P2002" }),
    );
    await expect(
      ajouterEtiquette(db, { clientId: CLIENT, libelle: "VIP", acteur: ADMIN }),
    ).rejects.toThrow(/déjà sur la fiche/);
  });

  it("ne retire pas l'étiquette d'une autre fiche", async () => {
    const { db, etiquettes } = fausseBase();
    etiquettes.push({ id: "e9", clientId: "autre", libelle: "VIP" });
    expect(await retirerEtiquette(db, { clientId: CLIENT, etiquetteId: "e9", acteur: ADMIN })).toBe(
      false,
    );
    expect(etiquettes).toHaveLength(1);
  });
});
