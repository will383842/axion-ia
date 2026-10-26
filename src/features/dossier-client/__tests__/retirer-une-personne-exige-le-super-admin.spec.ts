/**
 * Les actions du retrait d'UNE personne (ordre de Will du 26/10/2026) : super-administrateur seul,
 * mot EFFACER (1re étape) puis jeton et code recopié (2e étape), vérifiés AVANT tout appel au
 * retrait. Rien n'est supprimé ici : le retrait est simulé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  acces: vi.fn(),
  preparer: vi.fn(),
  retirer: vi.fn(),
}));

vi.mock("@/features/dossier-client/acces", () => ({
  exigerAccesEchanges: m.acces,
  AccesRefuse: class AccesRefuse extends Error {},
}));
vi.mock("@/features/dossier-client/suppression-manuelle", () => ({
  MOT_CONFIRMATION: "EFFACER",
  supprimerManuellement: vi.fn(),
  preparerSuppression: vi.fn(),
}));
vi.mock("@/features/dossier-client/retrait-personne", () => ({
  preparerRetraitPersonne: m.preparer,
  retirerPersonne: m.retirer,
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/admin${p}` }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import { preparerRetraitPersonneAction, retirerPersonneAction } from "../actions-suppression";

const PID = "55555555-5555-4555-8555-555555555555";
const PAGE = "/fr/admin/qualiopi/clients/11111111-1111-4111-8111-111111111111";

const formulaire = (champs: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
};
const redirection = async (fd: FormData, action: (fd: FormData) => Promise<void>) => {
  try {
    await action(fd);
  } catch (e) {
    return decodeURIComponent((e as Error).message);
  }
  throw new Error("aucune redirection");
};

beforeEach(() => {
  m.acces.mockReset();
  m.preparer.mockReset();
  m.retirer.mockReset();
  m.acces.mockResolvedValue({ userId: "u1", role: "super_admin" });
  m.preparer.mockResolvedValue({ ok: true, jeton: "jeton.signe" });
  m.retirer.mockResolvedValue({
    ok: true,
    clientId: "c",
    compteurs: [
      { libelle: "personne", n: 1 },
      { libelle: "adresse(s) e-mail", n: 0 },
    ],
  });
});

describe("mauvais rôle : ni jeton, ni retrait", () => {
  it.each(["admin", "responsable_qualite", "lecteur"])("%s", async (role) => {
    m.acces.mockResolvedValue({ userId: "u2", role });
    const a = await redirection(
      formulaire({ contactId: PID, page: PAGE, confirmation: "EFFACER" }),
      preparerRetraitPersonneAction,
    );
    const b = await redirection(
      formulaire({ contactId: PID, page: PAGE, jeton: "j.s", code: "X" }),
      retirerPersonneAction,
    );
    for (const u of [a, b]) {
      expect(u).toContain("Seul Williams (super-administrateur) peut retirer une personne.");
      expect(u).toContain(`onglet=personnes&retirer=${PID}`);
    }
    expect(m.preparer).not.toHaveBeenCalled();
    expect(m.retirer).not.toHaveBeenCalled();
  });
});

describe("double validation", () => {
  it("1re étape sans EFFACER : refusée ; avec : écran de la 2e étape", async () => {
    const non = await redirection(
      formulaire({ contactId: PID, page: PAGE, confirmation: "effacer" }),
      preparerRetraitPersonneAction,
    );
    expect(non).toContain("Écrivez EFFACER pour confirmer le retrait.");
    expect(m.preparer).not.toHaveBeenCalled();
    const oui = await redirection(
      formulaire({ contactId: PID, page: PAGE, confirmation: "EFFACER" }),
      preparerRetraitPersonneAction,
    );
    expect(oui).toBe(
      `REDIRECT:${PAGE}?onglet=personnes&retirer=${PID}&jeton=jeton.signe#retrait-${PID}`,
    );
    expect(m.retirer).not.toHaveBeenCalled();
  });

  it("2e étape sans jeton ou sans code : rien n'est appelé", async () => {
    await redirection(formulaire({ contactId: PID, page: PAGE, code: "X" }), retirerPersonneAction);
    await redirection(
      formulaire({ contactId: PID, page: PAGE, jeton: "j.s" }),
      retirerPersonneAction,
    );
    expect(m.retirer).not.toHaveBeenCalled();
  });

  it("2e étape complète : retrait, retour sur l'onglet Personnes", async () => {
    const u = await redirection(
      formulaire({ contactId: PID, page: PAGE, jeton: "j.s", code: "55555555" }),
      retirerPersonneAction,
    );
    expect(m.retirer).toHaveBeenCalledWith({
      contactId: PID,
      acteurId: "u1",
      jeton: "j.s",
      code: "55555555",
    });
    expect(u).toContain(`${PAGE}?onglet=personnes&message=Personne retirée : 1 personne.`);
  });

  it("une page extérieure n'est jamais suivie", async () => {
    const u = await redirection(
      formulaire({ contactId: PID, page: "https://ailleurs.example", confirmation: "EFFACER" }),
      preparerRetraitPersonneAction,
    );
    expect(u.startsWith("REDIRECT:/fr/admin/qualiopi/clients?onglet=personnes")).toBe(true);
  });
});
