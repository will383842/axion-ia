// @vitest-environment node

/**
 * Les textes pré-remplis de réponse à un candidat — ce qu'ils n'ont PAS le
 * droit de dire.
 *
 * ## Pourquoi une garde sur de la prose
 *
 * Ces textes partent à des gens. Trois défauts y sont possibles, et aucun ne se
 * voit à la relecture d'un diff :
 *
 *  1. **Une variable jamais substituée.** Un `{prenom}` que le composeur ne
 *     fournit pas reste à l'écran — c'est voulu, un trou visible se corrige.
 *     Mais un `{poste}` mal orthographié en `{postes}` serait un trou qu'on
 *     découvrirait dans la boîte du destinataire.
 *  2. **Une promesse de délai.** La page carrières promet « quelques jours
 *     ouvrés » ; l'accusé de réception s'en est délibérément abstenu le
 *     2026-08-13, faute de pouvoir la tenir. Tant que l'arbitrage `D3` n'est
 *     pas rendu, aucun de ces textes ne doit la réintroduire par la bande.
 *  3. **Une promesse de conservation.** « Nous gardons votre candidature » n'est
 *     vrai que si la personne a coché la case vivier — décochée par défaut. Le
 *     dire à tout le monde serait faux pour la majorité, et le promettre sans
 *     base légale serait pire.
 *
 * ## Ce que cette garde ne fait pas
 *
 * Elle ne juge ni le ton ni la justesse. Elle vérifie des absences et une
 * cohérence de variables. C'est une garde de forme, et elle le dit.
 */

import { describe, expect, it } from "vitest";

import {
  MODELES_REPONSE,
  MODELES_REPONSE_IDS,
  remplirModele,
  type ModeleReponse,
} from "../modeles-reponse";

/** Les seules variables que le composeur sait fournir. */
const VARIABLES_CONNUES = new Set(["prenom", "poste"]);

function variablesDe(modele: ModeleReponse): string[] {
  return [...`${modele.objet}\n${modele.corps}`.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "");
}

describe("textes pré-remplis de réponse à un candidat", () => {
  it("la liste des identifiants et celle des textes ne peuvent pas diverger", () => {
    // Témoin de NON-VACUITÉ, et garde de cohérence : le `z.enum` de l'action
    // lit `MODELES_REPONSE_IDS`, l'écran lit `MODELES_REPONSE`. Deux listes qui
    // décriraient des ensembles différents laisseraient un modèle choisissable
    // et non enregistrable — ou l'inverse.
    expect(MODELES_REPONSE.length).toBeGreaterThan(1);
    expect([...MODELES_REPONSE].map((m) => m.id).sort()).toEqual([...MODELES_REPONSE_IDS].sort());
  });

  it("🔴 aucune variable inconnue du composeur", () => {
    const inconnues = MODELES_REPONSE.flatMap((m) =>
      variablesDe(m)
        .filter((v) => !VARIABLES_CONNUES.has(v))
        .map((v) => `${m.id} → {${v}}`),
    );
    expect(
      inconnues,
      "une variable que le composeur ne fournit pas resterait telle quelle dans " +
        "l'e-mail envoyé. Soit la renommer, soit l'ajouter aux valeurs fournies.",
    ).toEqual([]);
  });

  it("🔴 aucun texte ne promet un délai de réponse — `D3` n'est pas tranchée", () => {
    const promesses =
      /sous (?:\d+|quelques|un|une|deux|trois) (?:heures?|jours?|semaines?)|délai de r[ée]ponse|dans les meilleurs délais|revenons vers vous sous/i;
    const fautifs = MODELES_REPONSE.filter((m) => promesses.test(`${m.objet} ${m.corps}`)).map(
      (m) => m.id,
    );
    expect(
      fautifs,
      "un texte promet un délai. L'accusé de réception s'en abstient depuis le " +
        "2026-08-13 parce que la promesse ne tenait pas ; la réintroduire ici la " +
        "rendrait vraie pour personne. À rouvrir quand `D3` sera arbitrée.",
    ).toEqual([]);
  });

  it("🔴 aucun texte ne promet de conserver la candidature", () => {
    // La conservation en vivier repose sur une case OPTIONNELLE, décochée par
    // défaut. La promettre à tout le monde serait faux pour la majorité — et la
    // promettre sans base légale, pire que faux.
    const conservation =
      /(?:nous )?(?:gardons|conservons|garderons|conserverons)[^.]{0,40}candidature|vivier/i;
    const fautifs = MODELES_REPONSE.filter((m) => conservation.test(m.corps)).map((m) => m.id);
    expect(
      fautifs,
      "un texte promet une conservation qui dépend d'un consentement que la " +
        "personne n'a peut-être pas donné (la case vivier est décochée par défaut).",
    ).toEqual([]);
  });

  it("une variable non fournie reste VISIBLE, accolades comprises", () => {
    // 🔑 Le contraire — remplacer par une chaîne vide — produirait « Bonjour , »,
    // une phrase grammaticalement correcte donc invisible à la relecture, qui
    // partirait telle quelle.
    expect(remplirModele("Bonjour {prenom},", { prenom: null })).toBe("Bonjour {prenom},");
    expect(remplirModele("Bonjour {prenom},", { prenom: "   " })).toBe("Bonjour {prenom},");
    expect(remplirModele("Bonjour {prenom},", { prenom: "Sofia" })).toBe("Bonjour Sofia,");
  });

  it("le modèle « libre » ne pré-remplit rien", () => {
    // Témoin inverse : si tous les modèles portaient du texte, choisir « libre »
    // imposerait d'effacer avant d'écrire.
    const libre = MODELES_REPONSE.find((m) => m.id === "libre");
    expect(libre?.objet).toBe("");
    expect(libre?.corps).toBe("");
  });
});
