/**
 * Lot L8 — l'entrée « Dossiers et contrats » du groupe « Formateurs freelance ».
 * Livrée ÉTEINTE (`formateurs.dossiers_contrats`) : absente, le menu est celui
 * d'aujourd'hui, groupe allumé ou non.
 */

import { describe, expect, it } from "vitest";

import { buildAdminNav } from "@/lib/admin-nav";
import {
  etatsEntreeDepuisLignes,
  etatsEntreeParDefaut,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";

describe("L8 — menu", () => {
  it("interrupteur absent : menu identique, groupe allumé ou non", () => {
    expect(buildAdminNav("p", { formateursFreelance: true, dossiersEtContrats: false })).toEqual(
      buildAdminNav("p", { formateursFreelance: true }),
    );
    expect(buildAdminNav("p", { dossiersEtContrats: true })).toEqual(buildAdminNav("p"));
    expect(etatsEntreeParDefaut().dossiers_contrats).toBe(false);
    expect(etatsEntreeDepuisLignes([]).dossiers_contrats).toBe(false);
  });

  it("allumé avec le groupe : l'entrée suit « Candidatures »", () => {
    const groupe = buildAdminNav("p", { formateursFreelance: true, dossiersEtContrats: true })
      .filter((it) => it.group === "formateurs-freelance")
      .map((it) => [it.label, it.href]);
    expect(groupe).toEqual([
      ["Candidatures", "/fr/p/contacts/candidatures?view=formateurs-freelance"],
      ["Dossiers et contrats", "/fr/p/qualiopi/formateurs/dossiers"],
    ]);
  });

  it("se lit sur sa propre clé", () => {
    expect(
      etatsEntreeDepuisLignes([{ key: "formateurs.dossiers_contrats", value: { actif: true } }])
        .dossiers_contrats,
    ).toBe(true);
  });
});
