import { describe, expect, it, vi } from "vitest";
import {
  PLANCHER_IMPRESSIONS_BAISSE,
  QUOTA_INSPECTIONS_JOUR,
  choisirCandidatsMiseAJour,
  declencheursMiseAJour,
  extraireLiens,
  jalonsDus,
  suivreArticles,
  type ArticleSuivi,
  type MagasinSuivi,
} from "./suivi-publication";

const JOUR = 86_400_000;
const NOW = new Date("2026-11-26T10:00:00Z");
const il_y_a = (j: number) => new Date(NOW.getTime() - j * JOUR);

function magasin(): MagasinSuivi & { faits: Set<string>; utilise: number } {
  const faits = new Set<string>();
  const m = {
    faits,
    utilise: 0,
    dejaFait: async (c: string) => faits.has(c),
    marquer: async (c: string) => void faits.add(c),
    reserverQuota: async (n: number, max: number) => {
      const ok = Math.min(n, Math.max(0, max - m.utilise));
      m.utilise += ok;
      return ok;
    },
    echecs: new Map<string, number>(),
    compterEchec: async (c: string) => {
      const n = (m.echecs.get(c) ?? 0) + 1;
      m.echecs.set(c, n);
      return n;
    },
    lirePositions: async () => ({ j28: null, j90: null }),
    ecrirePosition: async () => {},
  };
  return m;
}

const art = (o: Partial<ArticleSuivi> = {}): ArticleSuivi => ({
  id: "a1",
  url: "https://axion-ia.com/fr/blog/a1",
  publieLe: il_y_a(3),
  ...o,
});

describe("jalonsDus", () => {
  it("J+3 et J+7 dus pour un nouvel article, pas avant", () => {
    expect(jalonsDus(il_y_a(2), NOW)).toEqual([]);
    expect(jalonsDus(il_y_a(3), NOW)).toEqual(["inspection-j3"]);
    expect(jalonsDus(il_y_a(7), NOW)).toEqual(["inspection-j3", "inspection-j7"]);
  });
  it("article ancien : aucune inspection, mais positions J+28 / J+90", () => {
    expect(jalonsDus(il_y_a(40), NOW)).toEqual(["positions-j28"]);
    expect(jalonsDus(il_y_a(100), NOW)).toEqual(["positions-j28", "positions-j90"]);
  });
});

describe("suivreArticles (API Google simulée)", () => {
  it("inspecte J+3 une seule fois", async () => {
    const m = magasin();
    const inspecter = vi.fn(async () => ({}));
    const deps = { magasin: m, inspecter, positions: vi.fn(), maintenant: NOW };
    await suivreArticles([art()], deps);
    await suivreArticles([art()], deps);
    expect(inspecter).toHaveBeenCalledTimes(1);
  });
  it("respecte le quota : jamais plus que le budget", async () => {
    const m = magasin();
    m.utilise = QUOTA_INSPECTIONS_JOUR - 1;
    const inspecter = vi.fn(async () => ({}));
    const arts = [art({ id: "a" }), art({ id: "b", url: "https://axion-ia.com/fr/blog/b" })];
    const r = await suivreArticles(arts, {
      magasin: m,
      inspecter,
      positions: vi.fn(),
      maintenant: NOW,
    });
    expect(inspecter).toHaveBeenCalledTimes(1);
    expect(r.inspections).toBe(1);
    expect(r.reportes).toBe(1);
  });
  it("relève la position à J+28 ; une réponse nulle n'est pas marquée faite", async () => {
    const m = magasin();
    const positions = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ position: 8, impressions: 50 });
    const deps = { magasin: m, inspecter: vi.fn(), positions, maintenant: NOW };
    const a = art({ publieLe: il_y_a(30) });
    await suivreArticles([a], deps);
    expect(m.faits.size).toBe(0);
    await suivreArticles([a], deps);
    expect(m.faits.size).toBe(1);
  });
});

describe("échecs répétés", () => {
  it("abandonne le jalon après 3 échecs au lieu de réessayer sans fin", async () => {
    const m = magasin();
    const positions = vi.fn(async () => null);
    const deps = { magasin: m, inspecter: vi.fn(), positions, maintenant: NOW };
    const a = art({ publieLe: il_y_a(30) });
    for (let i = 0; i < 5; i++) await suivreArticles([a], deps);
    expect(positions).toHaveBeenCalledTimes(3);
  });
});

describe("declencheursMiseAJour (règles pures)", () => {
  const base = {
    ageJours: 20,
    positionActuelle: 5,
    positionReference: 5,
    preuveExpireLe: null,
    liensCasses: 0,
    cannibalisation: false,
  };
  it("rien à signaler", () => {
    expect(declencheursMiseAJour(base, NOW)).toEqual([]);
  });
  it("baisse de position d'au moins 3 places", () => {
    expect(
      declencheursMiseAJour({ ...base, positionActuelle: 8, impressions28j: 500 }, NOW),
    ).toEqual(["baisse-position"]);
    expect(
      declencheursMiseAJour({ ...base, positionActuelle: 7, impressions28j: 500 }, NOW),
    ).toEqual([]);
  });
  it("plancher d'impressions : 99 ne déclenche pas, 100 déclenche", () => {
    const baisse = { ...base, positionActuelle: 8 };
    expect(declencheursMiseAJour({ ...baisse, impressions28j: 99 }, NOW)).toEqual([]);
    expect(declencheursMiseAJour({ ...baisse, impressions28j: 100 }, NOW)).toEqual([
      "baisse-position",
    ]);
    expect(PLANCHER_IMPRESSIONS_BAISSE).toBe(100);
  });
  it("impressions absentes (null ou non fournies) : aucun déclenchement", () => {
    const baisse = { ...base, positionActuelle: 8 };
    expect(declencheursMiseAJour({ ...baisse, impressions28j: null }, NOW)).toEqual([]);
    expect(declencheursMiseAJour(baisse, NOW)).toEqual([]);
  });
  it("valeurs non numériques, nulles ou négatives : aucun déclenchement", () => {
    const baisse = { ...base, positionActuelle: 8 };
    for (const v of [Number.NaN, 0, -5]) {
      expect(declencheursMiseAJour({ ...baisse, impressions28j: v }, NOW)).toEqual([]);
    }
  });
  it("le plancher ne touche pas les autres raisons", () => {
    expect(
      declencheursMiseAJour({ ...base, impressions28j: null, ageJours: 180, liensCasses: 1 }, NOW),
    ).toEqual(["age-maximum", "lien-casse"]);
  });
  it("preuve expirée, lien cassé, cannibalisation", () => {
    expect(
      declencheursMiseAJour(
        { ...base, preuveExpireLe: il_y_a(1), liensCasses: 2, cannibalisation: true },
        NOW,
      ),
    ).toEqual(["preuve-expiree", "lien-casse", "cannibalisation"]);
  });
  it("filet de sécurité : âge maximal", () => {
    expect(declencheursMiseAJour({ ...base, ageJours: 180 }, NOW)).toEqual(["age-maximum"]);
  });
  it("position absente : pas de baisse inventée", () => {
    expect(declencheursMiseAJour({ ...base, positionActuelle: null }, NOW)).toEqual([]);
  });
});

describe("choisirCandidatsMiseAJour", () => {
  const sig = (id: string, ageJours: number, extra = {}) => ({
    id,
    ageJours,
    positionActuelle: 5,
    positionReference: 5,
    preuveExpireLe: null,
    liensCasses: 0,
    cannibalisation: false,
    ...extra,
  });
  const liste = [sig("vieux", 30), sig("neuf", 2, { liensCasses: 1 }), sig("calme", 5)];
  it("interrupteur éteint = règle fixe de 14 jours, comme avant", () => {
    const r = choisirCandidatsMiseAJour(liste, NOW, { CONTENT_EQUIPE_EDITORIALE: "false" });
    expect(r.map((c) => c.id)).toEqual(["vieux"]);
    expect(choisirCandidatsMiseAJour(liste, NOW, {}).map((c) => c.id)).toEqual(["vieux"]);
  });
  it("interrupteur allumé : les règles remplacent les 14 jours", () => {
    const r = choisirCandidatsMiseAJour(liste, NOW, { CONTENT_EQUIPE_EDITORIALE: "true" });
    expect(r.map((c) => c.id)).toEqual(["neuf"]);
    expect(r[0]?.raisons).toEqual(["lien-casse"]);
  });
});

describe("extraireLiens", () => {
  it("rend les href internes et externes, sans ancres ni doublons", () => {
    const html = `<a href="/fr/blog/x">x</a><a href='https://ex.org/p'>y</a><a href="#top">z</a><a href="/fr/blog/x">x</a><a href="mailto:a@b.c">m</a>`;
    expect(extraireLiens(html)).toEqual(["/fr/blog/x", "https://ex.org/p"]);
  });
});

describe("controlerLiensArticles", () => {
  it("compte les liens refusés par article et les articles touchés", async () => {
    const { controlerLiensArticles } = await import("./suivi-publication");
    const ecrits: Record<string, number> = {};
    const filtrer = async (liens: readonly { url: string }[]) =>
      liens.map((l) => ({ ...l, verdict: { ok: !l.url.includes("mort") } }));
    const n = await controlerLiensArticles(
      [
        { id: "a", corps: `<a href="https://ex.org/mort">x</a><a href="/fr/blog/y">y</a>` },
        { id: "b", corps: `<a href="/fr/blog/y">y</a>` },
        { id: "c", corps: "sans lien" },
      ],
      async (id, nb) => void (ecrits[id] = nb),
      filtrer,
    );
    expect(n).toBe(1);
    expect(ecrits).toEqual({ a: 1, b: 0 });
  });
});

describe("liens relatifs et estCannibalise", () => {
  it("un lien relatif n'est pas contrôlé donc pas compté cassé", async () => {
    const { controlerLiensArticles } = await import("./suivi-publication");
    const vus: string[] = [];
    await controlerLiensArticles(
      [{ id: "a", corps: `<a href="../x">x</a><a href="/fr/blog/y">y</a>` }],
      async () => {},
      async (liens) => {
        vus.push(...liens.map((l) => l.url));
        return liens.map((l) => ({ ...l, verdict: { ok: true } }));
      },
    );
    expect(vus).toEqual(["/fr/blog/y"]);
  });
  it("estCannibalise reconnaît une URL normalisée", async () => {
    const { estCannibalise } = await import("./suivi-publication");
    const c = [{ requete: "q", urls: ["https://axion-ia.com/fr/blog/a"], proprietaire: "x" }];
    expect(estCannibalise("https://axion-ia.com/fr/blog/a/?utm=1", c)).toBe(true);
    expect(estCannibalise("https://axion-ia.com/fr/blog/b", c)).toBe(false);
  });
});
