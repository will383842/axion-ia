/**
 * ⛔ SEUL `src/lib/rgpd-erase.ts` POSE LE DRAPEAU D'EFFACEMENT
 * (chantier visio, PR 2 ; plan PA-6, §3.15).
 *
 * Le trigger `faits_contenu_immuable` refuse toute réécriture du contenu d'un
 * fait, et `enregistrement_consentements_ajout_seul` toute modification d'une
 * preuve d'accord — SAUF quand la session porte `axion.effacement_rgpd = on`.
 * Ce drapeau est donc une clé passe-partout : si n'importe quel module pouvait
 * le poser, l'immuabilité ne vaudrait rien. Un seul module le pose, en
 * `SET LOCAL`, dans une transaction ; tous les autres l'appellent.
 *
 * LIRE le drapeau (`current_setting(...)`, dans les triggers et dans le
 * contrôle de Gate D) est permis : c'est le POSER qui est réservé.
 *
 * Contre-témoin : les trois façons de le poser sont reconnues.
 * Angle mort avoué : une valeur construite par concaténation
 * (`"axion." + "effacement_rgpd"`) échappe au motif.
 */

import { describe, expect, it } from "vitest";
import { lire, sansCommentaires, sourcesSous } from "./sources-du-circuit-visio";

const SEUL_AUTORISE = "src/lib/rgpd-erase.ts";

/** SET / SET LOCAL / set_config(...) sur le drapeau. */
const POSE_DU_DRAPEAU =
  /\bSET\s+(?:LOCAL\s+|SESSION\s+)?axion\.effacement_rgpd\b|set_config\s*\(\s*['"]axion\.effacement_rgpd['"]/i;

describe("seul rgpd-erase pose le drapeau d'effacement", () => {
  it("contre-témoin : les façons de poser le drapeau sont reconnues, la lecture ne l'est pas", () => {
    expect(
      POSE_DU_DRAPEAU.test(`tx.$executeRawUnsafe("SET LOCAL axion.effacement_rgpd = 'on'")`),
    ).toBe(true);
    expect(POSE_DU_DRAPEAU.test(`SET axion.effacement_rgpd TO 'on'`)).toBe(true);
    expect(POSE_DU_DRAPEAU.test(`SELECT set_config('axion.effacement_rgpd', 'on', true)`)).toBe(
      true,
    );
    expect(POSE_DU_DRAPEAU.test(`current_setting('axion.effacement_rgpd', true)`)).toBe(false);
  });

  it("le module autorisé le pose bien (sinon la garde serait verte pour rien)", () => {
    expect(POSE_DU_DRAPEAU.test(sansCommentaires(lire(SEUL_AUTORISE)))).toBe(true);
  });

  it("aucun autre fichier de src/ ni de scripts/ ne le pose", () => {
    const fautifs = sourcesSous(["src", "scripts"]).filter(
      (f) => f !== SEUL_AUTORISE && POSE_DU_DRAPEAU.test(sansCommentaires(lire(f))),
    );
    expect(
      fautifs,
      "ces fichiers posent le drapeau d'effacement RGPD : ils doivent appeler src/lib/rgpd-erase.ts :",
    ).toEqual([]);
  });
});
