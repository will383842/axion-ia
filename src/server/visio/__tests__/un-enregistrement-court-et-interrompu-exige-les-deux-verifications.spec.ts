/**
 * ⛔ UN ENREGISTREMENT COURT ET INTERROMPU EXIGE LES DEUX VÉRIFICATIONS (RGPD-01).
 *
 * Deux questions distinctes attendent Will avant tout envoi à OpenAI :
 *   · « court » (moins de 90 s) : le client a-t-il refusé ? → `court_confirme` ;
 *   · « interrompue » (close par le serveur, sans la liste des fenêtres hors
 *     accord) : quelqu'un est-il entré sans accord ? → `fenetres_verifiees`.
 * Répondre à l'une ne répond pas à l'autre : si les deux s'appliquent, il
 * faut les deux gestes.
 *
 * Mutation qui rougit : lever les deux attentes par le même drapeau
 * (`courtConfirme`) → la réponse « court » laisse partir le son sans que
 * personne ait vérifié les entrées sans accord.
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { transcrire } from "../recevoir-transcription";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { clientInterdit, fauxClient } from "../../../../tests/outils/faux-openai-visio";
import { enregistrement, portTranscription, T0 } from "./outils-pipeline";

const VIDE = { text: "", segments: [] };
const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";
const COURT_ET_INTERROMPU = {
  fin: new Date(T0.getTime() + 60_000),
  motifArret: "cloture_serveur",
};

async function executer(p: Parameters<typeof enregistrement>[0], avecReponses: boolean) {
  const depot = new FauxDepot();
  const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
  const interdit = clientInterdit();
  const f = fauxClient(undefined, { transcriptions: [VIDE, VIDE] });
  const { port } = portTranscription(enregistrement(p));
  const deps = depsDeTest({
    depot,
    client: avecReponses ? f.client : interdit,
    donnees: port,
    gestionnaires: { transcrire },
  });
  return { issue: await executerEtape(deps, t.id), appels: interdit.appels, deps };
}

describe("un enregistrement court et interrompu exige les deux vérifications", () => {
  it("« court » confirmé seul : la vérification des entrées sans accord attend encore", async () => {
    const r = await executer({ ...COURT_ET_INTERROMPU, courtConfirme: true }, false);
    expect(r.issue).toBe("attente_will");
    expect(r.appels).toBe(0);
  });

  it("entrées vérifiées seules : la question « court » attend encore", async () => {
    const r = await executer({ ...COURT_ET_INTERROMPU, fenetresVerifiees: true }, false);
    expect(r.issue).toBe("attente_will");
    expect(r.appels).toBe(0);
  });

  it("les deux gestes : transcrit", async () => {
    const r = await executer(
      { ...COURT_ET_INTERROMPU, courtConfirme: true, fenetresVerifiees: true },
      true,
    );
    expect(r.issue).toBe("reussie");
  });

  it("les deux questions sont posées ensemble dans l'alerte", async () => {
    const r = await executer(COURT_ET_INTERROMPU, false);
    expect(r.deps.alertes[0]?.message).toMatch(/moins de 90 secondes/);
    expect(r.deps.alertes[0]?.message).toMatch(/sans la liste des personnes sans accord/);
  });
});
