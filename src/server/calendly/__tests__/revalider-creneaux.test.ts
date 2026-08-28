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

import { defaultConfig } from "next/dist/server/config-shared";

import { CALENDLY_SLOTS_TAG } from "../availability";
import { invaliderCreneaux, CALENDLY_SLOTS_PATHS } from "../revalider-creneaux";

/**
 * Les profils de cache de Next, lus dans SA configuration et non recopiés.
 *
 * C'est ce qui permet au test ci-dessous d'éprouver une PROPRIÉTÉ (« ce profil
 * expire-t-il ? ») plutôt qu'une chaîne. Une valeur recopiée ici deviendrait
 * fausse le jour où Next la change, sans que rien ne le dise.
 */
const PROFILS = defaultConfig.cacheLife as unknown as Record<string, { expire?: number }>;

describe("invaliderCreneaux", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
    revalidatePath.mockReset();
  });

  it("passe l'étiquette des créneaux à Next", () => {
    invaliderCreneaux("test");
    expect(revalidateTag).toHaveBeenCalledWith(CALENDLY_SLOTS_TAG, expect.anything());
  });

  it("passe un profil qui EXPIRE VRAIMENT — pas seulement « périmé »", () => {
    // 🔴 CE CAS REMPLACE UN TEST QUI VERROUILLAIT LE DÉFAUT.
    //
    // Il assertait littéralement `toHaveBeenCalledWith(TAG, "default")`, sous le
    // titre « c'est TOUT le correctif ». Or `"default"` ne purge rien : Next
    // marque l'entrée *périmée* et sert la version périmée au visiteur suivant.
    // Le test était donc vert précisément parce que le code était faux, et
    // corriger le code l'aurait fait rougir — le pire état pour une garde.
    //
    // On ne compare plus une CHAÎNE : on résout le profil dans la configuration
    // de Next et on éprouve la seule propriété qui compte, `expire === 0`.
    invaliderCreneaux("test");
    const profil = revalidateTag.mock.calls[0]?.[1];
    const expire =
      typeof profil === "object" && profil !== null
        ? (profil as { expire?: number }).expire
        : PROFILS[String(profil)]?.expire;

    expect(
      expire,
      `le profil passé (${JSON.stringify(profil)}) n'expire pas : Next servira la ` +
        `liste de créneaux PÉRIMÉE au visiteur suivant`,
    ).toBe(0);
  });

  it("témoin : les profils nommés de Next n'expirent PAS", () => {
    // Cas-témoin qui garde le précédent honnête. Si celui-ci rougit un jour,
    // c'est Next qui a changé la sémantique de ses profils — pas nous. Sans lui,
    // on ne saurait pas distinguer les deux causes.
    expect(PROFILS["default"]?.expire).toBeGreaterThan(0);
    expect(PROFILS["max"]?.expire).toBeGreaterThan(0);
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
