/**
 * P-4 (décision de Williams du 30/09) : un rendez-vous « salon » (réservé au
 * salon GOFAB) reste HORS du dossier client et de « Après l'appel ». La carte
 * « À faire le point » ne montre « Après l'appel » que pour un type de la
 * liste blanche (`estTypeDuDossier`), en plus du droit de voir le dossier.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { estTypeDuDossier } from "../liste-blanche-types";

describe("un rendez-vous salon ne mène pas à « Après l'appel »", () => {
  it("un type salon n'est pas du dossier ; « Discutons » l'est", () => {
    expect(estTypeDuDossier("Rencontre salon GOFAB (15 min)")).toBe(false);
    expect(estTypeDuDossier("Rencontre Salon GOFAB")).toBe(false);
    expect(estTypeDuDossier("Discutons de votre projet IA")).toBe(true);
  });

  it("la carte « À faire le point » soumet le lien à la liste blanche", () => {
    const page = readFileSync(
      "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/page.tsx",
      "utf8",
    );
    expect(page).toMatch(
      /dossierVisible && estTypeDuDossier\(r\.titre\) \? \(\s*(<>\s*)?<LiensApresLAppel/,
    );
    expect(page).not.toMatch(/\{dossierVisible \? <LiensApresLAppel/);
  });
});
