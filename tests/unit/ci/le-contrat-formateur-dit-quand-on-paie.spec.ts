/**
 * 🔴 LE CONTRAT DE SOUS-TRAITANCE NE DISAIT NI QUAND NI COMMENT ON PAIE.
 *
 * ## Ce que le contrat disait, et ce qu'il ne disait pas
 *
 * Clause 4, avant le 2026-09-06, en entier :
 *
 * > « La rémunération est versée sur présentation d'une facture d'honoraires
 * >   conforme émise par le sous-traitant après réalisation de chaque mission. »
 *
 * **Aucun délai de paiement. Aucune condition. Aucune pénalité.** Or Will
 * applique en pratique « le formateur est payé quand le client a payé » — une
 * règle que le document qu'il fait signer ne porte pas.
 *
 * 🔑 Le silence n'était pas neutre : **il choisissait**. Sans stipulation, le
 * délai supplétif de l'art. L.441-10 du Code de commerce s'applique, et les
 * pénalités courent de plein droit sans que personne les ait décidées.
 *
 * ## ⛔ CE QUI A ÉTÉ REFUSÉ, ET POURQUOI C'EST LE CŒUR DE CE FICHIER
 *
 * La demande initiale était d'écrire « payé quand le client a payé ». **Ça ne
 * s'écrit pas**, et pas par prudence : l'art. L.441-10 plafonne le délai convenu
 * à 60 jours (ou 45 jours fin de mois, expressément stipulé). Ces plafonds sont
 * d'ordre public. Une clause qui subordonne le paiement à un encaissement — donc
 * sans borne — est **réputée non écrite**, et l'infraction est passible d'une
 * amende administrative allant jusqu'à **2 M€** pour une personne morale,
 * publiée nominativement.
 *
 * L'écrire aurait donc exposé PLUS que le silence qu'elle prétendait corriger.
 *
 * 🔑 **La construction licite déplace le point de DÉPART, elle ne repousse pas
 * l'échéance.** Le délai court à compter de la facture ; le contrat définit
 * quand la facture est émise — après réalisation ET validation du relevé de la
 * période. On ne retarde aucune dette : on dit quand elle naît.
 *
 * ⚠️ Cette distinction ne vaut PAS pour un apporteur d'affaires, et l'inverse
 * est vrai : sa commission peut légitimement être **acquise à l'encaissement**,
 * parce qu'on y définit le fait générateur d'un droit, pas le report d'une dette
 * échue. Ne pas transposer cette garde telle quelle à un contrat d'apporteur.
 *
 * ## L'autofacturation
 *
 * Quatre éléments la rendent régulière, et il en manque un seul pour que la TVA
 * portée ne soit pas déductible : mandat écrit et préalable, mention
 * « Autofacturation », émission au nom et pour le compte du sous-traitant, droit
 * de contestation. Le repli explicite compte autant : sans mandat en vigueur,
 * c'est le sous-traitant qui facture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

const SOURCE = readFileSync(
  join(RACINE, "src/server/qualiopi/documents/templates/contrat-sous-traitance.tsx"),
  "utf8",
);

/**
 * La source, ESPACES NORMALISÉS.
 *
 * 🔴 Sans ça, cette garde mesure la mise en forme et pas le contrat. Prettier
 * coupe les phrases du JSX où il veut — « À défaut de mandat en
 vigueur » — et
 * une regex écrite sur une seule ligne rend alors ROUGE sur un contrat juste.
 *
 * C'est la deuxième fois dans la même journée qu'un témoin dépend du formatage :
 * un motif de l'évaluateur d'alertes est tombé exactement pareil. **Un témoin
 * qui dépend du formatage ne mesure pas ce qu'il croit mesurer.**
 */
/**
 * 🔴 LES COMMENTAIRES SONT RETIRÉS AVANT TOUTE MESURE, ET C'EST UN DÉFAUT QUE
 * CE FICHIER A EU.
 *
 * La première version lisait le fichier ENTIER. Deux témoins passaient alors au
 * vert pour de mauvaises raisons, et deux mutations l'ont montré :
 *
 *  - « Autofacturation » apparaissait DEUX fois — dans la clause, et dans le
 *    commentaire qui explique l'exigence. Retirer la mention de la clause
 *    laissait le test vert : **il se satisfaisait de son propre commentaire** ;
 *  - la garde du délai matchait aussi « préavis de trente (30) jours », une
 *    clause de résiliation qui n'a rien à voir avec le paiement.
 *
 * 🔑 Un témoin doit lire ce que la PIÈCE dit, pas ce que le code raconte à son
 * sujet. On retire donc les commentaires, puis on normalise les espaces.
 */
const CONTRAT = SOURCE.replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ")
  .replace(/\s+/g, " ");

/**
 * La CLAUSE DE PAIEMENT seule, extraite de son intitulé jusqu'au bloc suivant.
 *
 * 🔴 Troisième correction de ce fichier, et la plus instructive. Les deux
 * premières versions mesuraient le contrat ENTIER :
 *
 *  1. « trente (30) jours » matchait aussi le préavis de résiliation ;
 *  2. « dans un délai de trente (30) jours » — pourtant « ancré » — matchait la
 *     clause de RÈGLEMENT DES DIFFÉRENDS (« À défaut d'accord dans un délai de
 *     trente (30) jours »). Retirer entièrement le délai de PAIEMENT laissait
 *     donc le test vert.
 *
 * 🔑 Un ancrage lexical ne suffit pas quand le même mot vit ailleurs dans la
 * pièce. Ce qui discrimine, c'est la RÉGION : on mesure dans la clause, ou on ne
 * mesure pas la clause.
 */
function clauseDePaiement(): string {
  const depart = CONTRAT.indexOf("Délai de paiement.");
  expect(
    depart,
    "l'intitulé « Délai de paiement. » a disparu : la clause n'existe plus, ou " +
      "elle a été renommée — et cette garde ne sait plus où regarder.",
  ).toBeGreaterThan(-1);
  return CONTRAT.slice(depart, depart + 1400);
}

describe("🔴 le contrat de sous-traitance dit QUAND on paie", () => {
  it("un délai de paiement CHIFFRÉ est stipulé", () => {
    expect(
      clauseDePaiement(),
      "le délai de paiement a disparu du contrat. Sans stipulation, le délai " +
        "supplétif de l'art. L.441-10 s'applique et les pénalités courent sans " +
        "que personne les ait décidées : le silence choisit à la place de l'organisme.",
      // ⚠️ ANCRÉ à sa phrase. « trente (30) jours » seul matche aussi le préavis
      // de résiliation et la clause d'empêchement — deux stipulations qui n'ont
      // rien à voir avec le paiement, et qui rendaient ce témoin toujours vert.
    ).toMatch(/trente \(30\) jours/);
    expect(
      clauseDePaiement(),
      "le point de départ du délai n'est plus dit. « 30 jours » sans dire à " +
        "compter de QUOI ne se calcule pas.",
    ).toMatch(/date d&apos;émission de la facture|date d'émission de la facture/);
  });

  it("🔴 les mentions que la loi rend OBLIGATOIRES y sont", () => {
    // Elles ne sont pas décoratives : leur absence est elle-même sanctionnée,
    // et l'indemnité de 40 € est due de plein droit qu'on l'écrive ou non.
    expect(CONTRAT, "le taux des pénalités de retard a disparu").toMatch(
      /Banque centrale européenne majoré de 10 points/,
    );
    expect(CONTRAT, "l'indemnité forfaitaire de recouvrement a disparu").toMatch(/40 €/);
    expect(CONTRAT, "la référence de l'indemnité forfaitaire a disparu").toMatch(/D\.441-5/);
  });

  it("🔴 le FAIT GÉNÉRATEUR est défini — c'est lui qui remplace la clause illicite", () => {
    // La construction licite : on déplace le point de départ, on ne repousse pas
    // l'échéance. Sans ce bloc, il ne reste que le délai — et la tentation
    // d'écrire « payé quand le client a payé », qui est réputé non écrit.
    expect(
      CONTRAT,
      "le fait générateur de la facturation a disparu : le contrat ne dit plus " +
        "quand la facture est émise, et la seule façon de gagner du délai " +
        "redevient la clause illicite.",
    ).toMatch(/Fait générateur de la facturation/);
    expect(
      CONTRAT,
      "la validation du relevé n'est plus le déclencheur : le lien entre les " +
        "heures constatées et l'émission de la facture est rompu.",
    ).toMatch(/validation du relevé/);
  });

  it("⛔ AUCUNE clause de paiement adossé à l'encaissement client", () => {
    // LE témoin qui compte. Il refuse la formulation qu'on a failli écrire, et
    // il la refuse dans ses tournures les plus probables. Une clause de ce type
    // est réputée non écrite (L.441-10) et l'amende va jusqu'à 2 M€ pour une
    // personne morale.
    //
    // ⚠️ Ne PAS transposer cette garde à un contrat d'apporteur d'affaires : la
    // commission d'un apporteur peut légitimement être acquise à l'encaissement,
    // parce qu'on y définit le fait générateur d'un droit, pas le report d'une
    // dette échue.
    const interdits = [
      /après (?:le )?(?:complet )?(?:encaissement|règlement) (?:du|par le) client/i,
      /sous réserve (?:du|de son) (?:paiement|règlement) par le client/i,
      /conditionné[e]? (?:au|à l')(?:paiement|encaissement)/i,
      /dès (?:lors )?que le client a(?:ura)? payé/i,
    ];
    for (const motif of interdits) {
      expect(
        motif.test(CONTRAT),
        `le contrat porte une clause de paiement adossé (${motif}). Elle est ` +
          "réputée non écrite (art. L.441-10, plafonds d'ordre public) et " +
          "l'infraction est passible de 2 M€ pour une personne morale. La " +
          "construction licite est le FAIT GÉNÉRATEUR, déjà en place.",
      ).toBe(false);
    }
  });
});

describe("🔴 l'autofacturation est régulière, ou elle n'est pas", () => {
  it("les QUATRE éléments de régularité sont présents", () => {
    // Il en manque un seul et la facture n'est pas régulière : la TVA qu'elle
    // porte n'est alors pas déductible.
    const exigences: [RegExp, string][] = [
      [/donne mandat à l&apos;organisme|donne mandat à l'organisme/, "le mandat écrit"],
      [/« Autofacturation »/, "la mention « Autofacturation » sur la pièce"],
      [
        /en son nom et pour son\s+compte|en son nom et pour son compte/,
        "l'émission au nom et pour le compte du sous-traitant",
      ],
      [/pour la contester|pour en contester/, "le droit de contestation"],
    ];
    for (const [motif, quoi] of exigences) {
      expect(
        motif.test(CONTRAT),
        `${quoi} a disparu du mandat de facturation. Sans lui, l'autofacturation ` +
          "n'est pas régulière et la TVA portée n'est pas déductible.",
      ).toBe(true);
    }
  });

  it("le mandat est RÉVOCABLE, et le repli est dit", () => {
    // Un mandat irrévocable serait abusif ; et sans repli explicite, la
    // révocation laisserait un trou — plus personne n'émettrait de facture.
    expect(CONTRAT, "la révocabilité du mandat a disparu").toMatch(/révocable à tout moment/);
    expect(
      CONTRAT,
      "le repli a disparu : après révocation, le contrat ne dit plus qui émet " +
        "la facture, et le paiement n'a plus de déclencheur.",
    ).toMatch(/À défaut de mandat en vigueur/);
  });
});
