/**
 * Indicateur 32 — l'amélioration continue doit ANTICIPER, pas seulement réagir.
 *
 * ## Ce que le décret change
 *
 * Décret n° 2026-728 du 1er août 2026, en vigueur au **1er novembre 2026**.
 * L'indicateur 32 demandait « des mesures d'amélioration à partir de l'analyse
 * des appréciations et des réclamations » : on réagit à ce qui remonte. Le
 * référentiel 2026 exige en plus un processus qui anticipe — une **analyse de
 * risques**.
 *
 * ## Pourquoi une borne DATÉE, et pourquoi elle compte ici
 *
 * L'audit initial de l'organisme est planifié en **octobre 2026**, donc AVANT
 * l'entrée en vigueur : il portera sur le référentiel à 32 indicateurs. Exiger
 * l'analyse dès aujourd'hui ferait rougir le super-indicateur 32 pour une
 * obligation qui n'existe pas encore.
 *
 * 🔑 Et un rouge qu'on ne peut fermer par aucune obligation réelle apprend à
 * ignorer l'écran. C'est la même famille que l'alerte du rappel J-7 corrigée le
 * même jour : un dispositif qui réclame un geste que rien n'impose.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  evaluerCouvertureOff32,
  compterRisquesExploitables,
  EXIGENCE_RISQUES_DEPUIS,
} from "./plan-actions";

const AVANT = new Date("2026-10-15T09:00:00.000Z");
const APRES = new Date("2026-11-15T09:00:00.000Z");

/** Une revue par ailleurs IRRÉPROCHABLE : seule l'analyse de risques varie. */
function revue(risques: unknown[]) {
  return {
    annee: 2026,
    participants: [{ nom: "Williams Jullin", role: "Président" }],
    decisions: [{ decision: "Renforcer le suivi des réclamations" }],
    // ⚠️ La clé de libellé d'une action est `action` / `libelle` / `titre` /
    // `nom` / `decision` — PAS `intitule`. Une action dont la clé n'est pas
    // reconnue est silencieusement écartée, et le plan se lit VIDE : c'est la
    // première version de cette fixture qui s'est fait piéger.
    planActions: [
      {
        action: "Revoir le questionnaire à chaud",
        responsable: "W. Jullin",
        echeance: "2026-12-31",
      },
    ],
    risques,
  };
}

const RISQUE_COMPLET = {
  intitule: "Indisponibilité du formateur unique sur une session engagée",
  cause: "Un seul intervenant habilité sur la majorité des sessions",
  gravite: "élevée",
  probabilite: "moyenne",
  maitrise: "Constituer un vivier de deux sous-traitants habilités avant décembre",
  echeance: "2026-12-15",
  responsable: "W. Jullin",
};

describe("indicateur 32 — l'analyse de risques n'est exigée qu'au 1er novembre 2026", () => {
  it("AVANT l'échéance, son absence ne fait PAS rougir la revue", () => {
    // Le témoin qui protège l'audit d'octobre. Sans lui, on afficherait une NC
    // majeure sur un référentiel qui ne s'applique pas encore.
    const v = evaluerCouvertureOff32(revue([]), AVANT);
    expect(v.couvert).toBe(true);
    expect(v.manques).toEqual([]);
    expect(v.preuves.join(" ")).toMatch(/pas encore exigée/i);
  });

  it("APRÈS l'échéance, son absence fait rougir — et le message dit pourquoi", () => {
    const v = evaluerCouvertureOff32(revue([]), APRES);
    expect(v.couvert).toBe(false);
    expect(v.manques.join(" ")).toMatch(/analyse de risques/i);
    expect(v.manques.join(" ")).toMatch(/2026-728/);
  });

  it("APRÈS l'échéance, une analyse renseignée suffit à couvrir", () => {
    // 🔑 LE TÉMOIN POSITIF. Sans lui, une borne qui refuserait TOUT passerait le
    // test précédent en paraissant juste — et l'indicateur serait à jamais rouge.
    const v = evaluerCouvertureOff32(revue([RISQUE_COMPLET]), APRES);
    expect(v.couvert).toBe(true);
    expect(v.preuves.join(" ")).toMatch(/1 risque analysé/);
  });

  it("la borne est bien celle du décret, pas une date inventée", () => {
    expect(EXIGENCE_RISQUES_DEPUIS.toISOString().slice(0, 10)).toBe("2026-11-01");
  });
});

describe("compterRisquesExploitables — un constat n'est pas un risque maîtrisé", () => {
  it("refuse un risque SANS mesure de maîtrise", () => {
    // L'indicateur porte sur le PROCESSUS. Une liste d'inquiétudes sans réponse
    // n'est pas une analyse : c'est un inventaire de peurs.
    const sansMaitrise = { ...RISQUE_COMPLET, maitrise: "" };
    expect(compterRisquesExploitables([sansMaitrise])).toBe(0);
    expect(evaluerCouvertureOff32(revue([sansMaitrise]), APRES).couvert).toBe(false);
  });

  it("refuse un risque sans intitulé, et ce qui n'est pas une liste", () => {
    expect(compterRisquesExploitables([{ ...RISQUE_COMPLET, intitule: "   " }])).toBe(0);
    expect(compterRisquesExploitables(undefined)).toBe(0);
    expect(compterRisquesExploitables("trois risques")).toBe(0);
    expect(compterRisquesExploitables([null, 42, "x"])).toBe(0);
  });

  it("compte ceux qui portent les deux, et DISCRIMINE dans un même lot", () => {
    // Un lot mixte : une règle qui garde tout, ou qui jette tout, passerait
    // chacun des tests précédents pris séparément.
    const lot = [RISQUE_COMPLET, { ...RISQUE_COMPLET, maitrise: "" }, RISQUE_COMPLET];
    expect(compterRisquesExploitables(lot)).toBe(2);
  });
});

/**
 * 🔴 LE PIÈGE QUI A FAILLI PASSER — et qui s'est déjà produit ce jour-là.
 *
 * `compterRisquesExploitables` lit `revue.risques`. Si un lecteur interroge la
 * base SANS sélectionner cette colonne, il reçoit `undefined`, le compteur rend
 * 0, et après le 1er novembre la revue est déclarée NON couverte alors que son
 * analyse existe.
 *
 * Un champ non sélectionné ne rougit pas : il rend une ABSENCE. C'est le même
 * défaut que le filtre du rappel J-7 corrigé le matin même, et que la garde
 * `select.createdAt` qui le couvre.
 */
describe("tous les lecteurs de la revue sélectionnent bien `risques`", () => {
  const LECTEURS = [
    "src/server/qualiopi/conformite/audit-dossier.ts",
    "src/server/qualiopi/conformite/conformite-service.ts",
  ] as const;

  for (const fichier of LECTEURS) {
    it(`${fichier} demande la colonne à la base`, () => {
      const source = readFileSync(join(process.cwd(), fichier), "utf8").replace(/\s+/g, " ");
      expect(
        source,
        `${fichier} lit la revue de direction sans demander \`risques\`. Le prédicat ` +
          `recevrait \`undefined\`, compterait 0 risque, et déclarerait l'indicateur 32 ` +
          `non couvert après le 1er novembre 2026 — alors que l'analyse existe en base.`,
      ).toMatch(/planActions: true, [^}]*risques: true/);
    });
  }

  it("le témoin lit de VRAIES sources", () => {
    // Sans ceci, un chemin devenu faux rendrait une chaîne vide et les deux
    // assertions ci-dessus échoueraient pour la mauvaise raison — ou pire,
    // passeraient si on les avait écrites en négatif.
    for (const f of LECTEURS) {
      expect(readFileSync(join(process.cwd(), f), "utf8").length).toBeGreaterThan(2000);
    }
  });
});
