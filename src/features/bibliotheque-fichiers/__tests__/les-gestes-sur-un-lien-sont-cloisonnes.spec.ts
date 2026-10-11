// @vitest-environment node

/**
 * PROLONGER / RETIRER UN LIEN PRIVÉ : CLOISONNÉ PAR RÔLE, TRACÉ (Candidatures unifiées L5, [I3]).
 *
 * Une action serveur s'appelle sans la page : `editor` et `reader` sont refusés
 * DANS l'action, sans toucher au lien. Un geste réussi écrit une ligne
 * `ActivityLog` (identifiant du lien seulement) ; un fichier
 * déposé depuis le composeur n'entre pas dans la bibliothèque.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { session, suivi, depot, journal } = vi.hoisted(() => ({
  session: { courante: null as null | { user: { id: string; role: string; name?: string } } },
  suivi: {
    prolongerLien: vi.fn(async () => ({ ok: true, applicationId: "app-1" })),
    retirerLien: vi.fn(async () => ({ ok: true, applicationId: "app-1" })),
  },
  depot: {
    commencerDepot: vi.fn(async () => ({
      ok: true,
      valeur: { fichierId: "f1", tailleMorceau: 1, nombreMorceaux: 1 },
    })),
  },
  journal: vi.fn(async () => ({})),
}));

vi.mock("@/auth", () => ({ auth: async () => session.courante }));
vi.mock("@/server/partages/suivi", () => suivi);
vi.mock("@/server/partages/depot", () => depot);
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { create: journal } } }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { commencerDepotAction } from "../actions";
import { prolongerLienAction, retirerLienAction } from "../liens-actions";

const LIEN = "11111111-1111-4111-8111-111111111111";

function connecter(role: string | null) {
  session.courante = role === null ? null : { user: { id: "u1", role, name: "Personne" } };
}

beforeEach(() => vi.clearAllMocks());

describe("prolonger et retirer un lien", () => {
  for (const role of ["editor", "reader", "inconnu"]) {
    it(`« ${role} » est refusé, le lien n'est pas touché`, async () => {
      connecter(role);
      expect((await prolongerLienAction(LIEN)).ok).toBe(false);
      expect((await retirerLienAction(LIEN)).ok).toBe(false);
      expect(suivi.prolongerLien).not.toHaveBeenCalled();
      expect(suivi.retirerLien).not.toHaveBeenCalled();
      expect(journal).not.toHaveBeenCalled();
    });
  }

  it("sans session : refus", async () => {
    connecter(null);
    expect((await retirerLienAction(LIEN)).ok).toBe(false);
    expect(suivi.retirerLien).not.toHaveBeenCalled();
  });

  it("un identifiant mal formé est refusé avant tout geste", async () => {
    connecter("admin");
    expect((await retirerLienAction("pas-un-uuid")).ok).toBe(false);
    expect(suivi.retirerLien).not.toHaveBeenCalled();
  });

  for (const role of ["super_admin", "admin", "responsable_qualite", "secretaire"]) {
    it(`« ${role} » prolonge puis retire, chaque geste tracé`, async () => {
      connecter(role);
      expect((await prolongerLienAction(LIEN)).ok).toBe(true);
      expect((await retirerLienAction(LIEN)).ok).toBe(true);
      const actions = journal.mock.calls.map(
        (c) => (c as unknown as [{ data: { action: string; targetId: string } }])[0].data,
      );
      expect(actions).toEqual([
        expect.objectContaining({ action: "lien_partage.prolonge", targetId: LIEN }),
        expect.objectContaining({ action: "lien_partage.retire", targetId: LIEN }),
      ]);
    });
  }
});

describe("déposer depuis le composeur", () => {
  it("un fichier ponctuel n'entre pas dans la bibliothèque ; par défaut, il y entre", async () => {
    connecter("admin");
    await commencerDepotAction({
      nom: "a.zip",
      taille: 10,
      categorie: "rushs",
      dansBibliotheque: false,
    });
    await commencerDepotAction({ nom: "b.zip", taille: 10, categorie: "rushs" });
    const appels = depot.commencerDepot.mock.calls as unknown as Array<
      [{ dansBibliotheque: boolean }]
    >;
    expect(appels.map((c) => c[0].dansBibliotheque)).toEqual([false, true]);
  });
});
