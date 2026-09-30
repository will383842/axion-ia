/**
 * ⛔ UNE SESSION CLOSE PAR LE SERVEUR ATTEND WILL AVANT OPENAI (RGPD-01).
 *
 * Les fenêtres hors accord n'arrivent au serveur qu'avec la requête `fin` de
 * l'extension. Navigateur planté, onglet fermé : le serveur clôt la session
 * d'office (`motifArret: "cloture_serveur"`) et la liste des personnes entrées
 * sans accord est ABSENTE. Tout transcrire enverrait peut-être leur voix chez
 * OpenAI : l'étape attend donc la réponse de Will, sans aucun appel.
 *
 * Reprise : le même geste que l'enregistrement court (`court_confirme`, bouton
 * « traiter cet enregistrement » de la vue du compte rendu) relâche l'étape.
 * Une `fin` tardive de l'extension remplace le motif et apporte les fenêtres :
 * elle n'attend plus rien.
 *
 * Mutation qui rougit : retirer la garde `cloture_serveur` de `transcrire` →
 * l'étape réussit et OpenAI reçoit le son.
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { transcrire } from "../recevoir-transcription";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { clientInterdit, fauxClient } from "../../../../tests/outils/faux-openai-visio";
import { enregistrement, portTranscription } from "./outils-pipeline";

const VIDE = { text: "", segments: [] };
const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";

describe("une session close par le serveur attend Will avant OpenAI", () => {
  it("clôture d'office : en attente de Will, Will prévenu, aucun appel", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const client = clientInterdit();
    const { port } = portTranscription(
      enregistrement({ motifArret: "cloture_serveur", fenetresHorsAccord: [] }),
    );
    const deps = depsDeTest({ depot, client, donnees: port, gestionnaires: { transcrire } });
    expect(await executerEtape(deps, t.id)).toBe("attente_will");
    expect(depot.ligne(t.id)).toMatchObject({ statut: "suspendu", classeErreur: null });
    expect(client.appels).toBe(0);
    expect(deps.alertes).toEqual([
      expect.objectContaining({
        code: "visio.reponse_attendue",
        rencontreId: RENCONTRE,
        message: expect.stringMatching(/sans la liste des personnes sans accord/),
      }),
    ]);
  });

  it("Will a vérifié et confirmé : transcrit", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const { port } = portTranscription(
      enregistrement({ motifArret: "cloture_serveur", courtConfirme: true }),
    );
    const f = fauxClient(undefined, { transcriptions: [VIDE, VIDE] });
    expect(
      await executerEtape(
        depsDeTest({ depot, client: f.client, donnees: port, gestionnaires: { transcrire } }),
        t.id,
      ),
    ).toBe("reussie");
    expect(f.demandesTranscription).toHaveLength(2);
  });

  it("contre-témoin : un arrêt par l'extension (fenêtres reçues) n'attend rien", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const { port } = portTranscription(enregistrement({ motifArret: "manuel" }));
    const f = fauxClient(undefined, { transcriptions: [VIDE, VIDE] });
    expect(
      await executerEtape(
        depsDeTest({ depot, client: f.client, donnees: port, gestionnaires: { transcrire } }),
        t.id,
      ),
    ).toBe("reussie");
  });
});
