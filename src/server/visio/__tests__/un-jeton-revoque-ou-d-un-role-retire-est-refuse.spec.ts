/**
 * Un jeton révoqué, inconnu, ou dont le titulaire a perdu son rôle (ou son
 * compte) est refusé (PR 5) ; le titulaire est REVÉRIFIÉ à chaque appel.
 * Le jeton n'est gardé qu'haché : la base ne permet pas de le retrouver.
 *
 * Révision du 02/10 (décision de Williams) : le jeton n'EXPIRE plus. Il vaut
 * jusqu'à sa révocation. Un jeton créé avant la révision, dont les 90 jours
 * d'origine sont dépassés, est ACCEPTÉ tant qu'il n'est pas révoqué.
 *
 * Mutation qui rougit : remettre le refus sur `expireLe` dans
 * `authentifierAppareil` → le cas « 90 jours dépassés » rougit.
 */

import { describe, expect, it } from "vitest";

import {
  authentifierAppareil,
  creerAppareil,
  FORMAT_JETON,
  hacherJeton,
  JETON_SANS_EXPIRATION,
  lireJetonBearer,
} from "../jeton";
import {
  commePrisma,
  fausseBase,
  JOUR,
  semerAppareil,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("un jeton révoqué ou d'un rôle retiré est refusé", () => {
  it("jeton valide d'un super-administrateur : accepté", async () => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db);
    const r = await authentifierAppareil(commePrisma(db), jeton, T0);
    expect(r.ok).toBe(true);
  });

  it("jeton d'avant la révision, 90 jours dépassés, non révoqué : ACCEPTÉ", async () => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db, { expireLe: new Date(T0.getTime() - 30 * JOUR) });
    const r = await authentifierAppareil(commePrisma(db), jeton, T0);
    expect(r.ok).toBe(true);
    // L'extension ne reçoit jamais l'ancienne date : elle la bloquerait localement.
    if (r.ok) expect(r.appareil.expireLe).toEqual(JETON_SANS_EXPIRATION);
  });

  it("le même jeton ancien, révoqué : refusé", async () => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db, {
      expireLe: new Date(T0.getTime() - 30 * JOUR),
      revoqueLe: new Date(T0.getTime() - JOUR),
    });
    const r = await authentifierAppareil(commePrisma(db), jeton, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toBe("jeton_revoque");
  });

  it.each([
    ["révoqué", { revoqueLe: new Date(T0.getTime() - JOUR) }, "jeton_revoque", 401],
    ["rôle retiré (rédacteur)", { role: "editor" }, "titulaire_non_habilite", 403],
    [
      "rôle retiré (responsable qualité)",
      { role: "responsable_qualite" },
      "titulaire_non_habilite",
      403,
    ],
    ["compte suspendu", { status: "suspended" }, "titulaire_non_habilite", 403],
  ] as const)("%s → %s", async (_nom, options, erreur, statut) => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db, options);
    const r = await authentifierAppareil(commePrisma(db), jeton, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreur).toBe(erreur);
      expect(r.statut).toBe(statut);
    }
  });

  it("jeton inconnu : 401", async () => {
    const db = fausseBase();
    semerAppareil(db);
    const r = await authentifierAppareil(commePrisma(db), "f".repeat(64), T0);
    expect(r.ok).toBe(false);
  });

  it("le jeton créé fait 64 hexadécimaux, n'est stocké qu'haché, et n'expire pas", async () => {
    const db = fausseBase();
    const cree = await creerAppareil(commePrisma(db), {
      nom: "Poste",
      adminUserId: "u",
      maintenant: T0,
    });
    expect(cree.jeton).toMatch(FORMAT_JETON);
    const ligne = db.lignes("appareilEnregistrement")[0];
    expect(ligne?.["jetonHash"]).toBe(hacherJeton(cree.jeton));
    expect(JSON.stringify(ligne)).not.toContain(cree.jeton);
    // Colonne NON nulle en base : la date sentinelle, jamais une durée.
    expect(cree.expireLe).toEqual(JETON_SANS_EXPIRATION);
    expect(ligne?.["expireLe"]).toEqual(new Date("9999-12-31T00:00:00.000Z"));
  });

  it("seul « Bearer <64 hex> » est lu", () => {
    const j = "a".repeat(64);
    expect(lireJetonBearer(`Bearer ${j}`)).toBe(j);
    expect(lireJetonBearer(`bearer ${j}`)).toBeNull();
    expect(lireJetonBearer(`Bearer ${j}0`)).toBeNull();
    expect(lireJetonBearer(`Basic ${j}`)).toBeNull();
    expect(lireJetonBearer(null)).toBeNull();
  });
});
