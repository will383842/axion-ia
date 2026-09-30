// @vitest-environment node
/**
 * ⛔ UN SIGTERM PENDANT UNE TRANCHE LAISSE UNE DÉPENSE AU REGISTRE (V1, F3).
 *
 * Au SIGTERM, le worker attend 25 s puis `process.exit(0)` ; un appel OpenAI
 * peut durer 120 s. L'appel en vol était TUÉ avec le processus : OpenAI l'a
 * facturé, mais aucune ligne `cost_ledger` ne l'inscrivait (le plafond
 * mensuel, partagé avec la génération de contenus, était sous-estimé), et la prise perdue
 * était imputée au plafond de 10 exécutions.
 *
 * Désormais `demanderArretDuCircuit` ANNULE l'appel en vol (AbortController) :
 * l'appel parti est inscrit au registre pour son ESTIMATION (on a pu être
 * facturé, on ne sait pas combien : on compte large), puis l'étape est
 * relâchée SANS compter d'essai, dans les 25 s de la vidange.
 *
 * Mutations qui rougissent : ne pas relier le signal au client dans
 * `construireCircuit` (1er cas : l'appel ne s'arrête jamais) ; retirer
 * l'écriture de l'estimation dans `transcrireTranche` (2e cas) ; traiter
 * `AppelInterrompu` comme une erreur passagère (3e cas : un échec compté).
 * Contre-témoin : un arrêt demandé AVANT l'appel n'inscrit aucune dépense
 * (rien n'est parti).
 * Angle mort : le montant réel d'un appel annulé reste inconnu ; l'estimation
 * est une borne, pas une facture.
 */

import { describe, expect, it } from "vitest";

import type { PrismaClient } from "../../../../prisma/generated/client";
import { construireCircuit, demanderArretDuCircuit } from "../circuit";
import { executerEtape, type Gestionnaire } from "../etapes";
import type { ClientOpenAIVisio } from "../openai/client";
import { AppelInterrompu } from "../openai/erreurs";
import { ESTIMATION_TRANCHE_USD } from "../openai/modeles";
import { transcrireTranche } from "../openai/transcrire-tranche";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxCout } from "../../../../tests/outils/faux-openai-visio";

/** Un client dont la transcription ne rend jamais la main, sauf annulation. */
function clientQuiPend(): { client: ClientOpenAIVisio; parti: () => boolean } {
  let parti = false;
  const client: ClientOpenAIVisio = {
    transcrire: (d) =>
      new Promise((_resoudre, rejeter) => {
        parti = true;
        d.signal?.addEventListener("abort", () => rejeter(new Error("Request was aborted.")));
      }),
    repondre: () => new Promise(() => undefined),
  };
  return { client, parti: () => parti };
}

const TRANCHE = {
  octets: Buffer.from("x"),
  dureeMs: 180_000,
  niveauFinMuet: true,
  decalageMs: 0,
  jobId: "visio-transcrire-r-1-e-client-0",
};

describe("⛔ un SIGTERM pendant une tranche laisse une dépense au registre", () => {
  it("l'arrêt du circuit annule l'appel en vol, qui est inscrit pour son estimation", async () => {
    const q = clientQuiPend();
    const cout = fauxCout();
    const deps = construireCircuit({
      db: {} as PrismaClient,
      openai: () => q.client,
      cout: cout.port,
    });
    const enVol = transcrireTranche({ client: deps.openai(), cout: cout.port }, TRANCHE);
    await new Promise((r) => setTimeout(r, 0));
    expect(q.parti()).toBe(true);

    demanderArretDuCircuit();

    await expect(enVol).rejects.toBeInstanceOf(AppelInterrompu);
    expect(cout.ecritures).toHaveLength(1);
    expect(cout.ecritures[0]).toMatchObject({
      jobId: TRANCHE.jobId,
      provider: "openai",
      costUsd: ESTIMATION_TRANCHE_USD,
    });
    expect(deps.arretDemande()).toBe(true);

    // Contre-témoin : un appel demandé APRÈS l'arrêt ne part pas et ne coûte rien.
    const apres = fauxCout();
    await expect(
      transcrireTranche({ client: deps.openai(), cout: apres.port }, TRANCHE),
    ).rejects.toBeInstanceOf(AppelInterrompu);
    expect(apres.ecritures).toEqual([]);
  });

  it("une étape dont l'appel est interrompu est relâchée sans compter d'essai", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "transcrire",
    });
    const g: Gestionnaire = async () => {
      throw new AppelInterrompu(true);
    };
    const deps = depsDeTest({ depot, gestionnaires: { transcrire: g } });
    expect(await executerEtape(deps, t.id)).toBe("relachee");
    expect(depot.ligne(t.id)).toMatchObject({ statut: "a_faire", echecs: 0, interruptions: 1 });
    expect(deps.alertes).toEqual([]);
  });
});
