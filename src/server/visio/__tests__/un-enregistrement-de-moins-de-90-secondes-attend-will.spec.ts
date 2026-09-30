/**
 * G0b — UN ENREGISTREMENT DE MOINS DE 90 SECONDES ATTEND WILL.
 *
 * Rien n'est transcrit (donc rien n'est envoyé à OpenAI) sans une réponse de
 * Will : « le client a-t-il refusé ? ». L'étape passe `suspendu` SANS classe
 * d'erreur (ce n'est pas une panne) ; « Non, traiter » la relance. Will est
 * PRÉVENU (`visio.reponse_attendue`, qui mène à la page du rendez-vous).
 * Mutation qui rougit : retirer l'alerte de la branche `AttenteWill`.
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { transcrire } from "../recevoir-transcription";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { clientInterdit, fauxClient } from "../../../../tests/outils/faux-openai-visio";
import { enregistrement, portTranscription, T0 } from "./outils-pipeline";

const COURT = { fin: new Date(T0.getTime() + 60_000) };
const VIDE = { text: "", segments: [] };

describe("un enregistrement de moins de 90 secondes attend Will", () => {
  it("60 s : en attente de Will, aucun appel", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "transcrire",
    });
    const client = clientInterdit();
    const { port } = portTranscription(enregistrement(COURT));
    const deps = depsDeTest({ depot, client, donnees: port, gestionnaires: { transcrire } });
    expect(await executerEtape(deps, t.id)).toBe("attente_will");
    expect(depot.ligne(t.id)).toMatchObject({ statut: "suspendu", classeErreur: null });
    expect(client.appels).toBe(0);
    // Will est PRÉVENU : sans alerte, l'étape resterait suspendue en silence.
    expect(deps.alertes).toEqual([
      expect.objectContaining({
        code: "visio.reponse_attendue",
        rencontreId: "00000000-0000-4000-8000-0000000000f1",
      }),
    ]);
  });

  it("confirmé par Will : transcrit", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "transcrire",
    });
    const { port } = portTranscription(enregistrement({ ...COURT, courtConfirme: true }));
    const f = fauxClient(undefined, { transcriptions: [VIDE, VIDE] });
    expect(
      await executerEtape(
        depsDeTest({ depot, client: f.client, donnees: port, gestionnaires: { transcrire } }),
        t.id,
      ),
    ).toBe("reussie");
    expect(f.demandesTranscription).toHaveLength(2);
  });

  it("un refus déclaré n'attend rien : purge immédiate, aucune transcription", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "transcrire",
    });
    const client = clientInterdit();
    const { port } = portTranscription(
      enregistrement({ ...COURT, motifArret: "refus_participant" }),
    );
    expect(
      await executerEtape(
        depsDeTest({ depot, client, donnees: port, gestionnaires: { transcrire } }),
        t.id,
      ),
    ).toBe("reussie");
    expect(depot.lignes.map((l) => l.etape)).toEqual(["transcrire", "purger_audio"]);
    expect(client.appels).toBe(0);
  });
});
