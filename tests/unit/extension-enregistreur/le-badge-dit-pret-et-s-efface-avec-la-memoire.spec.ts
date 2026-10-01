/**
 * Le badge de l'icône (relecture du 2026-10-01) : quand Chrome refuse
 * d'ouvrir le panneau, il dit « PRÊT » — jamais « REC », qui ferait croire à
 * un enregistrement en cours. Il s'efface avec la mémoire : « Non », ou
 * expiration des 30 minutes.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { DUREE_MEMOIRE_MS } from "../../../extensions/enregistreur-meet/lib/visio-a-enregistrer.js";
import { chargerServiceWorker, DEPUIS_LA_CONSOLE } from "./harnais-service-worker";

const OUI = { type: "visio_a_enregistrer", identifiant: "evt_A" };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("le badge dit « PRÊT » et s'efface avec la mémoire", () => {
  it("panneau refusé par Chrome : « PRÊT », jamais « REC »", async () => {
    const sw = await chargerServiceWorker({ rencontres: [], ouvertureRefusee: true });
    await sw.envoyer(OUI, DEPUIS_LA_CONSOLE);
    expect(sw.ouvertures).toBe(1);
    expect(sw.badges.at(-1)).toBe("PRÊT");
    expect(sw.badges).not.toContain("REC");
  });

  it("« Non » efface la mémoire et le badge", async () => {
    const sw = await chargerServiceWorker({ rencontres: [], ouvertureRefusee: true });
    await sw.envoyer(OUI, DEPUIS_LA_CONSOLE);
    await sw.envoyer({ type: "visio_sans_enregistrement" }, DEPUIS_LA_CONSOLE);
    expect(sw.badges.at(-1)).toBe("");
    expect(sw.session.get("aEnregistrer")).toBeNull();
  });

  it("à l'expiration (30 min), une alarme efface la mémoire et le badge", async () => {
    const t0 = Date.now();
    const sw = await chargerServiceWorker({ rencontres: [], ouvertureRefusee: true });
    await sw.envoyer(OUI, DEPUIS_LA_CONSOLE);
    const a = sw.alarmesCreees.find((x) => x.nom === "visio-a-enregistrer");
    expect(a?.when).toBeGreaterThanOrEqual(t0 + DUREE_MEMOIRE_MS);
    vi.spyOn(Date, "now").mockReturnValue(t0 + DUREE_MEMOIRE_MS + 60_000);
    await sw.alarme("visio-a-enregistrer");
    expect(sw.badges.at(-1)).toBe("");
    expect(sw.session.get("aEnregistrer")).toBeNull();
  });
});
