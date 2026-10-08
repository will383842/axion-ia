import { beforeEach, describe, expect, it, vi } from "vitest";

// « Corriger le nom » (2026-10-08) : un nom de naissance à la place du nom d'usage. Corrigible
// depuis la console tant que le contrat n'est pas signé ; chiffré ; tracé sans nom en clair.

const etat = vi.hoisted(() => ({
  apporteur: null as null | { prenom: string; nom: string; signeParApporteurAt: Date | null },
  journal: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `ENC(${v})`,
  decryptPii: (v: string | null) => (v ? v.replace(/^ENC\((.*)\)$/, "$1") : v),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: vi.fn(async () => (etat.apporteur ? { ...etat.apporteur } : null)),
      updateMany: vi.fn(
        async (a: { where: { signeParApporteurAt: null }; data: Record<string, string> }) => {
          if (!etat.apporteur || etat.apporteur.signeParApporteurAt) return { count: 0 };
          Object.assign(etat.apporteur, a.data);
          return { count: 1 };
        },
      ),
    },
    activityLog: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.journal.push(a.data);
        return {};
      }),
    },
  },
}));

import { corrigerNomApporteur, REFUS_CONTRAT_SIGNE } from "../correction-nom";

const corriger = (prenom: string, nom: string) =>
  corrigerNomApporteur({ apporteurId: "A1", prenom, nom, acteurId: "admin-1" });

beforeEach(() => {
  etat.apporteur = { prenom: "ENC(Delphine)", nom: "ENC(Bouhali)", signeParApporteurAt: null };
  etat.journal = [];
});

describe("corriger le nom d'un apporteur", () => {
  it("avant la signature : nom corrigé, CHIFFRÉ, tracé sans nom en clair", async () => {
    expect(await corriger("Delphine", "  Marcheti ")).toMatchObject({ ok: true });
    expect(etat.apporteur).toMatchObject({ prenom: "ENC(Delphine)", nom: "ENC(Marcheti)" });
    expect(etat.journal[0]).toMatchObject({
      adminUserId: "admin-1",
      action: "apporteur_reseau.nom_corrige",
      targetId: "A1",
      changes: {
        avant: { prenom: "ENC(Delphine)", nom: "ENC(Bouhali)" },
        apres: { prenom: "ENC(Delphine)", nom: "ENC(Marcheti)" },
      },
    });
    expect(JSON.stringify(etat.journal)).not.toMatch(/"Marcheti"|"Bouhali"/);
  });

  it("contrat SIGNÉ : refusé, rien n'est modifié ni tracé (le nom est dans le PDF signé)", async () => {
    etat.apporteur!.signeParApporteurAt = new Date("2026-10-07T10:00:00Z");
    const r = await corriger("Delphine", "Marcheti");
    expect(r).toEqual({ ok: false, message: REFUS_CONTRAT_SIGNE });
    expect(etat.apporteur!.nom).toBe("ENC(Bouhali)");
    expect(etat.journal).toHaveLength(0);
  });

  it("saisies refusées : vide, chiffres ou symboles, trop long, rien de changé", async () => {
    expect(await corriger("", "Marcheti")).toMatchObject({ ok: false });
    expect(await corriger("Delphine", "Marcheti2")).toMatchObject({ ok: false });
    expect(await corriger("Delphine", "<b>x</b>")).toMatchObject({ ok: false });
    expect(await corriger("Delphine", "a".repeat(81))).toMatchObject({ ok: false });
    expect(await corriger("Delphine", "Bouhali")).toMatchObject({ ok: false });
    expect(etat.journal).toHaveLength(0);
  });

  it("noms composés acceptés (trait d'union, apostrophe, accents)", async () => {
    expect(await corriger("Anne-Sophie", "D'Arcy-Lefèvre")).toMatchObject({ ok: true });
  });
});
