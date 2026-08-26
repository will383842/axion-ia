/**
 * 🔴 CE FICHIER EXISTE PARCE QU'UNE ÉTIQUETTE DE CACHE PEUT ÊTRE DÉCORATIVE.
 *
 * `CALENDLY_SLOTS_TAG` était posée sur la requête depuis l'ADR 0038, documentée
 * « permet une invalidation à la réservation » — et `revalidateTag` ne l'a jamais
 * reçue. Rien ne rougissait : le code compilait, les tests passaient, la page
 * s'affichait. Le seul symptôme était en production, sur `/appel`, et il fallait
 * un chronomètre pour le voir (13 min de décalage mesurées le 2026-08-26).
 *
 * Les tests ci-dessous éprouvent donc ce qu'aucun type ne peut exprimer : que
 * l'étiquette est bel et bien PASSÉE à Next, et que les deux chemins existent.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));

import { CALENDLY_SLOTS_TAG } from "../availability";
import { invaliderCreneaux, CALENDLY_SLOTS_PATHS } from "../revalider-creneaux";

describe("invaliderCreneaux", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
    revalidatePath.mockReset();
  });

  it("passe l'étiquette des créneaux à Next — c'est TOUT le correctif", () => {
    invaliderCreneaux("test");
    // Next 16 exige le profil de cacheLife en second argument. L'oublier ne
    // provoque pas d'erreur de type ici (le mock est permissif) mais casse
    // l'invalidation en vrai, exactement comme l'absence d'appel.
    expect(revalidateTag).toHaveBeenCalledWith(CALENDLY_SLOTS_TAG, "default");
  });

  it("invalide la page de réservation de CHAQUE locale", () => {
    invaliderCreneaux("test");
    // Le segment est traduit (`/appel` en FR, `/book-a-call` en EN) : recopier
    // `/fr/appel` pour l'anglais invaliderait une route qui n'existe pas.
    expect(CALENDLY_SLOTS_PATHS).toContain("/fr/appel");
    for (const chemin of CALENDLY_SLOTS_PATHS) {
      expect(revalidatePath).toHaveBeenCalledWith(chemin);
    }
  });

  it("ne throw JAMAIS — un webhook accepté ne doit pas finir en 500", () => {
    // Un 500 déclencherait un rejeu Calendly, donc une tempête de webhooks sur
    // un incident de cache qui n'a rien à voir avec le traitement métier.
    revalidateTag.mockImplementation(() => {
      throw new Error("hors contexte de requête");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => invaliderCreneaux("webhook")).not.toThrow();
      // ⚠️ Mais surtout PAS EN SILENCE : une invalidation morte se lit
      // exactement comme un agenda à jour. C'est ce qui a coûté quatre semaines.
      expect(err).toHaveBeenCalled();
      const charge = JSON.parse(String(err.mock.calls[0]?.[0])) as Record<string, unknown>;
      expect(charge["event"]).toBe("calendly_slots_revalidate_failed");
      expect(charge["origine"]).toBe("webhook");
    } finally {
      err.mockRestore();
    }
  });
});
