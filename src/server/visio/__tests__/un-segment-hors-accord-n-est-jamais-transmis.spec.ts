/**
 * ⛔ UN SEGMENT HORS ACCORD N'EST JAMAIS TRANSMIS.
 *
 * Une personne arrive sans accord : l'extension coupe le son et journalise
 * une FENÊTRE HORS ACCORD. Tout segment qui la chevauche est marqué
 * `horsAccord`, sa parole n'est PAS écrite en base (texte vide), et il
 * n'entre jamais dans le dialogue envoyé à P1.
 *
 * Mutation qui rougit : dans `transcrire`, ne pas calculer `estHorsAccord`
 * (ou garder le texte) → la parole est écrite et transmise. Contre-témoin :
 * un segment hors de la fenêtre est gardé. Angle mort : le son lui-même de la
 * fenêtre a été capté à gain nul par l'extension ; s'il restait audible, il
 * est quand même écarté ici.
 */

import { describe, expect, it } from "vitest";

import { entrelacer } from "../dialogue";
import { executerEtape } from "../etapes";
import { transcrire } from "../recevoir-transcription";
import { depotDonneesPrisma } from "../depot-donnees";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient } from "../../../../tests/outils/faux-openai-visio";
import { baseEspion } from "../../../../tests/outils/base-espion";
import { enregistrement, portTranscription, seg } from "./outils-pipeline";

describe("un segment hors accord n'est jamais transmis", () => {
  it("le segment dans la fenêtre est écrit sans parole, l'autre est gardé", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "transcrire",
    });
    // La fenêtre commence juste APRÈS la tranche (0-180 s) : la tranche part,
    // c'est le SECOND FILET (par segment) qui est éprouvé ici. Une tranche
    // qui chevauche la fenêtre ne part pas du tout : voir
    // `une-tranche-dans-une-fenetre-hors-accord-ne-part-jamais-chez-openai`.
    const e = enregistrement({ fenetresHorsAccord: [{ debutMs: 181_000, finMs: 200_000 }] });
    const { port, ecrits } = portTranscription(e);
    const client = {
      text: "",
      segments: [
        { start: 10, end: 20, speaker: "A", text: "Avant l'arrivée de mon associé." },
        { start: 182, end: 190, speaker: "B", text: "Parole de la personne sans accord." },
      ],
    };
    const f = fauxClient(undefined, { transcriptions: [client, { text: "", segments: [] }] });
    await executerEtape(
      depsDeTest({ depot, client: f.client, donnees: port, gestionnaires: { transcrire } }),
      t.id,
    );
    const ecritsClient = ecrits.find((x) => x.trancheId === "tc0")!.segments;
    expect(ecritsClient.map((s) => [s.horsAccord, s.texte])).toEqual([
      [false, "Avant l'arrivée de mon associé."],
      [true, ""],
    ]);
  });

  it("le port réel n'écrit aucune parole pour un segment hors accord", async () => {
    const e = baseEspion();
    process.env["PII_ENCRYPTION_KEY"] = "0123456789abcdef".repeat(4);
    await depotDonneesPrisma(e.base).ecrireSegmentsTranche(e.base, {
      transcriptionId: "tr1",
      trancheId: "tc0",
      segments: [
        {
          ordre: 1,
          piste: "client",
          debutMs: 0,
          finMs: 1,
          locuteurBrut: "B",
          texte: "fuite",
          horsAccord: true,
        },
      ],
    });
    const data = (
      e.de("transcriptionSegment", "createMany")[0]!.args as { data: Array<{ texte: string }> }
    ).data;
    expect(data[0]!.texte).toBe("");
  });

  it("le dialogue n'inclut jamais un segment hors accord", () => {
    const d = entrelacer([
      seg({ piste: "client", debutMs: 0, texte: "gardé" }),
      seg({ piste: "client", debutMs: 5_000, texte: "secret", horsAccord: true }),
    ]);
    expect(d.texte).toMatch(/gardé/);
    expect(d.texte).not.toMatch(/secret/);
  });
});
