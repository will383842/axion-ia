/**
 * Corrections de l'audit Opus (2e passe) : décompte sans « : », intro de liste non financière,
 * sens financier de « prise en charge », apply refusé tant qu'un ambigu n'est pas tranché.
 * Chaque test échouait avant la correction.
 */
import { describe, expect, it } from "vitest";
import {
  ambigusNonCouverts,
  empreinte,
  gabaritOverrides,
  appliquerOverrides,
  refuserSiAmbigus,
  type Proposition,
} from "./plan";
import { construireRapport } from "./rapport";
import { estVisee, htmlVersTexte, motsDe, reecrireHtml, reecrireTexte } from "./regles";

/** Tous les mots d'un texte : l'override accepte de les perdre (test des mécanismes, pas du lexique). */
const tousLesMots = (v: unknown): string[] => motsDe(htmlVersTexte(String(v)));

describe("2. décompte annoncé sans « : » avant l'énumération", () => {
  it("« Les 3 piliers … l'audit, le financement OPCO et la formation. » → 2 piliers, rien de perdu", () => {
    const r = reecrireTexte(
      "Les 3 piliers de la méthode sont l'audit, le financement OPCO et la formation.",
      "fr",
    );
    if (r.ambigus.length === 0) {
      expect(r.valeur).toBe("Les 2 piliers de la méthode sont l'audit et la formation.");
    } else {
      expect(r.modifie).toBe(false);
    }
    expect(r.valeur).not.toBe("Les 3 piliers de la méthode sont l'audit.");
  });

  it("variante en lettres", () => {
    const r = reecrireTexte(
      "Les trois piliers de la méthode sont l'audit, le financement OPCO et la formation.",
      "fr",
    );
    if (r.ambigus.length === 0) {
      expect(r.valeur).toBe("Les deux piliers de la méthode sont l'audit et la formation.");
    } else {
      expect(r.modifie).toBe(false);
    }
  });

  it("jamais un nombre faux : l'élément retiré en fin de liste", () => {
    const r = reecrireTexte(
      "Les 3 piliers de la méthode sont l'audit, la formation et le financement OPCO.",
      "fr",
    );
    if (r.ambigus.length === 0)
      expect(r.valeur).toBe("Les 2 piliers de la méthode sont l'audit et la formation.");
    else expect(r.modifie).toBe(false);
  });
});

describe("3. liste : jamais remplacée en entier si une puce seulement parle de financement", () => {
  it("« gains financiers : » → seule la puce visée est retirée", () => {
    const html =
      "<p>Voici les gains financiers :</p><ul><li>Réduction des coûts de support</li><li>Financement par votre OPCO</li><li>Gain de temps</li></ul>";
    const out = reecrireHtml(html, "fr").valeur;
    expect(out).toContain("Réduction des coûts de support");
    expect(out).toContain("Gain de temps");
    expect(out).toContain("gains financiers");
    expect(out).not.toMatch(/OPCO/);
  });

  it("« prise en charge » non financière en intro : seule la puce est retirée", () => {
    const html =
      "<p>Notre prise en charge comprend :</p><ul><li>Audit des usages</li><li>Financement OPCO</li><li>Formation des équipes</li></ul>";
    const out = reecrireHtml(html, "fr").valeur;
    expect(out).toContain("Audit des usages");
    expect(out).toContain("Formation des équipes");
    expect(out).not.toMatch(/OPCO/);
  });

  it("toutes les puces financières : la liste entière est remplacée", () => {
    const html =
      "<p>Les financements possibles :</p><ul><li>Financement OPCO</li><li>Financement CPF</li></ul>";
    const out = reecrireHtml(html, "fr").valeur;
    expect(out).not.toMatch(/OPCO|CPF/);
    expect(out).not.toContain("<li>");
  });
});

describe("4. « prise en charge » : financière seulement avec un marqueur d'argent ou de payeur", () => {
  it.each([
    ["La prise en charge dépend de la certification de l'organisme formateur.", true],
    ["Renseignez-vous sur les modalités de prise en charge.", true],
    ["Notre organisme de formation assure la prise en charge de vos équipes.", false],
    ["La prise en charge des appels réduit le coût de 30 %.", false],
  ])("%s", (phrase, financiere) => {
    expect(estVisee(phrase)).toBe(financiere);
  });
});

describe("1. apply refusé tant qu'un ambigu n'est pas couvert par un override", () => {
  const prop = (ambigus: string[], apres: Record<string, unknown> = {}): Proposition => ({
    cle: "article_translation:t1",
    table: "article_translation",
    id: "t1",
    avant: {
      body:
        "<p>Texte complet du passage ambigu, très long, qui dépasse largement cent soixante caractères. ".repeat(
          3,
        ) + "</p>",
    },
    apres,
    ambigus,
    conserves: [],
  });

  it("ambigusNonCouverts liste les ambigus restants avec identifiant et champ", () => {
    const l = ambigusNonCouverts([
      prop(["article_translation:t1.body : phrase mixte sans coupure propre : « x »"]),
    ]);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ cle: "article_translation:t1", champ: "body" });
  });

  it("un ambigu couvert par un override valide n'est plus listé ; origine périmée → reste", () => {
    const p = prop(["article_translation:t1.body : phrase mixte"]);
    const bon = appliquerOverrides(p, p.avant, {
      "article_translation:t1": {
        body: {
          origine: empreinte(p.avant.body),
          valeur: "<p>ok</p>",
          pertesAcceptees: tousLesMots(p.avant.body),
        },
      },
    });
    expect(ambigusNonCouverts([bon.proposition])).toHaveLength(0);
    expect(bon.proposition.surcharges).toEqual(["body"]);
    const perime = appliquerOverrides(p, p.avant, {
      "article_translation:t1": { body: { origine: "autre", valeur: "<p>ok</p>" } },
    });
    expect(ambigusNonCouverts([perime.proposition])).toHaveLength(1);
  });

  it("un gabarit non rempli (valeur vide) ne couvre rien et n'écrase rien", () => {
    const p = prop(["article_translation:t1.body : phrase mixte"]);
    const g = gabaritOverrides([p]);
    const o = appliquerOverrides(p, p.avant, g);
    expect(ambigusNonCouverts([o.proposition])).toHaveLength(1);
    expect(o.proposition.apres.body).toBeUndefined();
    expect(o.ignores.join()).toContain("valeur vide");
  });

  it("refuserSiAmbigus : erreur claire tant qu'il reste un ambigu, silence sinon", () => {
    const p = prop(["article_translation:t1.body : phrase mixte"]);
    expect(() => refuserSiAmbigus([p], null)).toThrow(/--apply REFUSÉ : 1 ambigu/);
    expect(() => refuserSiAmbigus([prop([])], null)).not.toThrow();
  });

  it("le rapport donne le TEXTE COMPLET (non tronqué) et le gabarit JSON des overrides", () => {
    const long = `<p>${"Passage ambigu très long. ".repeat(20)}Fin du passage.</p>`;
    const p = { ...prop([]), avant: { body: long } };
    p.ambigus = [
      `article_translation:t1.body : phrase mixte sans coupure propre : « ${htmlVersTexte(long).slice(0, 160)} »`,
    ];
    const rapport = construireRapport("dry-run", [p], [], "sha");
    expect(rapport).toContain("Fin du passage.");
    expect(rapport).toContain('"article_translation:t1"');
    expect(rapport).toContain('"origine"');
    expect(rapport).toContain('"valeur"');
  });

  it("un override sur un contenu déjà traité est marqué comme réécriture ciblée", () => {
    const p = prop(["article_translation:t1.body : x"], { title: "t" });
    const o = appliquerOverrides(p, p.avant, {
      "article_translation:t1": {
        body: {
          origine: empreinte(p.avant.body),
          valeur: "ok",
          pertesAcceptees: tousLesMots(p.avant.body),
        },
      },
    });
    expect(o.proposition.surcharges).toEqual(["body"]);
    expect(Object.keys(o.proposition.apres).sort()).toEqual(["body", "title"]);
  });
});
