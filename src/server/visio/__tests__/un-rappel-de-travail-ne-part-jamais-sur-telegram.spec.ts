// @vitest-environment node
/**
 * ⛔ Les RAPPELS DE TRAVAIL ne partent jamais sur Telegram, et le balayage n'en
 * fabrique aucun : « rendez-vous tenu sans compte rendu » est la pastille
 * « À faire le point » qui existe déjà (correction anti-doublon A3) — pas une
 * seconde alerte. Will a refusé le 27/09 le rappel Telegram après l'appel ; la
 * question B17 est sans réponse.
 *
 * Mutation qui fait rougir : faire écrire au balayage une alerte pour un
 * rendez-vous tenu sans compte rendu (dans `alerteSysteme` ou `alerteVisio`),
 * ou appeler `notify()` pour lui → le 1ᵉʳ test rougit.
 * Contre-témoin : une PANNE technique (étape du balayage en échec) s'écrit dans
 * `AlerteSysteme` et part bien sur Telegram.
 * Angle mort : le jour où Will répond « oui » à B17, ce test change avec sa
 * décision citée.
 */

import { describe, expect, it, vi } from "vitest";

import {
  dossierEnMemoire,
  fiche,
  id,
} from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { VISIO_BALAYAGE_EN_PANNE } from "../alertes";
import { passerBalayage } from "../balayage";
import { creerEnMemoire } from "./_alertes-en-memoire";

const MAINTENANT = new Date("2026-10-08T14:00:00Z");
const BORNE = new Date("2026-10-01T00:00:00Z");

describe("⛔ un rappel de travail ne part jamais sur Telegram", () => {
  it("un rendez-vous tenu sans compte rendu : aucune alerte, rien vers notify()", async () => {
    const f = fiche({ raisonSociale: "Fiche Fictive" });
    const base = dossierEnMemoire({
      client: [f],
      battementCircuit: [
        {
          nom: "balayage",
          premierLe: BORNE,
          dernierLe: BORNE,
          drapeauVuParWorker: "true",
          version: "x",
        },
      ],
      rencontre: [
        {
          id: id(5),
          source: "saisie_manuelle",
          type: "visio",
          titre: "Rendez-vous",
          clientId: f["id"],
          rattachementStatut: "valide",
          statut: "planifie",
          estTestInterne: false,
          repriseHistorique: false,
          debutPrevu: new Date("2026-10-06T08:00:00Z"),
          finPrevue: new Date("2026-10-06T08:45:00Z"),
        },
      ],
    });
    const notify = vi.fn(async () => ({ ok: true, channels: { telegram: "sent" as const } }));
    const creer = vi.fn(creerEnMemoire(base));
    const r = await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: notify,
      creerAlerte: creer,
    });
    expect(r.etapesEnEchec).toEqual([]);
    expect(base.tables["alerteSysteme"] ?? []).toHaveLength(0);
    expect(base.tables["alerteVisio"] ?? []).toHaveLength(0);
    expect(creer).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("contre-témoin : une panne du balayage s'écrit dans AlerteSysteme et part sur Telegram", async () => {
    const base = dossierEnMemoire();
    const client = base.client as unknown as Record<string, unknown>;
    // L'étape « suites » lève : panne technique.
    const casse = new Proxy(client, {
      get(c, nom: string) {
        if (nom === "rencontreSuivi") {
          return {
            findMany: async () => {
              throw new Error("table absente");
            },
          };
        }
        return c[nom];
      },
    });
    const notify = vi.fn(async () => ({ ok: true, channels: { telegram: "sent" as const } }));
    const r = await passerBalayage(casse as never, {
      maintenant: MAINTENANT,
      notifier: notify,
      creerAlerte: creerEnMemoire(base),
    });
    expect(r.etapesEnEchec).toEqual(["suites"]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(base.tables["alerteSysteme"]?.map((a) => a["code"])).toEqual([VISIO_BALAYAGE_EN_PANNE]);
    expect(base.tables["alerteVisio"] ?? []).toHaveLength(0);
  });
});
