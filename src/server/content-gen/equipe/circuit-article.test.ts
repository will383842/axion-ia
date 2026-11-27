import { describe, expect, it, vi } from "vitest";
import type { GeneratorOutput } from "../generators/types";
import {
  consigneRenvoi,
  liensDuCorps,
  mailler,
  retirerLiens,
  editerSeoSortie,
} from "./circuit-article";

const sortie = (bodyHtml: string): GeneratorOutput =>
  ({
    title: "Titre",
    metaTitle: "m",
    metaDescription: "d",
    bodyHtml,
    bodyText: "x",
    faq: [],
    citations: [{ url: "https://mort.example.com/a", title: "t" }],
  }) as unknown as GeneratorOutput;

describe("circuit-article", () => {
  it("liste les liens et retire les refusés en gardant le texte", () => {
    const h = '<p><a href="/blog/x">interne</a> <a href="https://a.fr/1">externe</a></p>';
    expect(liensDuCorps(h)).toEqual(["/blog/x", "https://a.fr/1"]);
    expect(retirerLiens(h, new Set(["https://a.fr/1"]))).toBe(
      '<p><a href="/blog/x">interne</a> externe</p>',
    );
  });

  it("mailleur éteint : texte inchangé, aucun réseau", async () => {
    const fetchImpl = vi.fn();
    const o = sortie('<a href="https://a.fr/1">x</a>');
    const r = await mailler(o, { fetchImpl: fetchImpl as never });
    expect(r.output).toBe(o);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("éditeur SEO éteint : sortie inchangée, aucun appel payant", async () => {
    const generer = vi.fn();
    const o = sortie("<p>a</p>");
    const r = await editerSeoSortie("j", o, { motCle: "k", entites: [] }, { generer, env: {} });
    expect(r.output).toBe(o);
    expect(generer).not.toHaveBeenCalled();
  });

  it("consigne de renvoi : passages et chiffres", () => {
    const c = consigneRenvoi([
      { role: "redacteur", criteres: ["Q1", "Q2"], passages: ["p1"], chiffresASourcer: ["c1"] },
    ]);
    expect(c).toContain("Q1, Q2");
    expect(c).toContain("p1");
    expect(c).toContain("c1");
  });
});
