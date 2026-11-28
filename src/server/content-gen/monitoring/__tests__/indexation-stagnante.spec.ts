import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  detecterIndexationStagnante,
  type DepsIndexationStagnante,
  type MesurePage,
} from "../indexation-stagnante";

const MAINTENANT = new Date("2026-11-27T10:00:00Z");
const JOUR = 86_400_000;

function article(slug: string, ageJours: number) {
  return {
    slug,
    isNews: false,
    templateVariant: null,
    publishedAt: new Date(MAINTENANT.getTime() - ageJours * JOUR),
  };
}

function deps(surcharge: Partial<DepsIndexationStagnante> = {}): DepsIndexationStagnante {
  return {
    maintenant: () => MAINTENANT,
    lireArticles: async () => [article("a-guide", 60)],
    lireJoursCouverts: async () => 28,
    signalerSourceInsuffisante: vi.fn(),
    lireMesures: async () => new Map([["/fr/blog/a-guide", { impressions: 3, clics: 0 }]]),
    reserverAlerte: async () => true,
    alerter: vi.fn(async () => undefined),
    ...surcharge,
  };
}

describe("detecterIndexationStagnante : vrais chiffres Search Console", () => {
  it("alerte avec les impressions et le CTR réels, jamais un zéro codé en dur", async () => {
    const d = deps({
      lireMesures: async () => new Map([["/fr/blog/a-guide", { impressions: 4, clics: 0 }]]),
    });
    await detecterIndexationStagnante(d);
    expect(d.alerter).toHaveBeenCalledTimes(1);
    expect(d.alerter).toHaveBeenCalledWith("a-guide", 0, 60, 4);
  });

  it("CTR réel calculé : 500 impressions et 2 clics = 0,4 %", async () => {
    const d = deps({
      lireMesures: async () => new Map([["/fr/blog/a-guide", { impressions: 500, clics: 2 }]]),
    });
    await detecterIndexationStagnante(d);
    expect(d.alerter).toHaveBeenCalledWith("a-guide", 0.4, 60, 500);
  });

  it("page qui vit (500 impressions, 25 clics) : aucune alerte", async () => {
    const d = deps({
      lireMesures: async () => new Map([["/fr/blog/a-guide", { impressions: 500, clics: 25 }]]),
    });
    await detecterIndexationStagnante(d);
    expect(d.alerter).not.toHaveBeenCalled();
  });

  it("article trop récent : aucune alerte", async () => {
    const d = deps({ lireArticles: async () => [article("neuf", 10)] });
    await detecterIndexationStagnante(d);
    expect(d.alerter).not.toHaveBeenCalled();
  });

  it("route résolue par le SSOT (guide hors /blog)", async () => {
    const lireMesures = vi.fn(
      async () => new Map<string, { impressions: number; clics: number }>(),
    );
    const d = deps({
      lireArticles: async () => [{ ...article("g", 60), templateVariant: "guide" }],
      lireMesures,
    });
    await detecterIndexationStagnante(d);
    const chemins = (lireMesures.mock.calls[0] as unknown as [string[]])[0];
    expect(chemins).toHaveLength(1);
    expect(chemins[0]).toMatch(/^\/fr\/[a-z-]+\/g$/);
  });
});

describe("detecterIndexationStagnante : seuils et fenêtre", () => {
  const avec = (impressions: number, clics: number) =>
    deps({
      lireMesures: async () => new Map([["/fr/blog/a-guide", { impressions, clics }]]),
    });

  it("9 impressions : stagnante ; 10 avec un bon CTR : non", async () => {
    const a = avec(9, 1);
    await detecterIndexationStagnante(a);
    expect(a.alerter).toHaveBeenCalledTimes(1);
    const b = avec(10, 1);
    await detecterIndexationStagnante(b);
    expect(b.alerter).not.toHaveBeenCalled();
  });

  it("99 impressions sans clic : pas de verdict de CTR ; 100 sans clic : stagnante", async () => {
    const a = avec(99, 0);
    await detecterIndexationStagnante(a);
    expect(a.alerter).not.toHaveBeenCalled();
    const b = avec(100, 0);
    await detecterIndexationStagnante(b);
    expect(b.alerter).toHaveBeenCalledTimes(1);
  });

  it("article de exactement 30 jours : examiné", async () => {
    const d = deps({ lireArticles: async () => [article("a-guide", 30)] });
    await detecterIndexationStagnante(d);
    expect(d.alerter).toHaveBeenCalledTimes(1);
  });

  it("fenêtre de 28 jours calendaires pleins (minuit UTC)", async () => {
    const lireMesures = vi.fn(async () => new Map<string, MesurePage>());
    await detecterIndexationStagnante(deps({ lireMesures }));
    const depuis = (lireMesures.mock.calls[0] as unknown as [string[], Date])[1];
    expect(depuis.toISOString()).toBe("2026-10-30T00:00:00.000Z");
  });

  it("au-delà des 5 premiers, un article déjà réservé ne bloque pas les suivants", async () => {
    const reserves = new Set(["s0", "s1", "s2", "s3", "s4"]);
    const d = deps({
      lireArticles: async () => Array.from({ length: 8 }, (_, i) => article(`s${i}`, 60)),
      lireMesures: async () => new Map(),
      reserverAlerte: async (slug) => !reserves.has(slug),
    });
    await detecterIndexationStagnante(d);
    expect(d.alerter).toHaveBeenCalledTimes(3);
  });
});

describe("detecterIndexationStagnante : anti-répétition", () => {
  it("pas de seconde alerte quand la réservation de 30 jours existe déjà", async () => {
    const d = deps({ reserverAlerte: async () => false });
    await detecterIndexationStagnante(d);
    expect(d.alerter).not.toHaveBeenCalled();
  });

  it("deux passages de suite : une seule alerte", async () => {
    const vus = new Set<string>();
    const reserverAlerte = async (slug: string) => {
      if (vus.has(slug)) return false;
      vus.add(slug);
      return true;
    };
    const d = deps({ reserverAlerte });
    await detecterIndexationStagnante(d);
    await detecterIndexationStagnante(d);
    expect(d.alerter).toHaveBeenCalledTimes(1);
  });

  it("réservation impossible (Redis en panne) : aucune alerte plutôt qu'un spam", async () => {
    const d = deps({
      reserverAlerte: async () => {
        throw new Error("redis down");
      },
    });
    await expect(detecterIndexationStagnante(d)).rejects.toThrow("redis down");
    expect(d.alerter).not.toHaveBeenCalled();
  });

  it("au plus 5 alertes par passage", async () => {
    const d = deps({
      lireArticles: async () => Array.from({ length: 9 }, (_, i) => article(`s${i}`, 60)),
      lireMesures: async () => new Map(),
    });
    await detecterIndexationStagnante(d);
    expect(d.alerter).toHaveBeenCalledTimes(5);
  });
});

describe("detecterIndexationStagnante : source indisponible = aucune alerte", () => {
  it("lecture des jours couverts en échec (table absente)", async () => {
    const d = deps({
      lireJoursCouverts: async () => {
        throw new Error("relation gsc_page_jours does not exist");
      },
    });
    // L'échec remonte (journal + Sentry par processJob) : jamais d'alerte, jamais invisible.
    await expect(detecterIndexationStagnante(d)).rejects.toThrow("gsc_page_jours");
    expect(d.alerter).not.toHaveBeenCalled();
  });

  it("table vide ou robot éteint (moins de 24 jours couverts) : pas de zéros, mais signalé", async () => {
    const d = deps({ lireJoursCouverts: async () => 23 });
    await detecterIndexationStagnante(d);
    expect(d.alerter).not.toHaveBeenCalled();
    expect(d.signalerSourceInsuffisante).toHaveBeenCalledWith(23);
  });

  it("24 jours couverts : la veille tourne", async () => {
    const d = deps({ lireJoursCouverts: async () => 24 });
    await detecterIndexationStagnante(d);
    expect(d.alerter).toHaveBeenCalledTimes(1);
  });

  it("lecture des mesures en échec", async () => {
    const d = deps({
      lireMesures: async () => {
        throw new Error("boom");
      },
    });
    await expect(detecterIndexationStagnante(d)).rejects.toThrow("boom");
    expect(d.alerter).not.toHaveBeenCalled();
  });
});

describe("câblage (le défaut d'origine ne doit pas revenir)", () => {
  const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("le worker n'appelle plus alertIndexationStagnant avec des zéros codés en dur", () => {
    const src = lire("src/server/queue/workers/content-monitoring-worker.ts");
    expect(src).not.toMatch(/alertIndexationStagnant\(\s*s\.slug,\s*0,\s*daysSince,\s*0\s*\)/);
    expect(src).not.toMatch(/keywordTracking\.count/);
    expect(src).toContain("detecterIndexationStagnante");
  });

  it("la veille d'indexation a son propre cron hebdomadaire, et n'est plus dans le tick horaire", () => {
    const q = lire("src/server/queue/queues.ts");
    expect(q).toMatch(/jobId: "content-monitoring-indexation-hebdo-cron"/);
    const w = lire("src/server/queue/workers/content-monitoring-worker.ts");
    expect(w).toMatch(/INDEXATION_HEBDO_TRIGGER/);
    expect(w).not.toMatch(/\["indexationStagnant", checkIndexationStagnant\(\)\],\s*\["anomalies"/);
  });
});
