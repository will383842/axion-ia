// @formateurs V2-S11 (vérification n° 2, sécurité) — Interrupteurs hors règles.
//
// Par les actions réelles de la console : un `admin` ne touche pas la clé du
// super-administrateur ; un `editor`, un `reader` ou personne ne touchent aucune
// clé ; l'éditeur de réglages général refuse `signature.*` et `textes_valides.*`
// (toutes casses) ; chaque clé refuse de s'allumer sans ses préalables.
//
// Défaut consigné (`test.fixme`, cf. le rapport de la PR) :
//   · V2-S-2 — deux clics simultanés (allumer une fille, couper sa mère)
//     laissent la fille allumée sous une mère coupée.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { scenarioV2 } from "../fixtures/formateurs/v2s-commun";

type Etat = { ok: boolean; error?: string };
interface Observations {
  roles: Record<string, Etat>;
  general: Record<string, Etat>;
  prealables: Record<string, Etat>;
  allumees: Record<string, boolean>;
  essais: number;
  violations: number;
  ecritesParAdmin: number;
}

test.describe("@formateurs V2-S11 — écrire un interrupteur hors de ses règles", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await scenarioV2<Observations>("v2s11-interrupteurs");
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("rôles : admin sur la clé super-admin, editor, reader, sans session — refusés", () => {
    expect(Object.keys(o.roles)).toHaveLength(5);
    for (const [cas, r] of Object.entries(o.roles)) expect(r.ok, cas).toBe(false);
    expect(o.roles["admin coupe textes_valides"]?.error).toContain("super-admin");
    expect(o.roles["sans session allume echange_ouvert"]?.error).toBe("Session expirée.");
    expect(o.ecritesParAdmin).toBe(0);
  });

  test("éditeur de réglages général : `signature.*` et `textes_valides.*` refusées", () => {
    expect(Object.keys(o.general)).toHaveLength(12);
    for (const [cas, r] of Object.entries(o.general)) expect(r.ok, cas).toBe(false);
  });

  test("aucune clé ne s'allume sans ses préalables", () => {
    expect(Object.keys(o.prealables)).toHaveLength(9);
    for (const [cas, r] of Object.entries(o.prealables)) {
      expect(r.ok, cas).toBe(false);
      expect(r.error, cas).toContain("Allumage refusé");
    }
    for (const [cle, allumee] of Object.entries(o.allumees)) expect(allumee, cle).toBe(false);
  });

  // V2-S-2 — MAJEUR. Allumer `relances_auto` pendant que `dossier_en_ligne` est
  // coupé (deux clics simultanés) laisse la fille allumée sous une mère coupée,
  // à presque chaque essai. Probable : formateurs-interrupteurs.ts `ecrire`
  // (~l. 151-191) relit les préalables puis écrit sans verrou ni niveau
  // d'isolement : la coupure en cascade ne voit pas la fille encore en cours.
  test.fixme("V2-S-2 — jamais une fille allumée sous une mère coupée", () => {
    expect(o.violations).toBe(0);
  });
});
