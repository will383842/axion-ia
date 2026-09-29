/**
 * Un jeton expiré, révoqué, inconnu, ou dont le titulaire a perdu son rôle (ou
 * son compte) est refusé (PR 5) ; le titulaire est REVÉRIFIÉ à chaque appel.
 * Le jeton n'est gardé qu'haché : la base ne permet pas de le retrouver.
 */

import { describe, expect, it } from "vitest";

import {
  authentifierAppareil,
  creerAppareil,
  FORMAT_JETON,
  hacherJeton,
  lireJetonBearer,
} from "../jeton";
import {
  commePrisma,
  fausseBase,
  JOUR,
  semerAppareil,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

describe("un jeton expiré ou d'un rôle retiré est refusé", () => {
  it("jeton valide d'un super-administrateur : accepté", async () => {
    const db = fausseBase();
    const { jeton } = semerAppareil(db);
    const r = await authentifierAppareil(commePrisma(db), jeton, T0);
    expect(r.ok).toBe(true);
  });

  it.each([
    ["expiré", { expireLe: new Date(T0.getTime() - 1) }, "jeton_expire", 401],
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

  it("le jeton créé fait 64 hexadécimaux, n'est stocké qu'haché, et expire à 90 jours", async () => {
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
    expect(cree.expireLe.getTime() - T0.getTime()).toBe(90 * JOUR);
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
