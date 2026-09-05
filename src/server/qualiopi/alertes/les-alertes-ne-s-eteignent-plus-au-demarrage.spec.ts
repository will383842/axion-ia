/**
 * 🔴 QUATRE ALERTES CRITIQUES S'EFFAÇAIENT AU DÉMARRAGE DE LA SESSION.
 *
 * C'est le trou n°4 de l'audit du moteur d'alertes (2026-09-04), et le plus
 * contre-intuitif de la liste : **la règle cessait de crier au moment précis où
 * le risque devenait un fait.**
 *
 * Le mécanisme est toujours le même, et il tient en deux lignes :
 *
 *   1. le `where` de la règle exige `statut: "planifiee"` (ou `dateDebut > now`) ;
 *   2. le catalogue porte `resolutionAuto: true`.
 *
 * Le jour du démarrage, le cron passe la session en `en_cours`. La règle cesse
 * de produire la candidate. `synchroniserAlertes` constate que la condition a
 * disparu et **résout l'alerte critique**. Sur la console, l'administrateur voit
 * une ligne rouge s'effacer — le signal universel d'un problème traité — alors
 * que la convention tripartite n'a jamais été signée, ou que le formateur non
 * habilité est en train d'animer.
 *
 * Trois règles étaient concernées :
 *
 *   · `convention_tripartite_manquante` — la subrogation OPCO est perdue ;
 *   · `formateur_non_habilite_assigne` — indicateurs 21/22, l'écart est au
 *     dossier et se lit lors d'un audit ;
 *   · `formateur_indisponible_sur_session` — le formateur s'est déclaré absent
 *     sur les jours qu'il est censé animer.
 *
 * ## Pourquoi cette garde LIT LA SOURCE plutôt que d'appeler l'évaluateur
 *
 * `regleFormateurIndisponibleSurSession` appelle `listIndisposEntre`, qui lit un
 * modèle Prisma que `evaluateur.spec.ts` ne monte pas : la règle y tombe dans le
 * **fail-soft par règle**, et un test d'intégration serait vert sans rien
 * exercer. C'est le motif documenté par `mission-expiree-nest-pas-muette.spec.ts`,
 * et la même réponse est retenue ici — on dérive du code ce qui a fermé le trou.
 *
 * ⚠️ Cette garde a été VUE ROUGIR : chacune des trois assertions ci-dessous a
 * été rejouée contre la version d'avant correctif (le `statut: "planifiee"`
 * restauré à la main), et chacune échoue.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ALERTE_CATALOGUE } from "./catalogue";

const SOURCE = readFileSync(
  join(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts"),
  "utf8",
);

/**
 * Le corps d'une règle, isolé de ses voisines.
 *
 * ⚠️ Le découpage s'arrête à la PROCHAINE déclaration de fonction, pas à la
 * prochaine accolade : sans cela, une assertion « ce texte n'apparaît pas »
 * porterait sur tout le fichier et ne prouverait plus rien de la règle visée.
 */
function corpsDeLaRegle(nom: string): string {
  const debut = SOURCE.indexOf(`async function ${nom}`);
  expect(debut, `la règle ${nom} a disparu du fichier`).toBeGreaterThan(-1);
  const suivante = SOURCE.indexOf("async function ", debut + 20);
  return SOURCE.slice(debut, suivante > debut ? suivante : SOURCE.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Le témoin NÉGATIF n'est pas seul : on vérifie d'abord que le découpage MESURE
// ─────────────────────────────────────────────────────────────────────────────

describe("le découpage isole bien une règle — sinon tout ce qui suit ment", () => {
  // 🔴 Dix `not.toContain` sur une chaîne vide passent tous. Sans ce témoin
  // positif, un renommage de règle rendrait la suite entière verte en ne
  // vérifiant plus rien — le mode d'échec le plus courant d'une garde statique.
  it.each([
    "regleConventionTripartite",
    "regleFormateurNonHabiliteAssigne",
    "regleFormateurIndisponibleSurSession",
  ])("%s — le corps extrait n'est pas vide et contient sa propre requête", (nom) => {
    const corps = corpsDeLaRegle(nom);
    expect(corps.length).toBeGreaterThan(400);
    expect(corps).toContain("prisma.trainingSession.findMany");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// convention_tripartite_manquante
// ─────────────────────────────────────────────────────────────────────────────

describe("convention_tripartite_manquante — la subrogation perdue continue de se voir", () => {
  const corps = () => corpsDeLaRegle("regleConventionTripartite");

  it("🔴 elle couvre `en_cours`, et plus seulement `planifiee`", () => {
    // C'était la ligne du défaut : `statut: "planifiee"` seul. La session passe
    // `en_cours` au démarrage, la candidate disparaît, `resolutionAuto: true`
    // referme l'alerte — au moment exact où la subrogation devient irrécupérable.
    expect(corps()).toContain('statut: { in: ["planifiee", "en_cours"] }');
  });

  it("🔴 la forme d'avant correctif ne doit pas revenir", () => {
    expect(
      corps(),
      "`statut: \"planifiee\"` seul rendrait à nouveau l'alerte muette au démarrage.",
    ).not.toContain('statut: "planifiee",');
  });

  it("elle garde une borne basse — pas d'inventaire de tout l'historique", () => {
    // Sans borne, le premier passage remonte toutes les sessions jamais
    // régularisées d'un coup : une salve de critiques qui noie les vraies.
    expect(corps()).toContain("gte: daysAgo(365, now)");
  });

  it("le message ne réclame plus « faites signer » quand il n'y a plus rien à signer", () => {
    // Une alerte qui demande un geste devenu impossible apprend à être ignorée.
    expect(corps()).toContain("a démarré le");
    expect(corps()).toContain("subrogation");
  });

  it("le catalogue la laisse se refermer — c'est ce qui rendait le trou mortel", () => {
    // On ne corrige PAS en passant `resolutionAuto: false` : la régularisation
    // doit refermer l'alerte. C'est la BORNE qui devait bouger, pas la
    // désescalade — sinon l'alerte survivrait à sa propre résolution.
    expect(ALERTE_CATALOGUE["convention_tripartite_manquante"]?.resolutionAuto).toBe(true);
    expect(ALERTE_CATALOGUE["convention_tripartite_manquante"]?.niveau).toBe("critique");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formateur_non_habilite_assigne
// ─────────────────────────────────────────────────────────────────────────────

describe("formateur_non_habilite_assigne — l'alerte ne se ferme plus le jour où il anime", () => {
  const corps = () => corpsDeLaRegle("regleFormateurNonHabiliteAssigne");

  it("🔴 elle couvre `en_cours` et ne s'arrête plus à `dateDebut > now`", () => {
    expect(corps()).toContain('statut: { in: ["planifiee", "en_cours"] }');
    expect(
      corps(),
      "`dateDebut: { gt: now }` fermait l'alerte au premier jour d'animation.",
    ).not.toContain("dateDebut: { gt: now }");
  });

  it("la fenêtre suit `dateFin` — la session reste candidate tant qu'elle n'est pas finie", () => {
    // Et pas `daysAgo(365)` sur `dateDebut` : la borne haute sert aussi à ne pas
    // faire lire un an d'historique à chaque balayage.
    expect(corps()).toContain("dateFin: { gte: daysAgo(7, now) }");
  });

  it("🔴 elle ESCALADE en critique une fois la session commencée", () => {
    // Avant animation, l'écart est réparable (habiliter, ou changer de
    // formateur). Après, il est au dossier et se lit lors d'un audit : les
    // indicateurs 21 et 22 portent sur la qualification de CELUI QUI A DISPENSÉ.
    expect(corps()).toContain('niveau: demarree ? "critique" : "important"');
  });

  it("le catalogue garde le cas NOMINAL — et l'alerte reste auto-résoluble", () => {
    // On ne corrige pas une borne trop courte en interdisant la désescalade :
    // habiliter le formateur DOIT refermer l'alerte. C'est la fenêtre qui
    // devait bouger, pas `resolutionAuto`.
    expect(ALERTE_CATALOGUE["formateur_non_habilite_assigne"]?.niveau).toBe("important");
    expect(ALERTE_CATALOGUE["formateur_non_habilite_assigne"]?.resolutionAuto).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formateur_indisponible_sur_session
// ─────────────────────────────────────────────────────────────────────────────

describe("formateur_indisponible_sur_session — le conflit ne disparaît plus quand il se réalise", () => {
  const corps = () => corpsDeLaRegle("regleFormateurIndisponibleSurSession");

  it("🔴 elle couvre `en_cours` et ne borne plus sur `dateDebut > now`", () => {
    expect(corps()).toContain('statut: { in: ["planifiee", "en_cours"] }');
    expect(corps()).not.toContain("dateDebut: { gt: now, lte: horizon }");
  });

  it("la fenêtre est posée sur `dateFin`, pour garder la lecture des indispos étroite", () => {
    // Une borne basse de 365 jours sur `dateDebut`, comme ailleurs dans ce
    // fichier, ferait lire deux ans d'indisponibilités à chaque balayage.
    expect(corps()).toContain("dateFin: { gte: daysAgo(7, now) }");
  });

  it("🔴 le message change de geste une fois la session démarrée", () => {
    // « Déplacez la session » n'a plus de sens le jour même. Ce qui reste :
    // qui a réellement animé, et faut-il consigner un incident ?
    expect(corps()).toContain("Vérifiez QUI a réellement animé");
    expect(corps()).toContain("Déplacez la session, ou changez de formateur.");
  });
});
