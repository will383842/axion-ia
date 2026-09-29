/**
 * ⛔ UN ENTRETIEN DÉTECTÉ EST EFFACÉ SANS COMPTE RENDU.
 *
 * Quand P1 reconnaît que l'échange n'était pas un rendez-vous client
 * (entretien d'embauche, conversation personnelle, test), AUCUN compte rendu
 * n'est écrit : la transcription est effacée et la purge du son est
 * programmée immédiatement.
 *
 * Mutation qui rougit : dans `extraire`, ignorer `nature_echange` → un
 * compte rendu est créé. Contre-témoin : un échange complet crée son compte
 * rendu. Angle mort : c'est l'IA qui reconnaît la nature ; une erreur de sa
 * part produit un compte rendu que Will rejette.
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../../etapes";
import { extraire } from "../../passes-ia";
import type { PortDonnees } from "../../port-donnees";
import { depsDeTest, FauxDepot } from "../../../../../tests/outils/faux-circuit-visio";
import { fauxClient, reponseReussie } from "../../../../../tests/outils/faux-openai-visio";
import { DATE_ECHANGE, extraction, SEGMENTS } from "./outils";

function lancer(nature: "pas_un_rendez_vous_client" | "echange_complet") {
  const depot = new FauxDepot();
  const t = depot.ajouter({ rencontreId: "r1", etape: "extraire" });
  const journal: string[] = [];
  const donnees: Partial<PortDonnees> = {
    pourExtraction: async () => ({
      rencontre: {
        id: "r1",
        titre: "Entretien",
        source: "calendly",
        clientId: null,
        debut: DATE_ECHANGE,
        dureeMs: 600_000,
      },
      transcriptionId: "tr1",
      segments: SEGMENTS,
      pistes: { client: "OK", axion: "OK" },
      formulaire: [],
      contacts: [],
      projets: [],
      faitsClient: [],
      mode: "initial",
    }),
    creerCompteRendu: async () => {
      journal.push("compte_rendu");
      return "cr1";
    },
    effacerSansCompteRendu: async () => {
      journal.push("efface");
    },
  };
  const sortie = extraction(undefined, { nature_echange: { nature, explication: "x" } });
  const deps = depsDeTest({
    depot,
    donnees,
    client: fauxClient(undefined, { reponses: [reponseReussie(sortie)] }).client,
    gestionnaires: { extraire },
  });
  return { depot, t, journal, deps };
}

describe("un entretien détecté est effacé sans compte rendu", () => {
  it("pas un rendez-vous client → effacé, purge programmée, aucun compte rendu", async () => {
    const { depot, t, journal, deps } = lancer("pas_un_rendez_vous_client");
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(journal).toEqual(["efface"]);
    expect(depot.lignes.map((l) => l.etape)).toEqual(["extraire", "purger_audio"]);
  });

  it("contre-témoin : un échange complet crée son compte rendu et part en vérification", async () => {
    const { depot, t, journal, deps } = lancer("echange_complet");
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(journal).toEqual(["compte_rendu"]);
    expect(depot.lignes.map((l) => l.etape)).toEqual(["extraire", "verifier_faits"]);
  });
});
