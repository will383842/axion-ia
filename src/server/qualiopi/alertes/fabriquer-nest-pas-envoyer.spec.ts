/**
 * 🔴 FABRIQUER UN LIEN N'EST PAS L'ENVOYER — et rien ne doit prétendre le contraire.
 *
 * ## Le défaut, et ce qu'il a coûté
 *
 * `emettreLiensSessionAction` fabrique des jetons d'émargement et affiche leurs
 * URL et QR à l'écran. **Elle ne contient aucun `enqueueEmail`** : aucun message
 * ne part. C'est un choix légitime — on distribue les QR en séance — mais deux
 * surfaces le présentaient comme une LIVRAISON :
 *
 * - l'alerte `emargement_aucune_signature` s'intitulait « Liens d'émargement
 *   **PARTIS**, aucune signature » et affirmait « les liens sont **en
 *   circulation** », alors que sa condition ne lit qu'un jeton vivant ;
 * - l'étape de parcours s'appelait « Liens d'émargement **émis** » et passait au
 *   vert sur la seule existence d'un jeton.
 *
 * Ce n'est pas un défaut de style. Le 2026-09-05, sur une session réelle, cette
 * alerte a orienté vers « relancer la stagiaire » alors que l'hypothèse vivante
 * était **qu'elle n'avait jamais rien reçu**. Une alerte qui nomme une cause
 * fausse est pire qu'une alerte absente : elle déplace l'attention, et elle le
 * fait avec l'autorité d'un signal critique.
 *
 * ## Ce que ce témoin garde
 *
 * Il lit la SOURCE, parce que le défaut est dans des chaînes de caractères
 * qu'aucun test de comportement ne peut attraper : la règle se déclenche
 * correctement, elle se contente de mal se nommer.
 *
 * ⚠️ Il vise la TOURNURE, jamais le mot isolé. « envoi » et « envoyé » sont
 * légitimes — et même nécessaires — dans la phrase qui dit d'aller VÉRIFIER
 * l'envoi. Ce qui est interdit, c'est d'AFFIRMER que l'envoi a eu lieu. C'est la
 * leçon du 2026-09-04, déjà payée : une garde lexicale trop large force à
 * retirer de l'écran l'information la plus utile, juste pour la faire taire.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { ALERTE_CATALOGUE } from "@/server/qualiopi/alertes/catalogue";

/**
 * Retire les commentaires avant toute recherche textuelle.
 *
 * 🔴 Sans ça, cette garde rougit sur ELLE-MÊME — et elle l'a fait, deux fois, à
 * sa première exécution. Les commentaires qui documentent le défaut CITENT
 * forcément les tournures interdites (« ce message affirmait *les liens sont en
 * circulation* »), et le témoin de prémisse attrapait le mot `enqueueEmail`
 * écrit dans une phrase de documentation, pas dans un appel.
 *
 * Chercher une faute dans de la prose qui EXPLIQUE la faute est le faux positif
 * le plus prévisible d'une garde qui lit la source. On ne regarde donc que le
 * CODE : c'est lui qui s'exécute, et c'est lui seul qui peut mentir à
 * l'utilisateur.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/.*$/, ""))
    .join("\n");
}

const RACINE = process.cwd();
const EVALUATEUR = sansCommentaires(
  fs.readFileSync(path.join(RACINE, "src/server/qualiopi/alertes/evaluateur.ts"), "utf-8"),
);
const PARCOURS = sansCommentaires(
  fs.readFileSync(path.join(RACINE, "src/server/qualiopi/parcours/session-parcours.ts"), "utf-8"),
);
const ACTION_EMISSION = sansCommentaires(
  fs.readFileSync(path.join(RACINE, "src/server/actions/qualiopi/emargement-liens.ts"), "utf-8"),
);

/**
 * Les tournures qui AFFIRMENT une livraison. Chacune a été relevée telle quelle
 * dans le code avant correction — ce ne sont pas des inventions défensives.
 */
const AFFIRMATIONS_DE_LIVRAISON: ReadonlyArray<RegExp> = [
  /liens d'émargement partis/i,
  /liens sont\s+en circulation/i,
];

describe("🔴 fabriquer un lien d'émargement n'est pas l'envoyer", () => {
  it("le fait qui FONDE la garde est toujours vrai : émettre n'envoie rien", () => {
    // 🔑 TÉMOIN DE PRÉMISSE. Toute cette garde repose sur « la fabrication
    // n'envoie aucun message ». Le jour où quelqu'un branchera un envoi dans
    // l'action d'émission, la prémisse tombera — et les libellés que cette
    // garde interdit redeviendront JUSTES. Sans cette ligne, on continuerait
    // d'interdire un vocabulaire devenu exact, et la garde se ferait désarmer.
    const bloc = ACTION_EMISSION.slice(
      ACTION_EMISSION.indexOf("export async function emettreLiensSessionAction"),
      ACTION_EMISSION.indexOf("export async function envoyerLiensEmargementAction"),
    );
    expect(bloc.length).toBeGreaterThan(200);
    expect(bloc).not.toContain("enqueueEmail");
  });

  it("le catalogue n'AFFIRME pas que les liens sont partis", () => {
    const titre = ALERTE_CATALOGUE.emargement_aucune_signature?.titre ?? "";
    expect(titre.length).toBeGreaterThan(0);
    for (const motif of AFFIRMATIONS_DE_LIVRAISON) expect(titre).not.toMatch(motif);
  });

  it("la règle n'AFFIRME pas que les liens sont en circulation", () => {
    const debut = EVALUATEUR.indexOf('code: "emargement_aucune_signature" as const');
    expect(debut).toBeGreaterThan(0);
    const bloc = EVALUATEUR.slice(debut, debut + 1600);
    for (const motif of AFFIRMATIONS_DE_LIVRAISON) expect(bloc).not.toMatch(motif);
  });

  it("… mais elle DIT d'aller vérifier l'envoi — sinon on a juste rendu l'alerte muette", () => {
    // Contre-témoin indispensable. Retirer les mots « partis » et « en
    // circulation » suffirait à faire passer les deux témoins ci-dessus, en
    // laissant l'utilisateur sans la seule information qui compte. Une garde
    // qu'on satisfait en SUPPRIMANT l'information est une garde nuisible.
    const debut = EVALUATEUR.indexOf('code: "emargement_aucune_signature" as const');
    const bloc = EVALUATEUR.slice(debut, debut + 1600);
    expect(bloc).toMatch(/ENVOY/i);
    // ⚠️ Motif volontairement COURT, et tenant dans UN SEUL littéral.
    // `/deux\s+gestes distincts/` échouait alors que la phrase est bien là : le
    // message est concaténé, et la source porte « deux ` + `gestes distincts ».
    // Un `\s+` ne traverse pas une jointure de littéraux — chercher une phrase
    // à cheval sur deux morceaux de code, c'est chercher un texte qui n'existe
    // nulle part sous cette forme.
    expect(bloc).toMatch(/gestes distincts/i);
  });

  it("l'étape de parcours ne dit plus « émis », qui se lit « envoyés »", () => {
    const debut = PARCOURS.indexOf('cle: "liens_signature_emis"');
    expect(debut).toBeGreaterThan(0);
    const bloc = PARCOURS.slice(debut, debut + 1800);
    expect(bloc).not.toMatch(/libelle: "Liens d'émargement émis"/);
    expect(bloc).toMatch(/libelle: "Liens d'émargement fabriqués"/);
  });

  it("… et son avertissement dit que fabriquer n'envoie PAS", () => {
    const debut = PARCOURS.indexOf('cle: "liens_signature_emis"');
    const bloc = PARCOURS.slice(debut, debut + 1800);
    expect(bloc).toMatch(/ne l'ENVOIE pas/);
  });
});
