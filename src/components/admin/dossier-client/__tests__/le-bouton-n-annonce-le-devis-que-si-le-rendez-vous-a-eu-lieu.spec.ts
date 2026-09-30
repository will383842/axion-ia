/**
 * Relecture de la PR 1233 (mineur 1) : « Valider et ouvrir le devis » n'est
 * annoncé que si la suite est « devis » ET que le rendez-vous n'est ni
 * « absent » ni « reporté » (dans ces deux cas `garderSuiteEtEcheance` annule
 * la suite et la validation renvoie vers le rendez-vous, pas vers le devis).
 * Sans JavaScript : le libellé est choisi en CSS `:has` ; la garde lit le
 * sélecteur dans le composant.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ISSUES } from "@/features/admin-rendezvous/suivi";

const SOURCE = readFileSync("src/components/admin/dossier-client/ApresLAppelVue.tsx", "utf8");

describe("le bouton n'annonce le devis que si le rendez-vous a eu lieu", () => {
  it("le libellé « devis » exclut chaque issue autre que « eu_lieu »", () => {
    const autres = ISSUES.filter((i) => i !== "eu_lieu");
    expect(autres.length).toBeGreaterThan(0);
    for (const issue of autres) {
      expect(SOURCE).toContain(`:not(:has(option[value=${issue}]:checked))`);
    }
    expect(SOURCE).toContain("has(option[value=devis]:checked)");
  });

  it("l'ancien sélecteur, qui ne lisait que la suite, a disparu", () => {
    expect(SOURCE).not.toContain("group-has-[option[value=devis]:checked]");
  });
});
