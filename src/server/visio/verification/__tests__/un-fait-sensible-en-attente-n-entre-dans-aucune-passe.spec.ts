/**
 * ⛔ UN FAIT SENSIBLE EN ATTENTE N'ENTRE DANS AUCUNE PASSE (G8 ; art. 9 RGPD).
 *
 * G8 met EN ATTENTE un énoncé qui porte une donnée de santé ou une
 * appréciation d'une personne. « Mis de côté » doit valoir pour la suite du
 * circuit : P2 (rattachement), P3 (consolidation), P4 (ébauche) et P5
 * (rédaction) ne voient que des faits PROPOSÉS ou VALIDÉS. Avant ce
 * correctif, seuls `rejete` et `efface` étaient filtrés : « en arrêt maladie »
 * partait chez OpenAI dans l'entrée de P5 et pouvait entrer dans le compte
 * rendu — et G9 le laissait passer, puisqu'il figurait parmi ses faits.
 *
 * Mutation qui rougit : ajouter `en_attente` à `STATUTS_TRANSMIS_AUX_PASSES`,
 * ou revenir à `filter((f) => f.statut !== "rejete")` dans une passe.
 * Contre-témoin : le fait ordinaire du même compte rendu, lui, est transmis.
 * Angle mort : un fait validé À LA MAIN par Will devient `valide` et entre —
 * c'est sa décision, pas celle de l'IA.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { etatInitial } from "../../etat-compte-rendu";
import { executerEtape, type Gestionnaire } from "../../etapes";
import {
  consolider,
  ebaucher,
  faitsTransmissibles,
  rattacher,
  rediger,
  STATUTS_TRANSMIS_AUX_PASSES,
} from "../../passes-ia";
import type { DonneesPasses, FaitDuJour } from "../../port-donnees";
import { depsDeTest, FauxDepot } from "../../../../../tests/outils/faux-circuit-visio";
import { fauxClient } from "../../../../../tests/outils/faux-openai-visio";

const SENSIBLE = "Le responsable commercial est en arrêt maladie jusqu'en novembre.";
const ORDINAIRE = "L'équipe de douze commerciaux veut être formée à l'IA générative.";

function fait(ref: string, statut: string, enonce: string): FaitDuJour {
  return {
    id: `id-${ref}`,
    ref,
    type: "besoin",
    statut,
    porteeDeclaree: "entreprise",
    projetRef: null,
    enonce,
    citation: null,
    valeurs: [],
    locuteur: "client",
    confiance: "haute",
  };
}

function donnees(): DonneesPasses {
  return {
    rencontre: {
      id: "r1",
      titre: "Diagnostic fictif",
      source: "saisie_manuelle",
      clientId: "c1",
      debut: new Date("2026-10-06T10:00:00Z"),
      dureeMs: 600_000,
    },
    compteRenduId: "cr1",
    statutCompteRendu: "brouillon",
    etat: {
      ...etatInitial(new Date("2026-10-06T10:00:00Z"), "x"),
      faits: [
        ["F01", "id-F01"],
        ["F02", "id-F02"],
      ],
      rattachement: "en_attente_client",
    },
    faitsDuJour: [fait("F01", "propose", ORDINAIRE), fait("F02", "en_attente", SENSIBLE)],
    projets: [],
    faitsConnus: [],
  };
}

async function entreesEnvoyees(etape: "rattacher" | "consolider" | "ebaucher" | "rediger") {
  const g: Record<typeof etape, Gestionnaire> = { rattacher, consolider, ebaucher, rediger };
  const depot = new FauxDepot();
  const t = depot.ajouter({ rencontreId: "r1", etape, compteRenduId: "cr1" });
  const f = fauxClient();
  await executerEtape(
    depsDeTest({
      depot,
      client: f.client,
      donnees: { pourPasses: async () => donnees() },
      gestionnaires: { [etape]: g[etape] },
    }),
    t.id,
  );
  return f.demandesReponse.map((d) => d.entree);
}

describe("un fait sensible en attente n'entre dans aucune passe", () => {
  it("seuls les faits proposés ou validés sont transmissibles", () => {
    expect([...STATUTS_TRANSMIS_AUX_PASSES].sort()).toEqual(["propose", "valide"]);
    const faits = donnees().faitsDuJour;
    expect(faitsTransmissibles(faits).map((f) => f.ref)).toEqual(["F01"]);
  });

  it("P2 et P5 : l'entrée envoyée à OpenAI ne contient pas le fait en attente", async () => {
    for (const etape of ["rattacher", "rediger"] as const) {
      const entrees = await entreesEnvoyees(etape);
      expect(entrees.length, etape).toBeGreaterThan(0);
      for (const e of entrees) {
        expect(e, etape).not.toContain("arrêt maladie");
        // Contre-témoin : le fait ordinaire, lui, part.
        expect(e, etape).toContain("douze commerciaux");
      }
    }
  });

  it("P3 et P4 : aucune entrée envoyée ne contient le fait en attente", async () => {
    for (const etape of ["consolider", "ebaucher"] as const) {
      for (const e of await entreesEnvoyees(etape)) expect(e, etape).not.toContain("arrêt maladie");
    }
  });

  it("aucune passe ne filtre les faits du jour à la main (une seule règle)", () => {
    const source = readFileSync(path.resolve(__dirname, "../../passes-ia.ts"), "utf8");
    expect(source).not.toMatch(/faitsDuJour\.filter\(/);
  });
});
