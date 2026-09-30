/**
 * ⛔ L'ENTRÉE D'UNE PASSE N'EST JAMAIS STOCKÉE NI JOURNALISÉE.
 *
 * Ce qu'on envoie à OpenAI (le dialogue, le formulaire, les faits connus) ne
 * se retrouve NULLE PART de notre côté : ni dans les journaux (`console.*`),
 * ni dans les alertes, ni dans l'état du compte rendu écrit en base, ni dans
 * la charge d'un job BullMQ (identifiants seulement), ni dans un message
 * d'erreur.
 *
 * Mutation qui rougit : faire journaliser `d.entree` par `executerPasse`, ou
 * la garder dans l'état (`extraire`) → la phrase témoin apparaît.
 * Contre-témoin : la phrase témoin est bien partie chez OpenAI (sinon le test
 * ne prouverait rien). Angle mort : la sortie de P1 (et ses citations) est
 * gardée, CHIFFRÉE, jusqu'à la vérification — c'est la matière du compte
 * rendu, pas l'entrée.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { executerEtape } from "../etapes";
import { extraire } from "../passes-ia";
import type { EtatCompteRendu } from "../etat-compte-rendu";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient, reponseReussie } from "../../../../tests/outils/faux-openai-visio";
import {
  DATE_ECHANGE,
  extraction,
  SEGMENTS,
} from "../../../../tests/fixtures/visio/scenario-menuiserie";

const TEMOIN = "formulaire-temoin-7f3a Nous voulons former les équipes";

afterEach(() => vi.restoreAllMocks());

describe("l'entrée d'une passe n'est jamais stockée ni journalisée", () => {
  it("ni journal, ni alerte, ni état, ni message d'erreur ne contient l'entrée", async () => {
    const traces: string[] = [];
    for (const m of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
        traces.push(a.map(String).join(" "));
      });
    }
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "extraire" });
    let etatEcrit: EtatCompteRendu | null = null;
    // Une sortie valide (sans fait) : l'état du compte rendu est écrit, et contrôlé.
    const f = fauxClient(undefined, { reponses: [reponseReussie(extraction([]))] });
    const deps = depsDeTest({
      depot,
      client: f.client,
      gestionnaires: { extraire },
      donnees: {
        pourExtraction: async () => ({
          rencontre: {
            id: "r1",
            titre: "Diagnostic",
            source: "calendly",
            clientId: null,
            debut: DATE_ECHANGE,
            dureeMs: 600_000,
          },
          transcriptionId: "tr1",
          segments: SEGMENTS,
          pistes: { client: "OK", axion: "OK" },
          formulaire: [{ question: "Votre besoin", reponse: TEMOIN }],
          contacts: [],
          projets: [],
          faitsClient: [],
          mode: "initial",
        }),
        creerCompteRendu: async (_tx, a) => {
          etatEcrit = a.etat;
          return "cr1";
        },
      },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(etatEcrit).not.toBeNull();

    // Contre-témoin : l'entrée est bien partie chez OpenAI.
    expect(f.demandesReponse[0]!.entree).toContain(TEMOIN);
    expect(f.demandesReponse[0]!.entree).toContain("On serait douze commerciaux");
    const partout = [
      ...traces,
      ...deps.alertes.map((a) => JSON.stringify(a)),
      JSON.stringify(etatEcrit),
      JSON.stringify(depot.lignes),
    ].join("\n");
    expect(partout).not.toContain("formulaire-temoin-7f3a");
    expect(partout).not.toContain("On serait douze commerciaux");
  });

  it("la charge d'un job de la file `visio` ne porte que des identifiants", () => {
    const code = readFileSync(
      path.resolve(__dirname, "../../queue/workers/visio-worker.ts"),
      "utf8",
    );
    expect(code).toMatch(/\{ v: 1, rencontreId: d\.rencontreId, etape: d\.etape \}/);
    // La charge est déclarée au registre des files, comme toutes les autres.
    const types = readFileSync(path.resolve(__dirname, "../../queue/types.ts"), "utf8");
    expect(types).toMatch(
      /readonly v: 1;\s*readonly rencontreId\?: string;\s*readonly etape\?: string;\s*\}/,
    );
  });

  it("aucun module OpenAI du circuit n'écrit dans la console", () => {
    for (const f of ["passe.ts", "transcrire-tranche.ts", "client.ts", "cout.ts"]) {
      const code = readFileSync(path.resolve(__dirname, "../openai", f), "utf8");
      expect(code, f).not.toMatch(/console\./);
    }
  });
});
