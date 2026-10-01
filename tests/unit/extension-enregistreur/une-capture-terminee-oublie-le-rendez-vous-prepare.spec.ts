/**
 * Une capture qui se termine efface le « rendez-vous à enregistrer »
 * (relecture du 2026-10-01) : la phase « termine » ne doit jamais faire
 * re-pré-sélectionner un rendez-vous préparé PENDANT la capture précédente.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { captureVientDeFinir } from "../../../extensions/enregistreur-meet/lib/visio-a-enregistrer.js";
import { chargerServiceWorker, DEPUIS_LA_CONSOLE } from "./harnais-service-worker";

afterEach(() => {
  vi.doUnmock("../../../extensions/enregistreur-meet/stockage-local.js");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("une capture terminée oublie le rendez-vous préparé", () => {
  it("la fin d'une capture (arrêt, refus, destruction) est reconnue", () => {
    expect(captureVientDeFinir("en_cours", "termine")).toBe(true);
    expect(captureVientDeFinir("accord_en_attente", "detruit")).toBe(true);
    expect(captureVientDeFinir("en_cours", "detruit")).toBe(true);
    expect(captureVientDeFinir("repos", "accord_en_attente")).toBe(false);
    expect(captureVientDeFinir("termine", "termine")).toBe(false);
  });

  it("« Oui » cliqué pendant la capture, puis « Arrêter » : rien n'est re-pré-sélectionné", async () => {
    const sw = await chargerServiceWorker({
      rencontres: [{ rencontreId: "rencontre-b", calendlyEventId: "evt_B" }],
      captureInitiale: {
        phase: "en_cours",
        cleClient: "11111111-2222-4333-8444-555555555555",
        rencontreId: "rencontre-a",
        debutMs: Date.now() - 60_000,
        fenetresHorsAccord: [],
      },
    });
    await sw.envoyer({ type: "visio_a_enregistrer", identifiant: "evt_B" }, DEPUIS_LA_CONSOLE);
    expect(sw.session.get("aEnregistrer")).not.toBeNull();
    await sw.envoyer({ type: "arreter" });
    expect(sw.session.get("aEnregistrer")).toBeNull();
    await sw.envoyer({ type: "actualiser" });
    expect(sw.dernierEtat()["rencontreChoisie"]).not.toBe("rencontre-b");
    expect(sw.dernierEtat()["miseEnAvant"]).toBe(false);
  });
});
