/**
 * L'étape d'un candidat apporteur se LIT, et c'est la plus avancée qui compte
 * (2026-09-21).
 *
 * Le module est pur : il ne lit que `details`. Ce test verrouille les deux
 * décisions qui ne se voient pas dans le code — le sens du repli, et le sens de
 * la comparaison — parce que ce sont elles qui décident de ce que Will fait
 * ensuite (relancer, inviter, ou laisser tranquille).
 */

import { describe, it, expect } from "vitest";

import {
  etapeDeLaLigne,
  etapeLaPlusAvancee,
  rangEtape,
  LIBELLE_ETAPE,
  type EtapeApporteur,
} from "../etape-apporteur";

describe("l'étape d'une ligne", () => {
  it("premier contact : les cinq champs du formulaire court", () => {
    expect(etapeDeLaLigne({ etape: "premier-contact" })).toBe("premier-contact");
  });

  it("premier contact aussi : une fiche que NOUS avons saisie", () => {
    // Une saisie manuelle n'a rien donné de plus que cinq champs : la traiter
    // comme un dossier complet ferait croire que la personne a candidaté.
    expect(etapeDeLaLigne({ origine: "saisie-manuelle" })).toBe("premier-contact");
  });

  it("dossier commencé : l'écran 1 validé, la suite jamais envoyée", () => {
    expect(etapeDeLaLigne({ origine: "ecran-1-du-dossier" })).toBe("dossier-commence");
  });

  it("dossier complet : le cas historique, sans aucun marqueur", () => {
    // 🔑 Le repli n'est pas neutre. Les lignes antérieures aux deux marqueurs
    // SONT des dossiers complets ; les classer « premier contact » relancerait
    // des gens qui ont déjà tout envoyé.
    expect(etapeDeLaLigne({ unifiedType: "recrutement" })).toBe("dossier-complet");
  });

  it("ne lève JAMAIS, quoi qu'il y ait dans le JSON", () => {
    // Ce code tourne dans une liste de console : une exception y rend une page
    // blanche au lieu d'une ligne imparfaite.
    for (const nimporte of [null, undefined, 42, "texte", [], [1, 2], true]) {
      expect(() => etapeDeLaLigne(nimporte)).not.toThrow();
      expect(etapeDeLaLigne(nimporte)).toBe("dossier-complet");
    }
  });
});

describe("l'étape d'une PERSONNE est la plus avancée de ses lignes", () => {
  it("trois lignes, trois étapes : c'est la dernière franchie qui s'affiche", () => {
    expect(
      etapeLaPlusAvancee([
        { details: { etape: "premier-contact" } },
        { details: { origine: "ecran-1-du-dossier" } },
        { details: {} },
      ]),
    ).toBe("dossier-complet");
  });

  it("la plus AVANCÉE, jamais la plus RÉCENTE", () => {
    // 🔴 Le cas qui motive la règle : quelqu'un envoie son dossier complet, puis
    // repasse par le formulaire court quelques semaines plus tard. Il n'est pas
    // revenu en arrière — et l'afficher « premier contact » ferait lui renvoyer
    // une invitation qu'il a déjà eue.
    const lignes = [
      { details: { etape: "premier-contact" } }, // la plus récente
      { details: {} }, // le dossier complet, plus ancien
    ];
    expect(etapeLaPlusAvancee(lignes)).toBe("dossier-complet");
  });

  it("une seule ligne : son étape, sans transformation", () => {
    expect(etapeLaPlusAvancee([{ details: { origine: "ecran-1-du-dossier" } }])).toBe(
      "dossier-commence",
    );
  });
});

describe("l'axe est cohérent de bout en bout", () => {
  const ETAPES: EtapeApporteur[] = ["premier-contact", "dossier-commence", "dossier-complet"];

  it("les rangs sont strictement croissants dans l'ordre du parcours", () => {
    // Sans ceci, deux étapes au même rang rendraient `etapeLaPlusAvancee`
    // dépendante de l'ordre des lignes — c'est-à-dire non déterministe.
    for (let i = 1; i < ETAPES.length; i += 1) {
      expect(rangEtape(ETAPES[i]!), ETAPES[i]).toBeGreaterThan(rangEtape(ETAPES[i - 1]!));
    }
  });

  it("chaque étape a un libellé lisible, et aucun ne se répète", () => {
    const vus = new Set<string>();
    for (const e of ETAPES) {
      const l = LIBELLE_ETAPE[e];
      expect(l.trim(), e).not.toBe("");
      expect(vus.has(l), `« ${l} » sert deux fois`).toBe(false);
      vus.add(l);
    }
  });
});
