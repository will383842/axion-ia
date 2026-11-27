import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detecterIndexationStagnante, type DepsIndexationStagnante } from "../indexation-stagnante";

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
    await detecterIndexationStagnante(d);
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
    await detecterIndexationStagnante(d);
    expect(d.alerter).not.toHaveBeenCalled();
  });

  it("table vide ou robot éteint (moins de 14 jours couverts) : pas de zéros fabriqués", async () => {
    const d = deps({ lireJoursCouverts: async () => 3 });
    await detecterIndexationStagnante(d);
    expect(d.alerter).not.toHaveBeenCalled();
  });

  it("lecture des mesures en échec", async () => {
    const d = deps({
      lireMesures: async () => {
        throw new Error("boom");
      },
    });
    await detecterIndexationStagnante(d);
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
