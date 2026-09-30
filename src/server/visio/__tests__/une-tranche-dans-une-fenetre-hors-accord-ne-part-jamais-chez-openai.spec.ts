/**
 * ⛔ UNE TRANCHE DANS UNE FENÊTRE HORS ACCORD NE PART JAMAIS CHEZ OPENAI (RGPD-01).
 *
 * Une personne entre sans avoir donné son accord (et repart, peut-être, avant
 * deux minutes) : sa VOIX ne doit jamais atteindre OpenAI. Vider le texte des
 * segments APRÈS la transcription ne suffit pas — le son serait déjà parti.
 * Une tranche dont l'intervalle chevauche une fenêtre hors accord n'est donc
 * PAS envoyée, quelle que soit la piste (le micro de Williams peut capter le
 * haut-parleur) : aucun appel, aucun coût, un seul segment `horsAccord` vide
 * garde la place de la tranche.
 *
 * Mutation qui rougit : envoyer la tranche puis vider le texte (l'ancien
 * comportement) → le faux client reçoit les octets de la 2e tranche.
 * Contre-témoin : la 1re tranche, hors de la fenêtre, est bien transcrite.
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { ordreSegment, transcrire } from "../recevoir-transcription";
import type { TrancheATraiter } from "../port-donnees";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient, fauxCout } from "../../../../tests/outils/faux-openai-visio";
import { enregistrement, portTranscription, T0 } from "./outils-pipeline";

const VIDE = { text: "", segments: [] };

function tranche(piste: "client" | "axion", numero: number): TrancheATraiter {
  return {
    id: `${piste === "client" ? "tc" : "ta"}${numero}`,
    piste,
    numero,
    debutCaptureEpochMs: T0.getTime() + numero * 180_000,
    dureeMs: 180_000,
    niveauFinMuet: true,
    statut: "complete",
    empreinteAnnoncee: "x",
  };
}

describe("une tranche dans une fenêtre hors accord ne part jamais chez OpenAI", () => {
  it("la 2e tranche (fenêtre de 200 s à 230 s) n'est envoyée sur aucune piste", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "transcrire",
    });
    const e = enregistrement({
      fenetresHorsAccord: [{ debutMs: 200_000, finMs: 230_000 }],
      tranches: [
        tranche("client", 0),
        tranche("client", 1),
        tranche("axion", 0),
        tranche("axion", 1),
      ],
    });
    const { port, ecrits } = portTranscription(e);
    // Quatre réponses prêtes : l'ancien code irait jusqu'au bout, et c'est
    // l'assertion sur les octets reçus qui rougit, pas un faux client à sec.
    const f = fauxClient(undefined, { transcriptions: [VIDE, VIDE, VIDE, VIDE] });
    const cout = fauxCout();

    expect(
      await executerEtape(
        depsDeTest({
          depot,
          client: f.client,
          cout: cout.port,
          donnees: port,
          gestionnaires: { transcrire },
        }),
        t.id,
      ),
    ).toBe("reussie");

    const recus = f.demandesTranscription.map((d) => d.octets.toString());
    expect(recus).toEqual(["tc0", "ta0"]);
    expect(recus).not.toContain("tc1");
    expect(recus).not.toContain("ta1");
    // Aucun coût pour une tranche qui n'est pas partie.
    expect(cout.verifications).toHaveLength(2);

    // La place de la tranche est gardée : un segment hors accord, sans parole.
    for (const [id, piste] of [
      ["tc1", "client"],
      ["ta1", "axion"],
    ] as const) {
      const s = ecrits.find((x) => x.trancheId === id)!.segments;
      expect(s).toEqual([
        {
          ordre: ordreSegment(piste, 1, 0),
          piste,
          debutMs: 180_000,
          finMs: 360_000,
          locuteurBrut: null,
          texte: "",
          horsAccord: true,
        },
      ]);
    }
  });
});
