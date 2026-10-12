/**
 * Lot B, M4 — le préalable de `contrat_auto` est LISIBLE : « une version du
 * contrat-cadre est arrêtée ». Sans ce fait, l'allumage reste refusé ; avec lui
 * (et ses deux interrupteurs mères), il est permis. `activation_auto` et
 * `lettre_auto`, qui l'exigent, deviennent ainsi atteignables.
 */

import { describe, expect, it } from "vitest";

import {
  PREALABLES,
  etatsParDefaut,
  prealablesManquants,
  type EtatsInterrupteurs,
} from "../interrupteurs";
import { lireFaitsPrealables } from "../prealables-faits";

function etats(partiel: Partial<EtatsInterrupteurs> = {}): EtatsInterrupteurs {
  return { ...etatsParDefaut(), ...partiel };
}

const MERES = { dossier_en_ligne: true, textes_valides: true } as const;

describe("contrat_auto : un préalable lisible", () => {
  it("n'a plus aucun préalable « non lisible »", () => {
    expect(PREALABLES.contrat_auto.some((p) => p.sorte === "non_lisible")).toBe(false);
    expect(PREALABLES.contrat_auto).toContainEqual(
      expect.objectContaining({ sorte: "fait", fait: "version_contrat_arretee" }),
    );
  });

  it("sans version arrêtée : refusé, et le motif le dit", () => {
    const m = prealablesManquants("contrat_auto", true, etats(MERES), {
      version_contrat_arretee: false,
    });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/version/i);
  });

  it("fait absent = refus (lecture prudente)", () => {
    expect(prealablesManquants("contrat_auto", true, etats(MERES)).length).toBe(1);
  });

  it("version arrêtée et mères allumées : permis", () => {
    expect(
      prealablesManquants("contrat_auto", true, etats(MERES), { version_contrat_arretee: true }),
    ).toEqual([]);
  });

  it("couper reste toujours permis", () => {
    expect(prealablesManquants("contrat_auto", false, etats())).toEqual([]);
  });

  it("activation_auto et lettre_auto ne dépendent que d'interrupteurs, contrat_auto compris", () => {
    expect(
      prealablesManquants("activation_auto", true, etats({ ...MERES, contrat_auto: true })),
    ).toEqual([]);
  });

  it("le fait est lu dans le registre des versions arrêtées (contrat v3 arrêté)", () => {
    expect(lireFaitsPrealables()).toEqual({ version_contrat_arretee: true });
  });
});
