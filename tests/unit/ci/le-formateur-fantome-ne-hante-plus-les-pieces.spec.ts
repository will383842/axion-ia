/**
 * 🔴 LOT F — TROIS TROUS DU CYCLE DE VIE DU FORMATEUR (audit du 2026-09-05).
 *
 * Les trois disent la même chose sous trois formes, et c'est le motif de toute
 * la journée : **on ferme le chemin nominal et on laisse le stock derrière.**
 *
 * ## D9 — une pièce contractuelle nommait l'ORGANISME comme formateur
 *
 * Le repli de `resolveFormateurNom` rendait la raison sociale. Sur la
 * convocation et sur la grille d'évaluation, la ligne s'appelle
 * « Formateur / Formatrice » : y imprimer « Axion-IA OÜ » affirme qu'une
 * personne morale a animé la session. **C'est faux, sur une pièce que
 * l'auditeur lit.** Pire sur la grille, où le nom est repris dans le bloc de
 * SIGNATURE — il y fabrique un signataire qui n'existe pas.
 *
 * ⚠️ Et le correctif n'est PAS uniforme, c'est tout l'intérêt : sur le livret
 * d'accueil, la même valeur alimente « Contact pédagogique › Nom / Prénom », où
 * la raison sociale est **légitime**. Un repli uniforme aurait corrigé deux
 * pièces et cassé la troisième — le stagiaire se serait retrouvé sans
 * interlocuteur.
 *
 * ## D8 — la désactivation d'un formateur ne retirait pas ses affectations
 *
 * `isTrainerHabilite` ne joue qu'AU MOMENT de l'affectation : elle protège
 * l'entrée, jamais le stock. Aucune règle ne lisait `actif: false` — vérifié,
 * `grep` rendait zéro sur l'évaluateur ET sur le catalogue. « Peut-on encore
 * l'affecter ? » et « est-il encore affecté ? » sont deux questions.
 *
 * ## D10 — personne ne prévenait les stagiaires d'un changement de formateur
 *
 * Une ALERTE, pas un envoi automatique : un changement de formateur se raconte,
 * et la bonne formulation dépend du motif. `resolutionAuto: false`, parce que
 * « j'ai prévenu » est un fait humain qu'aucune colonne n'observe.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, ...relatif.split("/")), "utf8");
}

const PRODUCTEURS = lire("src/server/qualiopi/documents/production/producteurs.ts");
const EVALUATEUR = lire("src/server/qualiopi/alertes/evaluateur.ts");
const CATALOGUE = lire("src/server/qualiopi/alertes/catalogue.ts");

describe("🔴 D9 — aucune pièce ne nomme l'organisme à la place du formateur", () => {
  it("le repli explicite existe", () => {
    expect(
      PRODUCTEURS,
      "`FORMATEUR_A_DESIGNER` a disparu : le repli redevient la raison sociale, " +
        "et une convocation affirme qu'une personne morale anime la session.",
    ).toContain("FORMATEUR_A_DESIGNER");
  });

  it("🔴 les DEUX pièces d'identité l'emploient, la troisième NON", () => {
    // Le compte est la mesure. Deux sites servent la ligne
    // « Formateur / Formatrice » (convocation, grille) ; le troisième sert
    // « Contact pédagogique », où la raison sociale est juste.
    const avecRepli = PRODUCTEURS.match(/FORMATEUR_A_DESIGNER,/g)?.length ?? 0;
    expect(
      avecRepli,
      "le nombre de pièces d'identité protégées a changé. Deux attendues : la " +
        "convocation et la grille d'évaluation.",
    ).toBe(2);

    const avecRaisonSociale = PRODUCTEURS.match(/identite\.raisonSociale,\n\s*\);/g)?.length ?? 0;
    expect(
      avecRaisonSociale,
      "le livret d'accueil ne retombe plus sur la raison sociale pour son contact " +
        "pédagogique : quand aucun formateur n'est désigné, le stagiaire se " +
        "retrouve sans interlocuteur. Ce repli-là est LÉGITIME.",
    ).toBe(1);
  });
});

describe("🔴 D8 — un formateur désactivé encore affecté est signalé", () => {
  it("la règle existe et lit bien `actif: false`", () => {
    expect(EVALUATEUR, "la règle D8 a disparu de l'évaluateur").toContain(
      "regleFormateurDesactiveEncoreAffecte",
    );
    // LE prédicat. Sans lui la règle sélectionnerait tous les formateurs, ou
    // aucun — et « aucun » ressemble exactement à « tout va bien ».
    const depart = EVALUATEUR.indexOf("async function regleFormateurDesactiveEncoreAffecte");
    const corps = EVALUATEUR.slice(depart, depart + 1500);
    expect(
      corps,
      "la règle ne croise plus `trainer: { actif: false }` : elle ne mesure plus " +
        "la désactivation, donc elle ne mesure rien.",
    ).toMatch(/trainer:\s*\{\s*actif:\s*false\s*\}/);
    expect(
      corps,
      "la règle ne se borne plus aux sessions non terminées : elle crierait sur " +
        "des sessions déjà animées, où il n'y a aucun geste à faire.",
    ).toMatch(/statut:\s*\{\s*in:\s*\["planifiee",\s*"en_cours"\]\s*\}/);
  });

  it("elle est BRANCHÉE et CATALOGUÉE — sinon elle ne lève rien, ou lève dans le vide", () => {
    expect(
      EVALUATEUR,
      "la règle n'est plus dans la table `REGLES` : elle ne s'exécute jamais, et " +
        "son absence ressemble à un dépôt sain.",
    ).toContain('nom: "formateur_desactive_encore_affecte"');
    expect(
      CATALOGUE,
      "le code n'est plus au catalogue : l'alerte serait routée vers AUCUNE boîte " +
        "et jamais auto-résolue.",
    ).toContain("formateur_desactive_encore_affecte:");
  });
});

describe("🔴 D10 — le changement de formateur alerte, et n'envoie RIEN", () => {
  it("la règle existe, est branchée et cataloguée", () => {
    expect(EVALUATEUR, "la règle D10 a disparu").toContain(
      "regleStagiairesNonPrevenusChangementFormateur",
    );
    expect(EVALUATEUR, "la règle D10 n'est plus branchée").toContain(
      'nom: "stagiaires_non_prevenus_changement_formateur"',
    );
    expect(CATALOGUE, "le code D10 n'est plus au catalogue").toContain(
      "stagiaires_non_prevenus_changement_formateur:",
    );
  });

  it("🔴 elle n'envoie AUCUN e-mail — c'est l'arbitrage, pas un oubli", () => {
    // Un changement de formateur se raconte : « votre formateur a changé » sans
    // un mot d'explication inquiète plus qu'il n'informe, et la bonne
    // formulation dépend du motif. L'organisme décide, l'outil rappelle.
    const depart = EVALUATEUR.indexOf(
      "async function regleStagiairesNonPrevenusChangementFormateur",
    );
    const corps = EVALUATEUR.slice(depart, depart + 3500);
    expect(
      /enqueueEmail|envoyer[A-Z]/.test(corps),
      "la règle D10 envoie désormais un e-mail. C'était l'arbitrage explicite : " +
        "une alerte, pas un envoi. Si la décision change, elle change par un ADR " +
        "et l'accord de Will — pas par un import de plus.",
    ).toBe(false);
  });

  it("🔴 elle ne se referme PAS toute seule, et le catalogue dit pourquoi", () => {
    // « J'ai prévenu les stagiaires » est un fait HUMAIN qu'aucune colonne
    // n'observe. Une résolution automatique s'appuierait sur autre chose — et il
    // n'y a rien d'autre : elle se refermerait au premier balayage, avant que
    // quiconque ait prévenu qui que ce soit.
    const depart = CATALOGUE.indexOf("stagiaires_non_prevenus_changement_formateur:");
    const entree = CATALOGUE.slice(depart, depart + 900);
    expect(entree, "l'alerte D10 se résout de nouveau toute seule").toContain(
      "resolutionAuto: false",
    );
    expect(
      entree,
      "la justification du non-auto a disparu : une entrée `resolutionAuto: false` " +
        "sans motif est indiscernable d'un oubli.",
    ).toContain("motifSansResolutionAuto");
  });

  it("elle se tait quand PERSONNE ne tient la place — trois critiques le disent déjà", () => {
    const depart = EVALUATEUR.indexOf(
      "async function regleStagiairesNonPrevenusChangementFormateur",
    );
    const corps = EVALUATEUR.slice(depart, depart + 3500);
    expect(
      corps,
      "la règle ne saute plus les sessions sans remplaçant : elle doublerait les " +
        "trois alertes critiques « la session n'a plus de formateur », et ferait " +
        "deux lignes pour un seul geste.",
    ).toContain("s.formateurPrincipalId === null");
  });
});
