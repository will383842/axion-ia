/**
 * L'action « Supprimer définitivement » (demande de Will du 25/10/2026) : super-administrateur
 * seul et mot EFFACER, vérifiés AVANT tout appel à la suppression. Rien n'est supprimé ici : la
 * suppression est simulée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  acces: vi.fn(),
  supprimer: vi.fn(),
}));

vi.mock("@/features/dossier-client/acces", () => ({
  exigerAccesEchanges: m.acces,
  AccesRefuse: class AccesRefuse extends Error {},
}));
vi.mock("@/features/dossier-client/suppression-manuelle", () => ({
  MOT_CONFIRMATION: "EFFACER",
  supprimerManuellement: m.supprimer,
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/admin${p}` }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import { supprimerManuellementAction } from "../actions-suppression";

const ID = "11111111-1111-4111-8111-111111111111";
const PAGE = `/fr/admin/qualiopi/clients/${ID}`;

const formulaire = (champs: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
};
const redirection = async (fd: FormData): Promise<string> => {
  try {
    await supprimerManuellementAction(fd);
  } catch (e) {
    return decodeURIComponent((e as Error).message);
  }
  throw new Error("aucune redirection");
};

beforeEach(() => {
  m.acces.mockReset();
  m.supprimer.mockReset();
  m.acces.mockResolvedValue({ userId: "u1", role: "super_admin" });
  m.supprimer.mockResolvedValue({ ok: true, compteurs: [{ libelle: "fiche client", n: 1 }] });
});

describe("l'action de suppression manuelle", () => {
  const base = { type: "client", id: ID, page: PAGE, confirmation: "EFFACER" };

  it("refusée sans super-administrateur : la suppression n'est jamais appelée", async () => {
    m.acces.mockResolvedValue({ userId: "u2", role: "admin" });
    const u = await redirection(formulaire(base));
    expect(u).toContain(`${PAGE}?supprimer=client&erreur=`);
    expect(u).toContain("Seul Williams (super-administrateur) peut supprimer.");
    expect(m.supprimer).not.toHaveBeenCalled();
  });

  it("refusée sans le mot EFFACER", async () => {
    const u = await redirection(formulaire({ ...base, confirmation: "oui" }));
    expect(u).toContain("Écrivez EFFACER pour confirmer la suppression.");
    expect(m.supprimer).not.toHaveBeenCalled();
  });

  it("un refus de la base (autre donnée liée) revient sur l'écran de confirmation", async () => {
    m.supprimer.mockResolvedValue({ ok: false, motif: "Suppression impossible : 1 devis" });
    const u = await redirection(formulaire(base));
    expect(u).toContain(`${PAGE}?supprimer=client&erreur=Suppression impossible : 1 devis`);
  });

  it("succès : la fiche supprimée renvoie vers la liste des clients, avec le résumé", async () => {
    const u = await redirection(formulaire(base));
    expect(m.supprimer).toHaveBeenCalledWith({
      type: "client",
      id: ID,
      acteurId: "u1",
      confirmation: "EFFACER",
    });
    expect(u).toContain("/fr/admin/qualiopi/clients?message=Supprimé : 1 fiche client.");
  });

  it("double clic : « déjà supprimé » vers la liste, jamais une page disparue (404)", async () => {
    m.supprimer.mockResolvedValue({ ok: true, compteurs: [], dejaSupprime: true });
    const u = await redirection(formulaire(base));
    expect(u).toContain("/fr/admin/qualiopi/clients?message=Déjà supprimé");
    expect(u).not.toContain(`clients/${ID}`);
  });

  it("type ou identifiant inconnu, page extérieure : rien n'est appelé", async () => {
    expect(await redirection(formulaire({ ...base, type: "facture" }))).toBe(
      "REDIRECT:/fr/admin/rendez-vous",
    );
    const u = await redirection(
      formulaire({ ...base, page: "https://ailleurs.example/x", confirmation: "non" }),
    );
    expect(u).toContain("REDIRECT:/fr/admin/rendez-vous?supprimer=client");
    expect(m.supprimer).not.toHaveBeenCalled();
  });
});
