// @vitest-environment node
/**
 * ⛔ UN COÛT NON INSCRIT PENDANT L'ARRÊT RESTE UN ARRÊT (V1 F3).
 *
 * Un appel annulé en vol inscrit son estimation au registre des coûts. Si
 * cette écriture lève (base coupée pendant l'arrêt), l'erreur du registre
 * remontait telle quelle : classée PASSAGÈRE et COMPTÉE comme un essai, alors
 * que l'étape n'avait fait que s'arrêter. Elle relève désormais
 * `AppelInterrompu` (avec l'échec du registre attaché, journalisé par
 * `executerEtape`), et l'étape est relâchée sans compter d'essai.
 *
 * Mutation qui rougit : retirer le `try` autour d'`appelAnnuleEnVol` dans
 * `passe.ts` ou `transcrire-tranche.ts`. Contre-témoin : registre joignable,
 * l'estimation est inscrite et l'erreur n'emporte aucun échec de registre.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { executerEtape, type Gestionnaire } from "../../etapes";
import { SCHEMAS_VISIO } from "../../schemas";
import type { ClientOpenAIVisio } from "../client";
import type { PortCout } from "../cout";
import { AppelInterrompu } from "../erreurs";
import { executerPasse } from "../passe";
import { transcrireTranche } from "../transcrire-tranche";
import { depsDeTest, FauxDepot } from "../../../../../tests/outils/faux-circuit-visio";

afterEach(() => vi.restoreAllMocks());

const interrompu: ClientOpenAIVisio = {
  transcrire: async () => {
    throw new AppelInterrompu(true);
  },
  repondre: async () => {
    throw new AppelInterrompu(true);
  },
};

function registre(enPanne: boolean) {
  const inscrits: number[] = [];
  const port: PortCout = {
    verifierPlafond: async () => undefined,
    enregistrer: async (e) => {
      if (enPanne) throw new Error("base injoignable");
      inscrits.push(e.costUsd);
    },
  };
  return { port, inscrits };
}

const PASSE = {
  passe: "consolider" as const,
  schema: SCHEMAS_VISIO.consolidation.schema,
  nomSchema: SCHEMAS_VISIO.consolidation.nom,
  instructions: "i",
  entree: "e",
  jobId: "j",
};

describe("⛔ un coût non inscrit pendant l'arrêt reste un arrêt", () => {
  it("passe et tranche : l'échec du registre relève AppelInterrompu", async () => {
    const r = registre(true);
    const e1 = await executerPasse({ client: interrompu, cout: r.port }, PASSE).catch((e) => e);
    expect(e1).toBeInstanceOf(AppelInterrompu);
    expect((e1 as AppelInterrompu).echecRegistre).toBeInstanceOf(Error);
    const e2 = await transcrireTranche(
      { client: interrompu, cout: r.port },
      { octets: Buffer.from("x"), dureeMs: 1000, niveauFinMuet: true, decalageMs: 0, jobId: "j" },
    ).catch((e) => e);
    expect(e2).toBeInstanceOf(AppelInterrompu);
    expect((e2 as AppelInterrompu).echecRegistre).toBeInstanceOf(Error);
  });

  it("l'étape est relâchée sans compter d'essai, et l'échec est journalisé", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "consolider",
    });
    const g: Gestionnaire = async () => {
      await executerPasse({ client: interrompu, cout: registre(true).port }, PASSE);
      return { ecrire: async () => [] };
    };
    const deps = depsDeTest({ depot, gestionnaires: { consolider: g } });
    expect(await executerEtape(deps, t.id)).toBe("relachee");
    expect(depot.ligne(t.id)).toMatchObject({ statut: "a_faire", echecs: 0 });
    expect(journal).toHaveBeenCalledTimes(1);
  });

  it("contre-témoin : registre joignable, l'estimation est inscrite", async () => {
    const r = registre(false);
    const e = await executerPasse({ client: interrompu, cout: r.port }, PASSE).catch((x) => x);
    expect(e).toBeInstanceOf(AppelInterrompu);
    expect((e as AppelInterrompu).echecRegistre).toBeNull();
    expect(r.inscrits).toHaveLength(1);
  });
});
