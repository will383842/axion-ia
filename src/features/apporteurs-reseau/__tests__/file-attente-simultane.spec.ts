// « Pas disponible » : prise de ligne ET mise en attente dans UNE transaction sérialisable ; le perdant d'une course
// reçoit le message de réessai (P2034), jamais une troisième déclaration en file.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  options: [] as unknown[],
  envoyes: [] as Array<Record<string, unknown>>,
  mettre: [] as string[],
  echec: false,
  attente: "en_attente" as "en_attente" | "file_complete",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: unknown) => v,
  encryptPii: (v: unknown) => v,
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (v: string) => v }));
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(),
  lireEtablissementParSiret: vi.fn(),
}));
vi.mock("../apercu-envoi", () => ({ apercu: vi.fn() }));
vi.mock("../file-attente", () => ({
  mettreEnAttente: vi.fn(async (_tx: unknown, id: string) => {
    m.mettre.push(id);
    return m.attente;
  }),
  fenetreOuverteParUnAutre: vi.fn(async () => false),
}));
vi.mock("../envois", () => ({
  avecTexteLibre: (p: Record<string, unknown>) => p,
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    m.envoyes.push(e);
    return "envoye";
  }),
}));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    $transaction: async (f: (t: unknown) => unknown, o: unknown) => {
      m.options.push(o);
      if (m.echec) throw Object.assign(new Error("serial"), { code: "P2034" });
      return f(prisma);
    },
    presentationEntreprise: {
      findUnique: vi.fn(async (a: { include?: unknown }) => {
        const base = {
          id: "P2",
          siren: "123456782",
          apporteurId: "APP2",
          statut: "reservee",
          contactEnvoyeAt: null,
          denomination: "Acme",
          recueAt: new Date("2026-10-01T00:00:00Z"),
          personneNom: "Durand",
          personneEmail: "d@acme.fr",
        };
        return a.include
          ? { ...base, apporteur: { id: "APP2", prenom: "Ana", nom: "Bel", email: "ana@x.fr" } }
          : base;
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  return { prisma };
});

import { appliquerReponse } from "../presentations";

const o = { civilite: "" as const, nomFamille: "" };
beforeEach(() => {
  m.options = [];
  m.envoyes = [];
  m.mettre = [];
  m.echec = false;
  m.attente = "en_attente";
});

describe("file-attente — « Pas disponible »", () => {
  it("passe par une transaction sérialisable et met la déclaration en attente", async () => {
    const r = await appliquerReponse("P2", "pas_disponible", o);
    expect(r.ok).toBe(true);
    expect(m.options[0]).toMatchObject({ isolationLevel: "Serializable" });
    expect(m.mettre).toEqual(["P2"]);
    expect((m.envoyes[0]!.payload as Record<string, unknown>).attente).toBe("conservee");
  });

  it("3e déclaration : le message dit file_complete", async () => {
    m.attente = "file_complete";
    await appliquerReponse("P2", "pas_disponible", o);
    expect((m.envoyes[0]!.payload as Record<string, unknown>).attente).toBe("file_complete");
  });

  it("deux réponses simultanées : l'une échoue en P2034 avec le message de réessai, rien n'est envoyé", async () => {
    m.echec = true;
    const r = await appliquerReponse("P2", "pas_disponible", o);
    expect(r).toEqual({
      ok: false,
      message: "Une autre réponse est en cours sur ce SIREN : réessayez dans un instant.",
    });
    expect(m.envoyes).toHaveLength(0);
  });
});

describe("deja-connue-n-entre-pas-en-file", () => {
  it.each(["deja_connue", "hors_champ"] as const)(
    "« %s » n'appelle jamais la mise en attente",
    async (rep) => {
      const r = await appliquerReponse("P2", rep, o);
      expect(r.ok).toBe(true);
      expect(m.mettre).toHaveLength(0);
      expect(m.options).toHaveLength(0);
      expect(m.envoyes[0]!.payload).not.toHaveProperty("attente");
    },
  );
});
