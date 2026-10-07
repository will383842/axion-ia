// @vitest-environment node

/**
 * LES ACTIONS DE LA BIBLIOTHÈQUE SONT CLOISONNÉES PAR RÔLE (ADR 0065 D10, plan [I3]).
 *
 * Une action serveur s'appelle SANS la page : le refus de `editor` et `reader`
 * doit tenir dans l'ACTION. Mêmes rôles que les dossiers des candidats
 * (`ROLES_DOSSIER_CANDIDAT`). Un refus n'appelle JAMAIS le dépôt ; un geste
 * réussi écrit une ligne `ActivityLog`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { session, depot, journal } = vi.hoisted(() => {
  const ok = (valeur: unknown) => vi.fn(async () => ({ ok: true, valeur }));
  return {
    session: { courante: null as null | { user: { id: string; role: string; name?: string } } },
    depot: {
      commencerDepot: ok({ fichierId: "f1", tailleMorceau: 1, nombreMorceaux: 1 }),
      signerMorceaux: ok([]),
      reprendreDepot: ok({ recus: [] }),
      terminerDepot: ok({ fichierId: "f1" }),
      abandonnerDepot: ok({ fichierId: "f1" }),
      ajouterLienExterne: ok({ fichierId: "f1" }),
      archiverFichier: ok({ fichierId: "f1" }),
      reafficherFichier: ok({ fichierId: "f1" }),
    },
    journal: vi.fn(async () => ({})),
  };
});

vi.mock("@/auth", () => ({ auth: async () => session.courante }));
vi.mock("@/server/partages/depot", () => depot);
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { create: journal } } }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import {
  abandonnerDepotAction,
  ajouterLienAction,
  archiverFichierAction,
  commencerDepotAction,
  reafficherFichierAction,
  reprendreDepotAction,
  signerMorceauxAction,
  terminerDepotAction,
} from "../actions";

const ID = "11111111-1111-4111-8111-111111111111";
const DEMANDE = { nom: "a.cube", taille: 10, categorie: "lut" };

function connecter(role: string | null) {
  session.courante = role === null ? null : { user: { id: "u1", role, name: "Personne" } };
}

function formulaire(): FormData {
  const f = new FormData();
  f.set("fichierId", ID);
  return f;
}

async function toutesLesActionsJson() {
  return Promise.all([
    commencerDepotAction(DEMANDE),
    signerMorceauxAction(ID, [1]),
    reprendreDepotAction(ID),
    terminerDepotAction(ID),
    abandonnerDepotAction(ID),
    ajouterLienAction({ url: "https://drive.google.com/x", titre: "x", categorie: "rushs" }),
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("les actions de la bibliothèque sont cloisonnées par rôle", () => {
  for (const role of ["editor", "reader", "inconnu"]) {
    it(`« ${role} » est refusé sur chaque action, sans toucher au dépôt`, async () => {
      connecter(role);
      for (const r of await toutesLesActionsJson()) {
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.erreur).toMatch(/rôle/);
      }
      await expect(archiverFichierAction(formulaire())).rejects.toThrow(/retour=refus/);
      await expect(reafficherFichierAction(formulaire())).rejects.toThrow(/retour=refus/);
      for (const f of Object.values(depot)) expect(f).not.toHaveBeenCalled();
      expect(journal).not.toHaveBeenCalled();
    });
  }

  it("sans session : refus « reconnectez-vous »", async () => {
    connecter(null);
    const r = await commencerDepotAction(DEMANDE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/reconnectez-vous/);
    expect(depot.commencerDepot).not.toHaveBeenCalled();
  });

  for (const role of ["super_admin", "admin", "responsable_qualite", "secretaire"]) {
    it(`« ${role} » peut déposer, et le geste est tracé`, async () => {
      connecter(role);
      const r = await commencerDepotAction(DEMANDE);
      expect(r.ok).toBe(true);
      expect(depot.commencerDepot).toHaveBeenCalledTimes(1);
      expect(journal).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminUserId: "u1",
          action: "fichier_partage.depot_commence",
          targetType: "fichier_partage",
          targetId: "f1",
        }),
      });
    });
  }

  it("archiver et réafficher sont tracés, chacun par son nom", async () => {
    connecter("secretaire");
    await expect(archiverFichierAction(formulaire())).rejects.toThrow(/retour=archive/);
    await expect(reafficherFichierAction(formulaire())).rejects.toThrow(/retour=reaffiche/);
    const actions = journal.mock.calls.map(
      (c) => (c as unknown as [{ data: { action: string } }])[0].data.action,
    );
    expect(actions).toEqual(["fichier_partage.archive", "fichier_partage.reaffiche"]);
  });

  it("une demande mal formée est refusée avant le dépôt", async () => {
    connecter("admin");
    expect((await reprendreDepotAction("pas-un-uuid")).ok).toBe(false);
    expect((await commencerDepotAction({ nom: "a", taille: -1, categorie: "lut" })).ok).toBe(false);
    expect(depot.reprendreDepot).not.toHaveBeenCalled();
    expect(depot.commencerDepot).not.toHaveBeenCalled();
  });
});
