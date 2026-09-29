/**
 * UN SEUL TRAITEMENT EN COURS PAR RENCONTRE.
 *
 * Aucune étape ne tourne tant qu'un enregistrement de la rencontre est ACTIF
 * (une seconde capture en cours) : elle est reportée de 5 minutes, sans
 * compter d'essai. Et une étape déjà prise ne peut pas l'être une seconde
 * fois (prise atomique).
 */

import { describe, expect, it } from "vitest";

import { executerEtape, type Gestionnaire } from "../../etapes";
import { depsDeTest, FauxDepot } from "../../../../../tests/outils/faux-circuit-visio";

describe("un seul traitement en cours par rencontre", () => {
  it("enregistrement actif → étape reportée, rien exécuté, rien compté", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "transcrire" });
    let appels = 0;
    const g: Gestionnaire = async () => {
      appels += 1;
      return { ecrire: async () => [] };
    };
    const deps = depsDeTest({
      depot,
      gestionnaires: { transcrire: g },
      donnees: { enregistrementActif: async () => true },
    });
    expect(await executerEtape(deps, t.id)).toBe("reportee");
    expect(appels).toBe(0);
    expect(depot.ligne(t.id)).toMatchObject({ statut: "a_faire", echecs: 0 });
    expect(depot.ligne(t.id).prochaineTentativeLe!.toISOString()).toBe("2026-10-06T10:05:00.000Z");
  });

  it("une étape en cours ne se reprend pas", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "transcrire", statut: "en_cours" });
    const deps = depsDeTest({ depot, gestionnaires: {} });
    expect(await executerEtape(deps, t.id)).toBe("deja_prise");
  });
});
