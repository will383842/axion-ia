/**
 * Le texte modifiable de l'invitation au questionnaire (2026-10-25) : assainissement PUR.
 * Jamais de HTML libre, jamais de saut de ligne dans l'objet, bornes de longueur.
 */
import { describe, expect, it } from "vitest";

import {
  CORPS_PAR_DEFAUT,
  CORPS_MAX,
  MESSAGE_MAX,
  OBJET_PERSO_MAX,
  assainirLigne,
  assainirTexte,
  enParagraphes,
  surchargeOuNull,
} from "../questionnaire-avant-audit-texte";

describe("assainirLigne (objet)", () => {
  it("retire les sauts de ligne et caractères de contrôle (pas d'injection d'en-tête)", () => {
    expect(assainirLigne("Bonjour\r\nBcc: x@y.fr\t\u0000 suite", 200)).toBe(
      "Bonjour Bcc: x@y.fr suite",
    );
  });
  it("borne la longueur", () => {
    expect(assainirLigne("a".repeat(500), OBJET_PERSO_MAX)).toHaveLength(OBJET_PERSO_MAX);
  });
  it("ne rend jamais autre chose qu'une chaîne", () => {
    expect(assainirLigne(42 as unknown, 10)).toBe("");
    expect(assainirLigne(undefined, 10)).toBe("");
  });
});

describe("assainirTexte (corps, message)", () => {
  it("normalise les fins de ligne, supprime les contrôles, limite les sauts de ligne vides", () => {
    expect(assainirTexte("a\r\n\r\n\r\n\r\nb\u0007", 100)).toBe("a\n\nb");
  });
  it("garde les balises telles quelles comme TEXTE (elles seront échappées au rendu)", () => {
    expect(assainirTexte("<script>alert(1)</script>", 100)).toBe("<script>alert(1)</script>");
  });
  it("borne la longueur", () => {
    expect(assainirTexte("x".repeat(9000), CORPS_MAX)).toHaveLength(CORPS_MAX);
    expect(assainirTexte("x".repeat(9000), MESSAGE_MAX)).toHaveLength(MESSAGE_MAX);
  });
});

describe("enParagraphes", () => {
  it("coupe sur les lignes vides et ignore les paragraphes vides", () => {
    expect(enParagraphes("un\n\n\ndeux\nsuite\n\n  \n\ntrois")).toEqual([
      "un",
      "deux\nsuite",
      "trois",
    ]);
  });
  it("rend [] pour un texte vide", () => {
    expect(enParagraphes("   ")).toEqual([]);
  });
});

describe("surchargeOuNull", () => {
  it("rend null si le texte est vide ou identique à la base (la base continue d'évoluer)", () => {
    expect(surchargeOuNull("", "base")).toBeNull();
    expect(surchargeOuNull("  base \r\n", "base")).toBeNull();
    expect(surchargeOuNull("autre", "base")).toBe("autre");
  });
});

describe("texte d'origine", () => {
  it("contient le jeton {audit} une seule fois et aucun lien", () => {
    const t = CORPS_PAR_DEFAUT;
    expect(t.split("{audit}")).toHaveLength(2);
    expect(t).not.toMatch(/https?:/);
  });
});

import { fusionnerTexte } from "../questionnaire-avant-audit-texte";

describe("fusionnerTexte (client > base de Will > texte d'origine)", () => {
  const AUCUNE = { objet: null, corps: null };
  it("rien de saisi, rien en base : aucune surcharge (le gabarit garde son texte)", () => {
    expect(fusionnerTexte(AUCUNE, {})).toEqual({});
  });
  it("le texte saisi identique au texte d'origine n'est pas une surcharge", () => {
    expect(fusionnerTexte(AUCUNE, { corps: CORPS_PAR_DEFAUT })).toEqual({});
  });
  it("la base de Will s'applique quand le client ne saisit rien ou saisit la base", () => {
    const base = { objet: "Votre audit", corps: "Texte de base" };
    expect(fusionnerTexte(base, {})).toEqual({
      objetPerso: "Votre audit",
      corpsPerso: "Texte de base",
    });
    expect(fusionnerTexte(base, { corps: "Texte de base" })).toEqual({
      objetPerso: "Votre audit",
      corpsPerso: "Texte de base",
    });
  });
  it("la saisie du client l'emporte, message personnel compris, tout assaini", () => {
    const base = { objet: "Votre audit", corps: "Texte de base" };
    expect(
      fusionnerTexte(base, {
        objet: "Claire\r\n: audit",
        message: " Merci ! ",
        corps: "Autre\r\n\r\n\r\ntexte",
      }),
    ).toEqual({
      objetPerso: "Claire : audit",
      messagePerso: "Merci !",
      corpsPerso: "Autre\n\ntexte",
    });
  });
});

import { remplacerJetonAudit } from "../questionnaire-avant-audit-texte";

describe("durcissements de la relecture", () => {
  it("retire les contrôles C1 (NEL) et les inverseurs de sens", () => {
    expect(assainirLigne("ab‮c", 50)).toBe("abc");
  });
  it("le jeton {audit} se reconnaît malgré la casse et les espaces", () => {
    expect(remplacerJetonAudit("x{Audit}y{ audit }z", "!")).toBe("x!y!z");
  });
});
