import { describe, expect, it } from "vitest";
import { normaliserChemin } from "../chemins";

describe("normaliserChemin", () => {
  it("accepte l'hôte nu, www, http et https", () => {
    const attendu = "/fr/blog/mon-article";
    expect(normaliserChemin("https://axion-ia.com/fr/blog/mon-article")).toBe(attendu);
    expect(normaliserChemin("https://www.axion-ia.com/fr/blog/mon-article")).toBe(attendu);
    expect(normaliserChemin("http://AXION-IA.com/fr/blog/mon-article")).toBe(attendu);
  });

  it("retire le slash final, la query et le fragment", () => {
    expect(normaliserChemin("https://axion-ia.com/fr/blog/x/")).toBe("/fr/blog/x");
    expect(normaliserChemin("https://axion-ia.com/fr/blog/x//")).toBe("/fr/blog/x");
    expect(normaliserChemin("https://axion-ia.com/fr/blog/x?utm=1#haut")).toBe("/fr/blog/x");
    expect(normaliserChemin("/fr/blog/x/?a=b")).toBe("/fr/blog/x");
    expect(normaliserChemin("/fr/blog/x#ancre")).toBe("/fr/blog/x");
  });

  it("accepte un chemin seul, avec ou sans slash initial", () => {
    expect(normaliserChemin("/fr/faq")).toBe("/fr/faq");
    expect(normaliserChemin("fr/faq")).toBe("/fr/faq");
  });

  it("garde la racine", () => {
    expect(normaliserChemin("https://axion-ia.com/")).toBe("/");
    expect(normaliserChemin("https://axion-ia.com")).toBe("/");
    expect(normaliserChemin("/fr/")).toBe("/fr");
  });

  it("ramène /en/ à son équivalent FR", () => {
    expect(normaliserChemin("https://axion-ia.com/en/about")).toBe("/fr/a-propos");
    expect(normaliserChemin("https://axion-ia.com/en/blog")).toBe("/fr/blog");
    expect(normaliserChemin("/en")).toBe("/fr");
  });

  it("met en minuscules", () => {
    expect(normaliserChemin("https://axion-ia.com/FR/Blog/Mon-Article")).toBe(
      "/fr/blog/mon-article",
    );
  });

  it("isole (null) un hôte étranger, une valeur vide ou illisible", () => {
    expect(normaliserChemin("https://autre-site.fr/fr/blog")).toBeNull();
    expect(normaliserChemin("https://axion-ia.com.evil.fr/fr/blog")).toBeNull();
    expect(normaliserChemin("")).toBeNull();
    expect(normaliserChemin("   ")).toBeNull();
    expect(normaliserChemin("https://")).toBeNull();
  });

  it("même forme pour une URL complète et un chemin seul (non ASCII, points)", () => {
    expect(normaliserChemin("https://axion-ia.com/fr/blog/caf%C3%A9")).toBe("/fr/blog/café");
    expect(normaliserChemin("/fr/blog/café")).toBe("/fr/blog/café");
    expect(normaliserChemin("/fr/blog/../faq")).toBe("/fr/faq");
    expect(normaliserChemin("https://axion-ia.com/fr/blog/../faq")).toBe("/fr/faq");
  });

  it("refuse les schémas autres que http(s)", () => {
    expect(normaliserChemin("javascript://axion-ia.com/fr/x")).toBeNull();
    expect(normaliserChemin("ftp://axion-ia.com/fr/x")).toBeNull();
  });

  it("hôte sans schéma, et paramètre de chemin retiré", () => {
    expect(normaliserChemin("axion-ia.com/fr/blog")).toBe("/fr/blog");
    expect(normaliserChemin("/fr/blog;jsessionid=ABC")).toBe("/fr/blog");
  });
});
