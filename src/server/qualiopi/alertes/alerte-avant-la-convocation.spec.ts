/**
 * 🔴 UNE ALERTE QUI ARRIVE LE JOUR DE L'ENVOI NE SERT À RIEN.
 *
 * ## Le défaut qu'elle ferme
 *
 * Recette du 2026-09-03/04. `convocation-formateur.ts` transporte fidèlement le
 * contact sur place et les consignes d'accès jusqu'au formateur — quand ils sont
 * saisis. Vides, `optionnel()` les omet : l'e-mail rend une adresse et une salle,
 * sans personne à demander à l'accueil ni manière d'entrer. Il a l'air complet, et
 * il est inutilisable à la porte. Rien ne le signalait ; la seule façon de s'en
 * apercevoir était que le formateur appelle depuis le trottoir.
 *
 * ## Pourquoi CE test, et pas seulement l'existence de l'alerte
 *
 * L'alerte n'a de valeur que par son DÉLAI. La convocation part dans la fenêtre
 * `FENETRE_CONVOCATION_J7_JOURS` (7,5 j) ; une alerte levée à J-7 arriverait le
 * jour même où l'e-mail muet s'envole. Elle existerait, elle serait verte à tous
 * les contrôles, et elle ne préviendrait de rien.
 *
 * Les deux constantes vivent dans deux fichiers différents, pour deux raisons
 * différentes, et rien ne les relie dans le code. C'est exactement la forme
 * d'invariant qui se casse en silence : quelqu'un élargit la fenêtre de
 * convocation à 14 jours pour rattraper les affectations tardives, et l'alerte
 * devient inerte sans qu'aucun test ne rougisse. Ce fichier est le seul endroit
 * où la relation est écrite.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FENETRE_CONVOCATION_J7_JOURS } from "@/server/qualiopi/trainers/convocation-formateur";
import { ALERTE_CATALOGUE } from "./catalogue";

const SOURCE = readFileSync(
  join(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts"),
  "utf8",
);

/**
 * La constante est LUE DANS LA SOURCE, pas importée — et c'est subi, pas choisi :
 * importer `evaluateur.ts` entraîne tout son graphe (next-auth compris) et casse
 * la collecte du test. `mission-expiree-nest-pas-muette.spec.ts` fait déjà ainsi.
 * La lecture est donc STRICTE : si la déclaration change de forme, ce test échoue
 * au lieu de retomber sur une valeur par défaut qui ne vérifierait plus rien.
 */
function fenetreContactSurPlace(): number {
  const m = /export const FENETRE_CONTACT_SUR_PLACE_JOURS = (\d+(?:\.\d+)?);/.exec(SOURCE);
  expect(m, "FENETRE_CONTACT_SUR_PLACE_JOURS introuvable dans evaluateur.ts").not.toBeNull();
  return Number(m![1]);
}
const FENETRE_CONTACT_SUR_PLACE_JOURS = fenetreContactSurPlace();

/** Le corps de la règle, isolé de ses voisines. */
function corpsDeLaRegle(): string {
  const debut = SOURCE.indexOf("async function regleContactSurPlaceAbsent");
  expect(debut, "la règle regleContactSurPlaceAbsent a disparu").toBeGreaterThan(-1);
  const suivante = SOURCE.indexOf("async function ", debut + 20);
  return SOURCE.slice(debut, suivante > debut ? suivante : SOURCE.length);
}

describe("🔴 l'alerte se lève AVANT que la convocation ne parte", () => {
  it("sa fenêtre est strictement plus large que celle de la convocation", () => {
    expect(FENETRE_CONTACT_SUR_PLACE_JOURS).toBeGreaterThan(FENETRE_CONVOCATION_J7_JOURS);
  });

  it("elle laisse au moins une semaine pleine pour appeler le client", () => {
    // Deux fois la fenêtre de convocation : le temps d'un appel, et d'un second
    // si le client n'a pas répondu au premier. Une marge de 24 h suffirait à
    // faire passer le test précédent tout en ne laissant le temps de rien.
    expect(FENETRE_CONTACT_SUR_PLACE_JOURS - FENETRE_CONVOCATION_J7_JOURS).toBeGreaterThanOrEqual(
      6,
    );
  });

  it("la règle lit bien SA constante, elle ne recopie pas un nombre", () => {
    // Un `14` écrit en dur ici se désolidariserait de la constante que ce test
    // surveille — l'invariant vérifié ne serait plus celui qui s'exécute.
    const corps = corpsDeLaRegle();
    expect(corps).toContain("daysFromNow(FENETRE_CONTACT_SUR_PLACE_JOURS, now)");
  });
});

describe("le code existe au catalogue, au bon guichet", () => {
  const entree = ALERTE_CATALOGUE["session_contact_sur_place_absent"];

  it("il est déclaré", () => {
    expect(entree).toBeDefined();
  });

  it("guichet administratif — c'est lui qui vend la session et appelle le client", () => {
    expect(entree?.guichet).toBe("administratif");
  });

  it("résolution automatique : saisir le contact l'éteint", () => {
    expect(entree?.resolutionAuto).toBe(true);
  });

  it("elle figure dans le registre des règles évaluées", () => {
    // Une règle écrite mais non enregistrée ne lève jamais, et rien ne rougit.
    expect(SOURCE).toContain(
      '{ nom: "session_contact_sur_place_absent", fn: regleContactSurPlaceAbsent },',
    );
  });
});

describe("le périmètre est celui qu'on a arbitré", () => {
  it("sur site et distanciel, jamais « nos locaux »", () => {
    // « Nos locaux » : l'hôte, c'est l'organisme lui-même — crier là-dessus
    // ferait désarmer l'alerte sur les cas où elle compte.
    const corps = corpsDeLaRegle();
    expect(corps).toContain('lieuType: { in: ["sur_site", "distanciel"] }');
    expect(corps).not.toContain("nos_locaux");
  });

  it("🔴 elle ne regarde que des sessions ENCORE À VENIR", () => {
    // Une session commencée n'a plus rien à saisir : le formateur est arrivé,
    // ou pas. Ce qui suit relève du registre des incidents.
    expect(corpsDeLaRegle()).toContain("dateDebut: { gt: now,");
  });

  it("le message NOMME ce qui manque, il ne dit pas « incomplet »", () => {
    const corps = corpsDeLaRegle();
    expect(corps).toContain("aucun contact sur place (ni nom ni téléphone)");
    expect(corps).toContain("aucune consigne d'accès");
  });

  it("🔴 le manque lui-même se dit autrement en visio", () => {
    // Le champ s'appelle `contactSurPlaceNom` en base ; « sur place » n'est pas
    // pour autant le mot de l'écran. Une visio n'a pas de « place », et l'agent
    // qui lit « aucun contact sur place » sur une session distancielle ne sait
    // pas ce qu'il doit demander au client. Vu à l'écran le 2026-09-04, sur une
    // recette qui était VERTE : la conséquence avait été corrigée par modalité,
    // le manque non.
    const corps = corpsDeLaRegle();
    expect(corps).toContain("aucun contact à joindre (ni nom ni téléphone)");
    // Et il se DÉRIVE : deux libellés posés côte à côte sans condition
    // laisseraient le mauvais partir sur la mauvaise modalité.
    expect(corps).toMatch(/contactManquant\s*\?\s*surSite/);
  });

  it("🔴 il ne parle de la PORTE que là où il y en a une", () => {
    // Trouvé à l'écran, pas ici : la première version servait une seule phrase
    // aux deux modalités, et l'alerte d'une session en visio annonçait qu'elle
    // serait « muette sur la manière d'entrer ». Le lecteur ne sait alors plus
    // quoi demander au client. La conséquence doit se DÉRIVER de `surSite`.
    const corps = corpsDeLaRegle();
    expect(corps).toContain("const consequence = surSite");
    expect(corps).toContain("aucune manière d'entrer");
    expect(corps).toContain("personne à joindre si le lien ne s'ouvre pas");
  });

  it("🔴 il change de sens une fois la convocation partie", () => {
    // « Renseignez avant l'envoi » après l'envoi se fait ignorer : le geste
    // n'est plus le même, il faut rappeler le formateur.
    const corps = corpsDeLaRegle();
    expect(corps).toContain("convocationJ7EnvoyeeAt !== null");
    expect(corps).toContain("DÉJÀ PARTIE");
  });
});

/**
 * Les libelles que la regle peut donner pour titre.
 *
 * On les lit dans la source pour la meme raison que la fenetre : importer
 * `evaluateur.ts` entraine tout son graphe. L'extraction est STRICTE - si la
 * derivation disparait, `titresDeLaRegle` echoue au lieu de rendre une liste
 * vide, qui ferait passer les boucles ci-dessous sans rien verifier.
 */
function titresDeLaRegle(): string[] {
  const corps = corpsDeLaRegle();
  const debut = corps.indexOf("const titre = surSite");
  expect(debut, "le titre ne se derive plus de la modalite").toBeGreaterThan(-1);
  const bloc = corps.slice(debut, corps.indexOf(";", debut));
  const titres = Array.from(bloc.matchAll(/"([^"]+)"/g)).map((m) => m[1] as string);
  expect(titres.length, "aucun libelle de titre lu dans la regle").toBeGreaterThan(0);
  return titres;
}

describe("🔴 le TITRE aussi se derive de la modalite", () => {
  /**
   * Trouve a l'ecran le 2026-09-04, APRES que le message eut ete corrige - et
   * pendant que la recette etait VERTE. Le message distinguait les modalites ;
   * le titre, lui, etait reste commun. Une session en visio s'affichait donc
   * "Session sans contact sur place ni consignes d'acces" en gras, au-dessus
   * d'un paragraphe qui ne parle jamais de consignes.
   *
   * Le controle de recette qui aurait du l'attraper cherchait "consigne
   * d'acces" au SINGULIER dans la carte ; le titre porte "consignes" au
   * pluriel. Il est passe au vert sur le texte meme qu'il condamnait. D'ou ces
   * gardes, qui portent sur les libelles eux-memes et non sur une occurrence.
   */
  it("il n'est plus un litteral commun aux deux modalites", () => {
    expect(corpsDeLaRegle()).toContain("const titre = surSite");
  });

  it("🔴 le titre d'une session a distance ne promet aucune porte", () => {
    const distanciel = titresDeLaRegle().filter((t) => /distance|visio|lien/i.test(t));
    expect(distanciel.length, "aucun titre ne nomme la modalite a distance").toBeGreaterThan(0);
    for (const t of distanciel) {
      // "acces", "consigne", "sur place" : trois mots qui supposent un lieu ou
      // se presenter. Il n'y en a pas dans une visioconference.
      expect(t, `<< ${t} >> promet une porte a une visio`).not.toMatch(
        /consigne|acc[eè]s|sur place/i,
      );
    }
  });

  it("les titres << sur site >> disent lequel des deux manque", () => {
    // La regle leve des qu'UN des deux manque. Un titre unique annoncerait les
    // deux, et enverrait l'agent redemander au client un contact deja saisi.
    // Trois cas, donc trois libelles : les deux, le contact seul, les consignes
    // seules.
    const surSite = titresDeLaRegle().filter((t) => /sur site/i.test(t));
    expect(surSite.length, `libelles lus : ${surSite.join(" | ")}`).toBeGreaterThanOrEqual(3);
    expect(new Set(surSite).size, "deux cas partagent le meme libelle").toBe(surSite.length);
  });
});
