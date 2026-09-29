// @vitest-environment node
/**
 * ⛔ Les RAPPELS DE TRAVAIL (F1 « rendez-vous tenu sans compte rendu »,
 * comptes rendus à valider, suites échues, veille) restent dans la CONSOLE :
 * Will a refusé le 27/09 le rappel Telegram après l'appel, et la question
 * B17 est sans réponse. `F1_SUR_TELEGRAM` vaut `false` et le balayage ne
 * passe JAMAIS un rappel à `notify()`.
 *
 * Mutation qui fait rougir : `F1_SUR_TELEGRAM = true` → les deux tests
 * rougissent. Contre-témoin : une PANNE technique (étape du balayage en
 * échec) part bien sur Telegram.
 * Angle mort : le jour où Will répond « oui » à B17, ce test change avec la
 * constante — dans la même PR, avec sa décision citée.
 */

import { describe, expect, it, vi } from "vitest";

import {
  dossierEnMemoire,
  fiche,
  id,
} from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import { canalDesRappels, F1_SUR_TELEGRAM } from "../alertes";
import { passerBalayage } from "../balayage";

const MAINTENANT = new Date("2026-10-08T14:00:00Z");
const BORNE = new Date("2026-10-01T00:00:00Z");

describe("⛔ un rappel de travail ne part jamais sur Telegram", () => {
  it("la décision B17 n'est pas prise : console seulement", () => {
    expect(F1_SUR_TELEGRAM).toBe(false);
    expect(canalDesRappels()).toBe("console");
  });

  it("un rendez-vous tenu sans compte rendu : alerte en base, rien vers notify()", async () => {
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
    const r = await passerBalayage(base.client as never, {
      maintenant: MAINTENANT,
      notifier: notify,
    });
    expect(r.f1).toBe(1);
    expect(base.tables["alerteVisio"]?.map((a) => a["cle"])).toEqual([
      expect.stringMatching(/^f1:/),
    ]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("contre-témoin : une panne du balayage part sur Telegram", async () => {
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
    const r = await passerBalayage(casse as never, { maintenant: MAINTENANT, notifier: notify });
    expect(r.etapesEnEchec).toEqual(["suites"]);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
