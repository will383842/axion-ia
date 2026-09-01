// @vitest-environment node

/**
 * Verrou — la page de réservation ne promet pas un appel téléphonique alors
 * qu'elle propose aussi la visioconférence.
 *
 * ## L'écart, et pourquoi il est passé inaperçu
 *
 * Le lieu « Google Meet » a été ajouté à l'event-type Calendly le 2026-09-01.
 * Du jour au lendemain, un prospect pouvait donc choisir entre téléphone et
 * visio — sans que rien sur `/appel` ne le dise. Il découvrait l'option en
 * arrivant chez Calendly, **après** avoir choisi son créneau.
 *
 * Pire, la page affirmait le contraire à qui ne la lisait pas : sa description
 * structurée, celle que Google indexe, annonçait un « premier échange
 * TÉLÉPHONIQUE de 45 minutes ».
 *
 * Rien ne cassait. Aucun test ne pouvait le voir, parce que le défaut n'est pas
 * dans le code : il est dans **l'écart entre ce que le code dit et ce qu'un
 * réglage Calendly permet**. Ce fichier est la seule chose qui relie les deux.
 *
 * ## Ce qu'il vérifie
 *
 * Que la page ne contient plus de promesse mono-canal, et qu'elle nomme les
 * deux formats. C'est une garde de texte — elle ne peut pas vérifier que
 * l'event-type propose bien deux lieux, ce qui vit chez Calendly. Elle dit
 * donc la chose et sa limite.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CHEMIN = "src/app/[locale]/appel/page.tsx";
const source = readFileSync(join(process.cwd(), CHEMIN), "utf8");

/**
 * Le code sans ses commentaires.
 *
 * 🔑 Indispensable, et le piège s'est présenté quatre fois dans ce dépôt : la
 * page EXPLIQUE désormais le défaut corrigé, donc elle écrit « échange
 * téléphonique » au milieu d'une note. Une garde doit mesurer ce qui s'AFFICHE,
 * jamais ce qui est écrit à côté.
 */
const code = source.replace(/^\s*\/\/.*$/gm, " ");

/**
 * Les promesses mono-canal, avec ce qu'elles avaient de faux.
 *
 * Chacune a réellement figuré sur la page. On ne devine pas des tournures
 * possibles : on interdit celles qui ont existé.
 */
const PROMESSES_MONOCANAL: ReadonlyArray<readonly [string, string]> = [
  ["échange téléphonique", "figurait dans la description structurée lue par Google"],
  ["entretien téléphonique", "variante de la même promesse"],
  ["appel téléphonique de 45", "annoncerait un canal unique"],
];

describe("la page de réservation n'annonce pas un canal unique", () => {
  it("🔑 la page est bien lisible et le filtre ne l'a pas vidée", () => {
    // Contre-témoin : sans lui, tous les tests suivants passeraient sur une
    // chaîne vide. Le piège du filtre trop gourmand a déjà rendu une garde de
    // ce dépôt verte en ne mesurant plus rien.
    expect(code, "le corps de la page doit survivre au filtre").toContain("Comment ça marche");
    expect(code.length).toBeGreaterThan(source.length / 3);
    expect(
      code.length,
      "la page EST commentée : le filtre doit retirer quelque chose",
    ).toBeLessThan(source.length);
  });

  it("🔴 aucune promesse mono-canal ne subsiste", () => {
    for (const [tournure, raison] of PROMESSES_MONOCANAL) {
      expect(
        code.toLowerCase().includes(tournure.toLowerCase()),
        `« ${tournure} » — ${raison}. L'event-type propose téléphone ET visio ` +
          `depuis le 2026-09-01 : la page ne peut plus en promettre un seul.`,
      ).toBe(false);
    }
  });

  it("🔴 les DEUX formats sont nommés", () => {
    const t = code.toLowerCase();
    expect(t, "le téléphone doit rester annoncé").toContain("téléphone");
    expect(
      t.includes("visioconférence") || t.includes("visio"),
      "la visioconférence est réservable mais la page n'en parle pas : le " +
        "prospect la découvre chez Calendly, une fois son créneau déjà choisi",
    ).toBe(true);
  });

  it("🔑 le choix est annoncé AVANT le clic, pas après", () => {
    // Le détail qui compte : l'annonce doit figurer dans la première étape du
    // mode d'emploi. Plus bas, elle serait lue après la réservation.
    const etapes = /Comment ça marche[\s\S]{0,1200}/.exec(code)?.[0] ?? "";
    expect(etapes, "le bloc des étapes est introuvable").not.toBe("");
    expect(
      etapes.toLowerCase().includes("visio"),
      "le choix du format n'apparaît pas dans les premières étapes — annoncé " +
        "plus bas, il serait annoncé trop tard",
    ).toBe(true);
  });

  it("🔑 la description structurée dit la même chose que la page", () => {
    // C'est elle que Google indexe et affiche en résultat de recherche. Une
    // page qui dit une chose et une donnée structurée qui en dit une autre,
    // c'est la seconde que le prospect lit en premier.
    // 🔑 ANCRÉ SUR `buildServiceJsonLd`, et pas sur « description » : la page
    // porte DEUX champs de ce nom — la méta description et la donnée
    // structurée. Un premier jet lisait le premier venu et échouait en
    // désignant le mauvais. Une fenêtre de lecture doit nommer sa cible.
    const jsonLd = /buildServiceJsonLd\(\{[\s\S]{0,900}/.exec(code)?.[0] ?? "";
    expect(jsonLd, "la description structurée est introuvable").not.toBe("");
    expect(jsonLd.toLowerCase()).toContain("visioconférence");
    expect(jsonLd.toLowerCase()).not.toContain("échange téléphonique");
  });
});
