/**
 * Une dictée démarre sans accord et s'arrête à 5 minutes (extension, PR 7).
 *
 * « Dicter une note » : micro SEUL (`micSeul`), sur la rencontre choisie, sans
 * étape de consentement — la session est créée en `nature = "dictee"` et le
 * son part avec elle. La capture s'arrête d'elle-même à 5 minutes ; aucune
 * règle de la visio (piste client muette, salle quittée, personne de plus)
 * ne s'applique.
 *
 * Mutation qui rougit : démarrer la dictée en `accord_en_attente`, capturer
 * l'onglet, ou oublier la borne des 5 minutes.
 * Contre-témoin : sans rendez-vous choisi, la dictée est refusée.
 */

import { describe, expect, it } from "vitest";

import {
  demarrerDictee,
  DUREE_MAX_DICTEE_MS,
  etatInitial,
  tic,
} from "../../../extensions/enregistreur-meet/lib/etats-capture.js";

const JETON = "a".repeat(64);
const EXPIRE = "2027-01-01T00:00:00.000Z";
const T0 = Date.parse("2026-10-06T10:00:00Z");

describe("une dictée démarre sans accord et s'arrête à 5 minutes", () => {
  const d = demarrerDictee(
    etatInitial(),
    { jeton: JETON, jetonExpireLe: EXPIRE, cleClient: "cle-1", rencontreId: "r-1" },
    T0,
  );

  it("en cours tout de suite, micro seul, session de nature dictée", () => {
    expect(d.etat.phase).toBe("en_cours");
    expect(d.etat.nature).toBe("dictee");
    expect(d.actions).toEqual([
      { type: "demarrer_capture", micSeul: true },
      { type: "creer_session", debutMs: T0, nature: "dictee" },
    ]);
  });

  it("aucune règle de visio : pas de badge, pas d'arrêt pour « salle quittée »", () => {
    const r = tic(
      d.etat,
      { niveauClient: 0, niveauAxion: 0, nbParticipants: 5, dansLaSalle: false },
      T0 + 180_000,
    );
    expect(r.actions).toEqual([]);
    expect(r.etat.phase).toBe("en_cours");
  });

  it("arrêt automatique à 5 minutes", () => {
    const r = tic(
      d.etat,
      { niveauClient: 0, niveauAxion: 0.1, nbParticipants: 1, dansLaSalle: true },
      T0 + DUREE_MAX_DICTEE_MS,
    );
    expect(r.etat.phase).toBe("termine");
    expect(r.actions.map((a) => a.type)).toEqual(["arreter_capture", "terminer_session"]);
  });

  it("contre-témoin : sans rendez-vous choisi, refusée", () => {
    const r = demarrerDictee(
      etatInitial(),
      { jeton: JETON, jetonExpireLe: EXPIRE, cleClient: "cle-2", rencontreId: null },
      T0,
    );
    expect(r.etat.phase).toBe("repos");
    expect(r.actions[0]?.type).toBe("refuser");
  });
});
