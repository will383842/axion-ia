import { describe, it, expect } from "vitest";
import { buildOrTsQuery } from "../search-fts";

describe("buildOrTsQuery — requête FTS en OU (correctif grounding)", () => {
  it("joint les termes significatifs par ` OR ` (au lieu d'un ET implicite)", () => {
    expect(buildOrTsQuery("formation intelligence artificielle Grenoble")).toBe(
      "formation OR intelligence OR artificielle OR grenoble",
    );
  });

  it("retire les accents et passe en minuscules (aligné fr_unaccent)", () => {
    expect(buildOrTsQuery("Implémentation Données")).toBe("implementation OR donnees");
  });

  it("conserve les termes-clés courts cruciaux du domaine (« IA »), ignore les 1-caractère", () => {
    // « ia » (2 car.) est conservé ; « d » (1 car.) est retiré. Les stopwords
    // (le/un) sont laissés à websearch_to_tsquery + fr_unaccent en aval.
    expect(buildOrTsQuery("IA & ROI d'audit")).toBe("ia OR roi OR audit");
  });

  it("dédoublonne les termes répétés", () => {
    expect(buildOrTsQuery("audit audit IA audit")).toBe("audit OR ia");
  });

  it("plafonne à 12 termes", () => {
    const q = Array.from({ length: 20 }, (_, i) => `terme${i}`).join(" ");
    expect(buildOrTsQuery(q).split(" OR ")).toHaveLength(12);
  });

  it("retourne une chaîne vide si aucun terme significatif (fallback géré par l'appelant)", () => {
    expect(buildOrTsQuery("à l'y")).toBe("");
  });
});
