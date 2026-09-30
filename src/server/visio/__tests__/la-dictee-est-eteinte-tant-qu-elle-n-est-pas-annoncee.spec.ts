/**
 * ⛔ LA DICTÉE EST ÉTEINTE TANT QU'ELLE N'EST PAS ANNONCÉE (PR 7, B5, B14).
 *
 * La dictée après un appel repose sur l'intérêt légitime (6.1.f) : elle doit
 * être ANNONCÉE par la notice avant de servir. Tant que `DICTEE_ANNONCEE`
 * (source unique `visio-annonce.ts`, dérivée de l'annonce publique) vaut faux,
 * `POST /api/enregistreur/sessions` en `nature = "dictee"` répond 503
 * `dictee_non_annoncee` et rien n'est créé ; l'extension détruit alors son son
 * au lieu de réessayer (`tests/unit/extension-enregistreur/la-dictee-eteinte-detruit-le-son-sans-reessayer.spec.ts` :
 * les tests qui importent l'extension vivent hors de `src/`, l'image Docker ne la porte pas).
 *
 * Une fois annoncée, la dictée démarre `en_cours` SANS étape de consentement.
 *
 * Mutation qui rougit : remettre `motive("hors_liste_blanche")` (409) pour la
 * dictée, ou démarrer la dictée en `accord_en_attente`.
 * Contre-témoin : la même rencontre en visio n'est pas touchée par ce 503.
 * Angle mort : l'opposition et le préavis passent AVANT (tests
 * `une-opposition-bloque…`, `un-client-actif-n-est-pas-enregistre…`).
 */

import { describe, expect, it } from "vitest";

import { creerOuReprendreSession, CODE_DICTEE_ETEINTE } from "../sessions";
import { DICTEE_ANNONCEE } from "../visio-annonce";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  semerAppareil,
  semerRencontreTest,
  MINUTE,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

const APRES_LE_RENDEZ_VOUS = new Date(T0.getTime() + 60 * MINUTE);

function preparer() {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const { rencontreId } = semerRencontreTest(db);
  return { db, appareil: { id: appareilId, adminUserId }, rencontreId };
}

describe("⛔ la dictée est éteinte tant qu'elle n'est pas annoncée", () => {
  it("aujourd'hui, la notice ne l'annonce pas", () => {
    expect(DICTEE_ANNONCEE).toBe(false);
  });

  it("POST sessions en dictée : 503 dictee_non_annoncee, rien de créé", async () => {
    const { db, appareil, rencontreId } = preparer();
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil,
      corps: corpsSession(rencontreId, { nature: "dictee" }),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.statut).toBe(503);
    expect(r.corps["erreur"]).toBe(CODE_DICTEE_ETEINTE);
    expect(db.lignes("enregistrement")).toHaveLength(0);
  });

  it("annoncée : la dictée démarre en cours, sans accord ni preuve d'accord", async () => {
    const { db, appareil, rencontreId } = preparer();
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil,
      corps: corpsSession(rencontreId, { nature: "dictee" }),
      mode: "pilote",
      // Après la fin prévue du rendez-vous (T0 + 50 min) : la dictée suit l'appel.
      maintenant: APRES_LE_RENDEZ_VOUS,
      dicteeAnnoncee: true,
    });
    expect(r.statut).toBe(200);
    expect(r.corps["statut"]).toBe("en_cours");
    const [enr] = db.lignes("enregistrement");
    expect(enr?.["nature"]).toBe("dictee");
    expect(enr?.["accordConfirmeLe"]).toBeNull();
    expect(db.lignes("enregistrementConsentement")).toHaveLength(0);
  });

  it("contre-témoin : la visio de la même rencontre n'est pas concernée", async () => {
    const { db, appareil, rencontreId } = preparer();
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil,
      corps: corpsSession(rencontreId),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.statut).toBe(200);
    expect(r.corps["statut"]).toBe("accord_en_attente");
  });
});
