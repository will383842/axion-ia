/**
 * ⛔ UNE PANNE PASSAGÈRE RÉESSAIE 72 HEURES PUIS PRÉVIENT (LOTS-EXECUTION PR 6).
 *
 * Reprises à +5 min, +30 min, +2 h, +6 h, +24 h, +48 h et +72 h depuis le
 * PREMIER échec ; au 8ᵉ échec, échec définitif, alerte, note manuelle
 * proposée. Jamais une boucle serrée, jamais un abandon au premier 503.
 *
 * Mutation qui rougit : raccourcir `REPRISES_PASSAGERES_MIN` ou compter les
 * délais depuis le DERNIER échec → les dates ne tombent plus aux bornes.
 * Contre-témoin : une erreur de contenu n'a qu'un essai de plus. Angle mort :
 * l'heure exacte de reprise dépend du balayage (toutes les 5 min).
 */

import { describe, expect, it } from "vitest";

import {
  decisionApresErreur,
  executerEtape,
  REPRISES_PASSAGERES_MIN,
  type Gestionnaire,
} from "../etapes";
import { ErreurVisio } from "../openai/erreurs";
import type { EtapeTenue } from "../prise-d-etape";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";

const PREMIER = new Date("2026-10-06T10:00:00Z");
const PANNE = new ErreurVisio("passagere", "fournisseur_indisponible", "503");

function tenue(echecs: number): EtapeTenue {
  return {
    id: "t",
    rencontreId: "r",
    etape: "transcrire",
    compteRenduId: null,
    execution: echecs + 1,
    echecs,
    premierEchecLe: echecs === 0 ? null : PREMIER,
  };
}

describe("une panne passagère réessaie 72 heures puis prévient", () => {
  it("les reprises tombent à +5 min … +72 h du premier échec", () => {
    const heures = REPRISES_PASSAGERES_MIN.map((_, n) => {
      const d = decisionApresErreur(tenue(n), PANNE, PREMIER);
      expect(d.statut).toBe("a_faire");
      return (d.prochaineTentativeLe!.getTime() - PREMIER.getTime()) / 60_000;
    });
    expect(heures).toEqual([5, 30, 120, 360, 1440, 2880, 4320]);
  });

  it("au 8ᵉ échec : échec définitif et alerte", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "r1",
      etape: "transcrire",
      echecs: 7,
      premierEchecLe: PREMIER,
    });
    const g: Gestionnaire = async () => {
      throw PANNE;
    };
    const deps = depsDeTest({
      depot,
      gestionnaires: { transcrire: g },
      maintenant: () => new Date("2026-10-09T10:05:00Z"),
    });
    expect(await executerEtape(deps, t.id)).toBe("echec_definitif");
    expect(depot.ligne(t.id).statut).toBe("echec_definitif");
    expect(deps.alertes[0]).toMatchObject({ code: "visio.etape_en_echec", rencontreId: "r1" });
    expect(deps.alertes[0]!.message).toMatch(/note manuelle/);
  });

  it("contre-témoin : une erreur de contenu n'a qu'un essai de plus", () => {
    const contenu = new ErreurVisio("contenu", "sortie_invalide", "x");
    expect(decisionApresErreur(tenue(0), contenu, PREMIER).statut).toBe("a_faire");
    expect(decisionApresErreur(tenue(1), contenu, PREMIER).statut).toBe("echec_definitif");
  });
});
