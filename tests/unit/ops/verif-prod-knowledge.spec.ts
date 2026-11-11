import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addressLocalities,
  contient1490,
  contientGrenoble,
  echantillon,
  extraireJsonLd,
  extraireLocs,
  localiteEgaleVille,
  montantsEuros,
  montantsInterdits,
  texteVisible,
} from "../../../scripts/ops/lib/verif-prod-knowledge";

const fixture = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");

describe("verif-prod-knowledge : parseurs", () => {
  it("ignore les montants dans script/style et accepte 1 490", () => {
    const t = texteVisible(fixture("page-ok.html"));
    expect(contient1490(t)).toBe(true);
    expect(montantsInterdits(t)).toEqual([]);
  });
  it("détecte un autre montant en euros", () => {
    const t = texteVisible(fixture("page-montant.html"));
    expect(montantsInterdits(t)).toEqual(["990", "2500"]);
  });
  it("normalise les espaces insécables et les décimales", () => {
    expect(montantsEuros("1 490 € et 1 490,00 EUR et 12 euros")).toEqual(["1490", "1490", "12"]);
  });
  it("respecte la liste blanche", () => {
    expect(montantsInterdits("capital 5000 €", ["5000"])).toEqual([]);
  });
  it("détecte Grenoble", () => {
    expect(contientGrenoble("à GRENOBLE")).toBe(true);
    expect(contientGrenoble(texteVisible(fixture("page-ok.html")))).toBe(false);
  });
  it("lit les <loc> d'un sitemap", () => {
    expect(extraireLocs("<urlset><url><loc> https://a.fr/x </loc></url></urlset>")).toEqual([
      "https://a.fr/x",
    ]);
  });
  it("JSON-LD ville : localité égale à la ville de la page", () => {
    const ld = extraireJsonLd(fixture("ville.html"));
    expect(addressLocalities(ld)).toEqual(["Saint-Étienne"]);
    expect(localiteEgaleVille(ld, "https://axion-ia.com/fr/implantations/aura/saint-etienne")).toBe(
      true,
    );
    expect(localiteEgaleVille(ld, "https://axion-ia.com/fr/implantations/aura/lyon")).toBe(false);
  });
  it("échantillon déterministe", () => {
    expect(echantillon([1, 2, 3, 4], 2)).toEqual([1, 3]);
    expect(echantillon([1, 2], 5)).toEqual([1, 2]);
  });
});
