import { describe, expect, it } from "vitest";

import {
  estLienOuvrable,
  extraireLiens,
  libelleTaille,
  rendreLiensOuvrables,
} from "@/lib/email/apercu-lecteur";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";

const JETON = "Zk3Jf9Qw2LmN8pXr5TvB7yHc";

/** Ce que fait l'aperçu : masquer, puis rendre les liens ouvrables. */
const apercu = (html: string): string =>
  rendreLiensOuvrables(masquerSecretsEmail({ subject: "", html, text: "" }).html);

const HTML =
  `<p><a href="https://axion-ia.com/fr/tarifs" style="x">Voir  les <b>tarifs</b></a></p>` +
  `<p><a href="https://axion-ia.com/fr/portail/signer/${JETON}">Signer ma convention</a></p>` +
  `<p><a href="https://axion-ia.com/opposition?t=${JETON}">Me désinscrire</a></p>` +
  `<p><a href="mailto:contact@axion-ia.com">Écrire</a></p>`;

describe("rendreLiensOuvrables", () => {
  const sortie = apercu(HTML);

  it("un lien public garde son href et s'ouvre dans un nouvel onglet, sans rien transmettre", () => {
    expect(sortie).toMatch(
      /<a href="https:\/\/axion-ia\.com\/fr\/tarifs" style="x" target="_blank" rel="noopener noreferrer">/,
    );
  });

  it("un lien à jeton perd son href : le jeton n'atteint jamais le navigateur, rien ne se consomme", () => {
    expect(sortie).not.toContain(JETON);
    expect(sortie).not.toMatch(/<a[^>]*href="https:\/\/axion-ia\.com\/(fr\/portail|opposition)/);
  });

  it("mailto: n'est pas rendu ouvrable", () => {
    expect(sortie).not.toContain('href="mailto:');
  });

  it("un lien fictif exclu reste inerte", () => {
    const html = `<a href="https://axion-ia.com/fr/portail/signer/apercu">Signer</a>`;
    const r = rendreLiensOuvrables(html, { exclure: ["https://axion-ia.com/fr/portail/signer/"] });
    expect(r).not.toContain("href=");
    expect(rendreLiensOuvrables(html)).toContain(
      'href="https://axion-ia.com/fr/portail/signer/apercu"',
    );
  });

  it("remplace un target ou rel déjà présents", () => {
    const r = rendreLiensOuvrables(
      `<a target="_self" rel="opener" href="https://axion-ia.com/a">x</a>`,
    );
    expect(r).toContain('target="_blank" rel="noopener noreferrer"');
    expect(r).not.toContain("_self");
    expect(r).not.toContain('rel="opener"');
  });
});

describe("extraireLiens", () => {
  const liens = extraireLiens(apercu(HTML));

  it("donne texte → adresse complète, dans l'ordre", () => {
    expect(liens[0]).toEqual({
      texte: "Voir les tarifs",
      adresse: "https://axion-ia.com/fr/tarifs",
      genre: "ouvrable",
    });
    expect(liens.map((l) => l.texte)).toEqual([
      "Voir les tarifs",
      "Signer ma convention",
      "Me désinscrire",
      "Écrire",
    ]);
  });

  it("marque personnels les liens à jeton, adresse masquée, jamais cliquables", () => {
    const perso = liens.filter((l) => l.genre === "personnel");
    expect(perso.map((l) => l.texte)).toEqual(["Signer ma convention", "Me désinscrire"]);
    for (const l of perso) {
      expect(l.adresse).not.toContain(JETON);
      expect(l.adresse).toContain("[masqué]");
    }
  });

  it("range mailto: à part (ni ouvrable, ni personnel)", () => {
    expect(liens[3]).toMatchObject({ genre: "autre", adresse: "mailto:contact@axion-ia.com" });
  });

  it("ignore les ancres, retire les doublons, nomme un lien-image", () => {
    const l = extraireLiens(
      `<a href="#haut">haut</a><a href="https://axion-ia.com/x">Go</a><a href="https://axion-ia.com/x">Go</a>` +
        `<a href="https://axion-ia.com/y"><img alt="Logo Axion" src="https://axion-ia.com/l.png"></a>` +
        `<a href="https://axion-ia.com/z"></a>`,
    );
    expect(l.map((x) => x.texte)).toEqual(["Go", "(image : Logo Axion)", "(lien sans texte)"]);
  });

  it("décode les entités de l'adresse (&amp;)", () => {
    const l = extraireLiens(`<a href="https://axion-ia.com/a?x=1&amp;y=2">ok</a>`);
    expect(l[0]?.adresse).toBe("https://axion-ia.com/a?x=1&y=2");
  });
});

describe("estLienOuvrable / libelleTaille", () => {
  it("refuse tout ce qui n'est pas http(s) ou porte un secret masqué", () => {
    expect(estLienOuvrable("https://axion-ia.com/fr")).toBe(true);
    expect(estLienOuvrable("javascript:alert(1)")).toBe(false);
    expect(estLienOuvrable("https://axion-ia.com/p/[masqué]")).toBe(false);
    expect(estLienOuvrable("https://axion-ia.com/p/%5Bmasqu%C3%A9%5D")).toBe(false);
  });

  it("écrit le poids en français", () => {
    expect(libelleTaille(1)).toBe("1 octet");
    expect(libelleTaille(812)).toBe("812 octets");
    expect(libelleTaille(348_160)).toBe("340 Ko");
    expect(libelleTaille(1_258_291)).toBe("1,2 Mo");
  });
});
