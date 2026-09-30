/**
 * ⛔ UNE LIMITE DE DÉBIT PUIS UNE SORTIE INVALIDE N'EST PAS DÉFINITIVE (V1, F5).
 *
 * La décision après erreur comptait TOUS les échecs, quelle que soit leur
 * classe, et datait l'alerte « base non migrée depuis plus de 2 heures » du
 * premier échec de N'IMPORTE QUELLE classe :
 *   · une limite de débit (passagère) puis UNE sortie invalide (contenu)
 *     suffisaient à l'échec définitif, alors que le contenu a droit à un essai ;
 *   · une limite de débit à 10 h, puis un worker qui atterrit avant la
 *     migration à 14 h : l'alerte critique partait au PREMIER report.
 *
 * Désormais, un échec d'une AUTRE classe que le précédent ouvre une nouvelle
 * série : compteur et date du premier échec repartent de zéro.
 *
 * Mutations qui rougissent : comparer `t.echecs` sans regarder
 * `t.classeErreur` (1er et 3e cas) ; dater `schema_en_retard` depuis
 * `t.premierEchecLe` sans condition (2e cas) ; ne pas remettre `echecs` à zéro
 * dans `echouer` (4e cas).
 * Contre-témoins : deux sorties invalides de suite restent un échec définitif ;
 * une base non migrée depuis plus de 2 h (même classe) alerte toujours.
 * Angle mort : une étape reportée sans classe (enregistrement encore actif)
 * efface la classe précédente ; la série suivante continue alors l'ancienne —
 * bornée par le plafond de 10 exécutions imputées.
 */

import { describe, expect, it } from "vitest";

import { decisionApresErreur, executerEtape, type Gestionnaire } from "../etapes";
import { ErreurVisio } from "../openai/erreurs";
import type { EtapeTenue } from "../prise-d-etape";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

const DIX_HEURES = new Date("2026-10-06T10:00:00Z");
const QUATORZE_HEURES = new Date("2026-10-06T14:00:00Z");
const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";

const DEBIT = new ErreurVisio("passagere", "limite_debit", "429");
const INVALIDE = new ErreurVisio("contenu", "sortie_invalide", "schéma");
const SCHEMA = new ErreurVisio("schema_en_retard", "schema_en_retard", "42703");

function tenue(p: Partial<EtapeTenue>): EtapeTenue {
  return {
    id: "t",
    rencontreId: RENCONTRE,
    etape: "rediger",
    compteRenduId: "cr1",
    execution: 2,
    interruptions: 0,
    echecs: 1,
    premierEchecLe: DIX_HEURES,
    ...p,
  };
}

describe("⛔ une limite de débit puis une sortie invalide n'est pas définitive", () => {
  it("un contenu invalide après une panne passagère a encore son essai", () => {
    const d = decisionApresErreur(tenue({ classeErreur: "passagere" }), INVALIDE, QUATORZE_HEURES);
    expect(d.statut).toBe("a_faire");
    expect(d.nouvelleSerie).toBe(true);
    expect(d.premierEchecLe).toEqual(QUATORZE_HEURES);
  });

  it("une base non migrée se date de SON premier échec, pas d'une limite de débit", () => {
    const d = decisionApresErreur(tenue({ classeErreur: "passagere" }), SCHEMA, QUATORZE_HEURES);
    expect(d.premierEchecLe).toEqual(QUATORZE_HEURES);
  });

  it("contre-témoin : deux sorties invalides de suite restent un échec définitif", () => {
    const d = decisionApresErreur(tenue({ classeErreur: "contenu" }), INVALIDE, QUATORZE_HEURES);
    expect(d.statut).toBe("echec_definitif");
    expect(d.nouvelleSerie ?? false).toBe(false);
  });

  it("dans le circuit : pas d'alerte « base non migrée » au premier report après une limite de débit", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: RENCONTRE,
      etape: "extraire",
      echecs: 1,
      classeErreur: "passagere",
      premierEchecLe: DIX_HEURES,
    });
    const g: Gestionnaire = async () => {
      throw SCHEMA;
    };
    const deps = depsDeTest({
      depot,
      gestionnaires: { extraire: g },
      maintenant: () => QUATORZE_HEURES,
    });
    expect(await executerEtape(deps, t.id)).toBe("reportee");
    expect(deps.alertes).toEqual([]);
    expect(depot.ligne(t.id)).toMatchObject({
      classeErreur: "schema_en_retard",
      echecs: 0,
      premierEchecLe: QUATORZE_HEURES,
    });
  });

  it("dans le circuit : limite de débit, puis sortie invalide → encore un essai ; puis une seconde → définitif", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: RENCONTRE,
      etape: "extraire",
      echecs: 1,
      classeErreur: "passagere",
      premierEchecLe: DIX_HEURES,
    });
    const g: Gestionnaire = async () => {
      throw INVALIDE;
    };
    const deps = depsDeTest({
      depot,
      gestionnaires: { extraire: g },
      maintenant: () => QUATORZE_HEURES,
    });
    expect(await executerEtape(deps, t.id)).toBe("a_reessayer");
    expect(depot.ligne(t.id)).toMatchObject({ statut: "a_faire", echecs: 1 });
    depot.ligne(t.id).prochaineTentativeLe = null;
    expect(await executerEtape(deps, t.id)).toBe("echec_definitif");
  });

  it("contre-témoin : une base non migrée depuis plus de 2 h alerte toujours", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: RENCONTRE,
      etape: "extraire",
      classeErreur: "schema_en_retard",
      premierEchecLe: DIX_HEURES,
    });
    const g: Gestionnaire = async () => {
      throw SCHEMA;
    };
    const deps = depsDeTest({
      depot,
      gestionnaires: { extraire: g },
      maintenant: () => QUATORZE_HEURES,
    });
    await executerEtape(deps, t.id);
    expect(deps.alertes.map((a) => a.code)).toEqual(["visio.schema_en_retard"]);
  });
});
