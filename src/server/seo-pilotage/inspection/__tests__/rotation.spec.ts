import { describe, expect, it, vi } from "vitest";

import type { CandidatInspection } from "../priorites";
import { champsDifferents, executerRotation, type DepsRotation, type LigneInspection } from "../rotation";
import type { MagasinQuota } from "../quota";

const MAINTENANT = new Date("2026-11-27T05:00:00Z");

function quotaEnMemoire(): MagasinQuota {
  const etat = new Map<string, Record<string, number>>();
  return {
    reserver: async (cle, usage, n, plafondUsage, plafondTotal) => {
      const h = etat.get(cle) ?? {};
      const total = Object.values(h).reduce((a, b) => a + b, 0);
      const deja = h[usage] ?? 0;
      const accorde = Math.max(0, Math.min(n, plafondUsage - deja, plafondTotal - total));
      h[usage] = deja + accorde;
      etat.set(cle, h);
      return accorde;
    },
  };
}

const jamais = (chemin: string): CandidatInspection => ({
  chemin,
  modifieLe: null,
  derniereInspection: null,
  impressions14: 10,
  impressionsPrecedentes14: 10,
  noindex: false,
});

function deps(
  candidats: CandidatInspection[],
  surcharge: Partial<DepsRotation> = {},
): DepsRotation & { ecrites: LigneInspection[]; attentes: number[]; vus: string[] } {
  const ecrites: LigneInspection[] = [];
  const attentes: number[] = [];
  const vus: string[] = [];
  return {
    ecrites,
    attentes,
    vus,
    magasinQuota: quotaEnMemoire(),
    maintenant: () => MAINTENANT,
    attendre: async (ms) => void attentes.push(ms),
    chargerCandidats: async () => candidats,
    derniereLigne: async () => null,
    ecrireLigne: async (l) => void ecrites.push(l),
    marquerVue: async (chemin) => void vus.push(chemin),
    inspecter: async () => ({
      etat: "ok",
      resultat: {
        verdict: "PASS",
        couverture: "Submitted and indexed",
        canoniqueGoogle: "https://axion-ia.com/fr/a",
        canoniqueDeclaree: "https://axion-ia.com/fr/a",
        dernierPassageRobot: new Date("2026-11-25T00:00:00Z"),
      },
    }),
    ...surcharge,
  };
}

describe("rotation d'inspection", () => {
  it("écrit une ligne pour une page jamais vue, et marque la page vue", async () => {
    const d = deps([jamais("/fr/a")]);
    const r = await executerRotation(d);
    expect(r).toMatchObject({ inspectees: 1, ecrites: 1, inchangees: 0, arret: "fini" });
    expect(d.ecrites[0]).toMatchObject({ chemin: "/fr/a", verdict: "PASS" });
    expect(d.vus).toEqual(["/fr/a"]);
  });

  it("n'écrit PAS de ligne quand rien n'a changé, mais marque quand même la page vue", async () => {
    const d = deps([jamais("/fr/a")], {
      derniereLigne: async () => ({
        verdict: "PASS",
        couverture: "Submitted and indexed",
        canoniqueGoogle: "https://axion-ia.com/fr/a",
        canoniqueDeclaree: "https://axion-ia.com/fr/a",
        dernierPassageRobot: new Date("2026-11-25T00:00:00Z"),
      }),
    });
    const r = await executerRotation(d);
    expect(r).toMatchObject({ inspectees: 1, ecrites: 0, inchangees: 1 });
    expect(d.ecrites).toHaveLength(0);
    expect(d.vus).toEqual(["/fr/a"]);
  });

  it("écrit si un seul champ change (le passage du robot)", async () => {
    const d = deps([jamais("/fr/a")], {
      derniereLigne: async () => ({
        verdict: "PASS",
        couverture: "Submitted and indexed",
        canoniqueGoogle: "https://axion-ia.com/fr/a",
        canoniqueDeclaree: "https://axion-ia.com/fr/a",
        dernierPassageRobot: new Date("2026-11-01T00:00:00Z"),
      }),
    });
    expect((await executerRotation(d)).ecrites).toBe(1);
  });

  it("champsDifferents compare dates par instant et null à null", () => {
    const base: Omit<LigneInspection, "chemin"> = {
      verdict: null,
      couverture: null,
      canoniqueGoogle: null,
      canoniqueDeclaree: null,
      dernierPassageRobot: new Date("2026-11-25T00:00:00Z"),
    };
    expect(champsDifferents(base, { ...base, dernierPassageRobot: new Date("2026-11-25T00:00:00Z") })).toBe(false);
    expect(champsDifferents(base, { ...base, verdict: "FAIL" })).toBe(true);
    expect(champsDifferents(null, base)).toBe(true);
  });

  it("s'arrête au plafond de la rotation : 1 400 appels au plus", async () => {
    const liste = Array.from({ length: 1600 }, (_, i) => jamais(`/fr/p${i}`));
    const inspecter = vi.fn(async () => ({ etat: "ok" as const, resultat: { verdict: "PASS" } }));
    const d = deps(liste, { inspecter: inspecter as never });
    const r = await executerRotation(d);
    expect(inspecter).toHaveBeenCalledTimes(1400);
    expect(r).toMatchObject({ inspectees: 1400, arret: "quota_jour" });
  });

  it("le quota déjà entamé réduit d'autant la rotation", async () => {
    const liste = Array.from({ length: 50 }, (_, i) => jamais(`/fr/p${i}`));
    const d = deps(liste);
    await d.magasinQuota.reserver("gsc:inspection:quota:2026-11-26", "rotation", 1380, 1400, 2000);
    const r = await executerRotation(d);
    expect(r.inspectees).toBe(20);
    expect(r.arret).toBe("quota_jour");
  });

  it("débit ≤ 300 par minute : au moins 200 ms entre deux appels", async () => {
    const d = deps([jamais("/fr/a"), jamais("/fr/b"), jamais("/fr/c")]);
    await executerRotation(d);
    expect(d.attentes.length).toBeGreaterThanOrEqual(2);
    for (const ms of d.attentes) expect(ms).toBeGreaterThanOrEqual(200);
  });

  it("quota Google atteint : arrêt propre du passage", async () => {
    const inspecter = vi
      .fn()
      .mockResolvedValueOnce({ etat: "ok", resultat: { verdict: "PASS" } })
      .mockResolvedValue({ etat: "quota" });
    const d = deps([jamais("/fr/a"), jamais("/fr/b"), jamais("/fr/c")], {
      inspecter: inspecter as never,
    });
    const r = await executerRotation(d);
    expect(inspecter).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ inspectees: 1, arret: "quota_google" });
  });

  it("identifiants absents : aucun appel de plus, aucune réservation perdue", async () => {
    const inspecter = vi.fn().mockResolvedValue({ etat: "identifiants_absents" });
    const d = deps([jamais("/fr/a"), jamais("/fr/b")], { inspecter: inspecter as never });
    const r = await executerRotation(d);
    expect(inspecter).toHaveBeenCalledTimes(1);
    expect(r.arret).toBe("identifiants_absents");
  });

  it("une page en erreur est comptée, ne s'écrit pas, et ne bloque pas les suivantes", async () => {
    const inspecter = vi
      .fn()
      .mockResolvedValueOnce({ etat: "erreur" })
      .mockResolvedValue({ etat: "ok", resultat: { verdict: "PASS" } });
    const d = deps([jamais("/fr/a"), jamais("/fr/b")], { inspecter: inspecter as never });
    const r = await executerRotation(d);
    expect(r).toMatchObject({ inspectees: 1, echecs: 1, arret: "fini" });
    expect(d.vus).toEqual(["/fr/b"]);
  });

  it("5 erreurs de suite : arrêt (Google en panne)", async () => {
    const inspecter = vi.fn().mockResolvedValue({ etat: "erreur" });
    const d = deps(
      Array.from({ length: 20 }, (_, i) => jamais(`/fr/p${i}`)),
      { inspecter: inspecter as never },
    );
    const r = await executerRotation(d);
    expect(inspecter).toHaveBeenCalledTimes(5);
    expect(r.arret).toBe("erreurs_de_suite");
  });

  it("construit l'URL complète pour Google, sur le domaine du site", async () => {
    const inspecter = vi.fn().mockResolvedValue({ etat: "ok", resultat: { verdict: "PASS" } });
    await executerRotation(deps([jamais("/fr/a")], { inspecter: inspecter as never }));
    expect(inspecter).toHaveBeenCalledWith("https://axion-ia.com/fr/a");
  });
});
