/**
 * Lot D (M9) — l'entrée « Virements à faire » du groupe « Formateurs freelance ».
 * Livrée ÉTEINTE (`formateurs.virements_a_faire`) : absente, le menu est celui
 * d'aujourd'hui, groupe allumé ou non.
 */

import { describe, expect, it } from "vitest";

import { buildAdminNav } from "@/lib/admin-nav";
import {
  etatsEntreeDepuisLignes,
  etatsEntreeParDefaut,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";

describe("M9 — menu « Virements à faire »", () => {
  it("interrupteur éteint par défaut : menu identique", () => {
    expect(etatsEntreeParDefaut().virements_a_faire).toBe(false);
    expect(etatsEntreeDepuisLignes([]).virements_a_faire).toBe(false);
    expect(buildAdminNav("p", { formateursFreelance: true, virementsAFaire: false })).toEqual(
      buildAdminNav("p", { formateursFreelance: true }),
    );
    expect(buildAdminNav("p", { virementsAFaire: true })).toEqual(buildAdminNav("p"));
  });

  it("allumé avec le groupe : l'entrée mène à la vue commune", () => {
    const groupe = buildAdminNav("p", {
      formateursFreelance: true,
      dossiersEtContrats: true,
      virementsAFaire: true,
    })
      .filter((it) => it.group === "formateurs-freelance")
      .map((it) => [it.label, it.href]);
    expect(groupe).toEqual([
      ["Candidatures", "/fr/p/contacts/candidatures?view=formateurs-freelance"],
      ["Dossiers et contrats", "/fr/p/qualiopi/formateurs/dossiers"],
      ["Virements à faire", "/fr/p/qualiopi/remuneration/virements"],
    ]);
  });

  it("se lit sur sa propre clé", () => {
    expect(
      etatsEntreeDepuisLignes([{ key: "formateurs.virements_a_faire", value: { actif: true } }])
        .virements_a_faire,
    ).toBe(true);
  });
});
