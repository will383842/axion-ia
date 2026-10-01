/**
 * Un choix MANUEL de rendez-vous n'est jamais écrasé par la pré-sélection
 * (relecture du 2026-10-01). Défaut corrigé : la pré-sélection se réappliquait
 * à chaque « Actualiser » pendant 30 min ; Will choisissait B, actualisait, et
 * revenait sur A — l'enregistrement partait sur le mauvais client.
 *
 *   · la pré-sélection ne s'applique QU'UNE fois (la mémoire est consommée) ;
 *   · un choix manuel efface la mémoire.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { chargerServiceWorker, DEPUIS_LA_CONSOLE } from "./harnais-service-worker";

const A = { rencontreId: "rencontre-a", calendlyEventId: "evt_A" };
const B = { rencontreId: "rencontre-b", calendlyEventId: "evt_B" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("un choix manuel n'est jamais écrasé par la pré-sélection", () => {
  it("« Oui » sur A pré-sélectionne A, une seule fois", async () => {
    const sw = await chargerServiceWorker({ rencontres: [A, B] });
    await sw.envoyer({ type: "visio_a_enregistrer", identifiant: "evt_A" }, DEPUIS_LA_CONSOLE);
    expect(sw.dernierEtat()["rencontreChoisie"]).toBe("rencontre-a");
    expect(sw.dernierEtat()["miseEnAvant"]).toBe(true);
    // Consommée : rien ne la réappliquera.
    expect(sw.session.get("aEnregistrer")).toBeNull();
  });

  it("Will choisit B puis actualise : B reste choisi", async () => {
    const sw = await chargerServiceWorker({ rencontres: [A, B] });
    await sw.envoyer({ type: "visio_a_enregistrer", identifiant: "evt_A" }, DEPUIS_LA_CONSOLE);
    await sw.envoyer({ type: "choisir_rencontre", rencontreId: "rencontre-b", manuel: true });
    await sw.envoyer({ type: "actualiser" });
    await sw.envoyer({ type: "lire_etat" });
    expect(sw.dernierEtat()["rencontreChoisie"]).toBe("rencontre-b");
    expect(sw.dernierEtat()["miseEnAvant"]).toBe(false);
  });

  it("un choix manuel AVANT l'arrivée de la liste efface aussi la mémoire", async () => {
    const sw = await chargerServiceWorker({ rencontres: [] });
    await sw.envoyer({ type: "visio_a_enregistrer", identifiant: "evt_A" }, DEPUIS_LA_CONSOLE);
    expect(sw.session.get("aEnregistrer")).not.toBeNull();
    await sw.envoyer({ type: "choisir_rencontre", rencontreId: "rencontre-b", manuel: true });
    expect(sw.session.get("aEnregistrer")).toBeNull();
  });
});
