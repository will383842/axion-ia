// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  lireSuiviArrivee,
  parametresDuChoix,
  provenanceEnBloc,
  avecUtmContent,
} from "../choix-rendez-vous";
import {
  normaliserPageOrigine,
  pageOrigineDepuisReferer,
  suiviOrigineActif,
} from "../page-origine";

const HOTES = ["axion-ia.com", "www.axion-ia.com"];

describe("normaliserPageOrigine", () => {
  it("accepte un chemin d'article, rien d'autre", () => {
    expect(normaliserPageOrigine("/fr/blog/former-ses-equipes-a-l-ia")).toBe(
      "/fr/blog/former-ses-equipes-a-l-ia",
    );
    for (const mauvais of [
      "/fr/appel",
      "/fr/blog",
      "/fr/blog/a/b",
      "https://evil.test/fr/blog/x",
      "//evil.test/fr/blog/x",
      "/fr/blog/x?utm_source=y",
      "/fr/blog/X",
      "/fr/blog/" + "a".repeat(200),
      "",
      42,
      null,
      undefined,
    ]) {
      expect(normaliserPageOrigine(mauvais)).toBeNull();
    }
  });
});

describe("pageOrigineDepuisReferer", () => {
  it("lit le chemin d'un article du site, sans requête ni ancre", () => {
    expect(
      pageOrigineDepuisReferer("https://axion-ia.com/fr/blog/mon-article/?x=1#haut", HOTES),
    ).toBe("/fr/blog/mon-article");
  });
  it("refuse un autre domaine, une page hors articles, une valeur illisible", () => {
    expect(pageOrigineDepuisReferer("https://evil.test/fr/blog/mon-article", HOTES)).toBeNull();
    expect(pageOrigineDepuisReferer("https://axion-ia.com/fr/contact", HOTES)).toBeNull();
    expect(pageOrigineDepuisReferer("pas une url", HOTES)).toBeNull();
    expect(pageOrigineDepuisReferer(null, HOTES)).toBeNull();
  });
});

describe("interrupteur", () => {
  it("seul « true » exact allume le suivi", () => {
    expect(suiviOrigineActif({ CONTENT_CHAINE_SUIVI: "true" })).toBe(true);
    for (const v of [undefined, "", "1", "TRUE", " true"]) {
      expect(suiviOrigineActif({ CONTENT_CHAINE_SUIVI: v } as never)).toBe(false);
    }
  });
});

describe("la page d'origine voyage dans le suivi, jamais dans utm_content", () => {
  it("est lue, bornée, puis recopiée par les liens du parcours", () => {
    const suivi = lireSuiviArrivee({ po: "/fr/blog/mon-article", depuis: "blog-article" });
    expect(suivi.po).toBe("/fr/blog/mon-article");
    expect(parametresDuChoix("diagnostic", "blog-article", suivi)).toContain(
      "po=%2Ffr%2Fblog%2Fmon-article",
    );
  });
  it("une valeur non conforme est abandonnée", () => {
    expect(lireSuiviArrivee({ po: "https://evil.test" }).po).toBeUndefined();
  });
  it("ne part JAMAIS chez Calendly (ni utm_content ni utm_term)", () => {
    const suivi = lireSuiviArrivee({ po: "/fr/blog/mon-article", utm_source: "linkedin" });
    expect(avecUtmContent("https://calendly.com/x/y", suivi)).not.toContain("blog");
    const bloc = provenanceEnBloc(suivi, {});
    expect(JSON.stringify(bloc)).not.toContain("mon-article");
  });
});
