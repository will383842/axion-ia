/**
 * Saisie et suppression d'une dépense — la garde de session et de rôle, la
 * validation côté serveur, et ce qui est réellement écrit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

class Redirection extends Error {
  constructor(public readonly vers: string) {
    super(`REDIRECT ${vers}`);
  }
}
const creer = vi.fn(async (..._a: unknown[]) => ({}));
const supprimer = vi.fn(async (..._a: unknown[]) => ({ count: 1 }));
let session: unknown = { user: { email: "will@axion-ia.com", role: "admin" } };

vi.mock("next/navigation", () => ({
  redirect: (vers: string) => {
    throw new Redirection(vers);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => session }));
vi.mock("@/lib/admin-path", () => ({
  adminPath: (_l: string, p: string) => `/fr/console/${p}`,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    acquisitionSpend: {
      create: (...a: unknown[]) => creer(...a),
      deleteMany: (...a: unknown[]) => supprimer(...a),
    },
  },
}));

import { ajouterDepenseAction, supprimerDepenseAction } from "../depenses-actions";

function form(o: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const VALIDE = {
  spentOn: "2026-10-01",
  canal: "facebook",
  campagne: "apporteurs-video",
  montantEuros: "12,50",
  note: "semaine 40",
};

async function vers(p: Promise<void>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirection) return e.vers;
    throw e;
  }
  return "";
}

beforeEach(() => {
  creer.mockClear();
  supprimer.mockClear();
  session = { user: { email: "will@axion-ia.com", role: "admin" } };
});

describe("ajouterDepenseAction", () => {
  it("écrit la ligne en centimes, avec l'adresse de qui a saisi, puis revient avec un message", async () => {
    const r = await vers(ajouterDepenseAction(form(VALIDE)));
    expect(r).toBe("/fr/console/tunnels/apporteurs?depense=ok");
    expect(creer).toHaveBeenCalledTimes(1);
    expect(creer.mock.calls[0]?.[0]).toMatchObject({
      data: {
        canal: "facebook",
        campagne: "apporteurs-video",
        montantCentimes: 1250,
        note: "semaine 40",
        createdByEmail: "will@axion-ia.com",
      },
    });
  });

  it("refuse un montant hors bornes, une date future, un canal inconnu — rien n'est écrit", async () => {
    for (const mauvais of [
      { montantEuros: "100001" },
      { montantEuros: "abc" },
      { spentOn: "2999-01-01" },
      { canal: "tiktok" },
    ]) {
      const r = await vers(ajouterDepenseAction(form({ ...VALIDE, ...mauvais })));
      expect(r).toContain("?erreur=");
    }
    expect(creer).not.toHaveBeenCalled();
  });

  it("sans session : renvoyée à la connexion, rien d'écrit", async () => {
    session = null;
    expect(await vers(ajouterDepenseAction(form(VALIDE)))).toBe("/fr/console/login");
    expect(creer).not.toHaveBeenCalled();
  });

  it("un rôle de consultation (lecteur) ne saisit pas", async () => {
    session = { user: { email: "lecteur@axion-ia.com", role: "reader" } };
    expect(await vers(ajouterDepenseAction(form(VALIDE)))).toContain("?erreur=");
    expect(creer).not.toHaveBeenCalled();
  });

  it("une panne d'écriture est dite, pas avalée", async () => {
    creer.mockRejectedValueOnce(new Error("base indisponible"));
    expect(await vers(ajouterDepenseAction(form(VALIDE)))).toContain("?erreur=");
  });
});

describe("supprimerDepenseAction", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("supprime la ligne désignée", async () => {
    expect(await vers(supprimerDepenseAction(form({ id: ID })))).toBe(
      "/fr/console/tunnels/apporteurs?depense=supprimee",
    );
    expect(supprimer).toHaveBeenCalledWith({ where: { id: ID } });
  });

  it("refuse un identifiant mal formé", async () => {
    expect(await vers(supprimerDepenseAction(form({ id: "1; DROP TABLE" })))).toContain("?erreur=");
    expect(supprimer).not.toHaveBeenCalled();
  });

  it("refuse sans session et pour un lecteur", async () => {
    session = null;
    await vers(supprimerDepenseAction(form({ id: ID })));
    session = { user: { email: "l@axion-ia.com", role: "reader" } };
    await vers(supprimerDepenseAction(form({ id: ID })));
    expect(supprimer).not.toHaveBeenCalled();
  });
});
