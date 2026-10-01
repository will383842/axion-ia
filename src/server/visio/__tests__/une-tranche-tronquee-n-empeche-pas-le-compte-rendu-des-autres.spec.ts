/**
 * ⛔ UNE TRANCHE TRONQUÉE N'EMPÊCHE PAS LE COMPTE RENDU DES AUTRES (V2, M2).
 *
 * Avant : une seule tranche jugée « tronquée » (ou dont l'empreinte diverge)
 * levait une erreur de classe `contenu` ; un essai de plus donnait la même
 * sortie, puis TOUTE l'étape `transcrire` passait en échec définitif. Un appel
 * déjà payé n'avait aucun compte rendu, pour 43 ms de bruit de clavier mesurés
 * à l'arrêt du `MediaRecorder`.
 *
 * Désormais : la tranche tronquée est réessayée UNE fois sur place ; si elle
 * l'est encore, ses segments partiels gardent leur place et la tranche passe
 * `echec`. Une tranche illisible (empreinte divergente) passe `echec` sans
 * appel. Les autres tranches sont transcrites et le circuit continue.
 *
 * Mutation qui rougit : relancer l'erreur au lieu d'écrire la tranche en
 * échec (1er et 2e cas : l'étape n'est plus « reussie »). Contre-témoin : une
 * troncature qui disparaît au second essai donne une tranche `transcrite`.
 */

import { describe, expect, it } from "vitest";

import { executerEtape } from "../etapes";
import { ErreurVisio } from "../openai/erreurs";
import { transcrire } from "../recevoir-transcription";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient } from "../../../../tests/outils/faux-openai-visio";
import { enregistrement, portTranscription } from "./outils-pipeline";

const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";
const complete = {
  text: "…",
  segments: [{ start: 0, end: 170, speaker: "A", text: "jusqu'au bout" }],
};
const coupee = {
  text: "…",
  segments: [{ start: 0, end: 60, speaker: "A", text: "le début seulement" }],
};

function parlante() {
  const e = enregistrement();
  return enregistrement({
    tranches: e.tranches.map((t) => ({ ...t, niveauFinMuet: false })),
  });
}

function statuts(port: ReturnType<typeof portTranscription>["port"]) {
  const vus: Record<string, string> = {};
  const ecrire = port.ecrireSegmentsTranche!;
  port.ecrireSegmentsTranche = async (tx, a) => {
    vus[a.trancheId] = a.statutTranche ?? "transcrite";
    return ecrire(tx, a);
  };
  return vus;
}

describe("une tranche tronquée n'empêche pas le compte rendu des autres", () => {
  it("tronquée deux fois : segments partiels gardés, tranche en échec, l'étape réussit", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const { port, ecrits } = portTranscription(parlante());
    const vus = statuts(port);
    const f = fauxClient(undefined, { transcriptions: [coupee, coupee, complete] });
    const deps = depsDeTest({
      depot,
      client: f.client,
      donnees: port,
      gestionnaires: { transcrire },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(vus).toEqual({ tc0: "echec", ta0: "transcrite" });
    expect(ecrits.find((x) => x.trancheId === "tc0")?.segments.map((s) => s.texte)).toEqual([
      "le début seulement",
    ]);
    expect(depot.lignes.map((l) => l.etape)).toContain("precontroler");
  });

  it("empreinte divergente : la tranche passe en échec sans appel, les autres continuent", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const { port } = portTranscription(parlante());
    const vus = statuts(port);
    port.lireSonTranche = async (id) => {
      if (id === "tc0") throw new ErreurVisio("contenu", "audio_incomplet", "empreinte");
      return Buffer.from(id);
    };
    const f = fauxClient(undefined, { transcriptions: [complete] });
    const deps = depsDeTest({
      depot,
      client: f.client,
      donnees: port,
      gestionnaires: { transcrire },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(vus).toEqual({ tc0: "echec", ta0: "transcrite" });
    expect(f.demandesTranscription).toHaveLength(1);
  });

  it("contre-témoin : une troncature qui disparaît au second essai donne une tranche transcrite", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const { port } = portTranscription(parlante());
    const vus = statuts(port);
    const f = fauxClient(undefined, { transcriptions: [coupee, complete, complete] });
    const deps = depsDeTest({
      depot,
      client: f.client,
      donnees: port,
      gestionnaires: { transcrire },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(vus).toEqual({ tc0: "transcrite", ta0: "transcrite" });
  });
});
