import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBarometreJsonLd } from "../jsonld";
import {
  BAROMETRE_PATH,
  CHIFFRES_CLES,
  SOURCES,
  VARIABLES_MESUREES,
  barometrePublic,
} from "../donnees";

describe("Baromètre 2027 IA TPE/PME", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("porte les 5 chiffres clés, phrases autonomes", () => {
    expect(CHIFFRES_CLES).toHaveLength(5);
    expect(CHIFFRES_CLES.map((c) => c.valeur)).toEqual([
      "40 %",
      "38 % et 53 %",
      "18,16 %",
      "34 %",
      "68 %",
    ]);
    for (const c of CHIFFRES_CLES) expect(c.phrase).toMatch(/\d/);
  });

  it("JSON-LD Article + Dataset valides et sérialisables", () => {
    const { article, dataset } = buildBarometreJsonLd("fr");
    expect(JSON.parse(JSON.stringify(article))["@type"]).toBe("Article");
    const d = JSON.parse(JSON.stringify(dataset));
    expect(d["@type"]).toBe("Dataset");
    expect(d.creator).toMatchObject({ "@type": "Organization", name: "Axion-IA" });
    expect(d.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.variableMeasured).toHaveLength(VARIABLES_MESUREES.length);
    expect(d.citation).toHaveLength(SOURCES.length);
    expect(d.url).toContain(BAROMETRE_PATH);
  });

  it("aucun terme interdit dans les données", () => {
    const texte = JSON.stringify([CHIFFRES_CLES, SOURCES]);
    expect(texte).not.toMatch(/Grenoble|Qualiopi|financement|brouillon|€/i);
  });

  it('n\'est public que si BAROMETRE_2027_PUBLIC vaut "true"', () => {
    vi.stubEnv("BAROMETRE_2027_PUBLIC", "");
    expect(barometrePublic()).toBe(false);
    vi.stubEnv("BAROMETRE_2027_PUBLIC", "true");
    expect(barometrePublic()).toBe(true);
  });
});
