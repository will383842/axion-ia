/**
 * CLIQUET — la convocation distanciel et le livret d'accueil portent le
 * dispositif d'assistance à distance.
 *
 * ## Pourquoi
 *
 * L'article D.6313-3-1 du Code du travail impose, pour une action suivie à
 * distance, un dispositif écrit d'assistance technique et pédagogique. Axion IA
 * garde le distanciel (décision de Will du 2026-09-19) ; le dispositif retenu
 * le même jour tient en trois volets :
 *
 *  - PENDANT la session : le formateur, dans la conversation de la visio ;
 *  - HORS session : le référent, Williams Jullin, Président, à
 *    contact@axion-ia.com, sous 1 jour ouvré, du lundi au vendredi, 9 h - 18 h ;
 *  - si la visio TOMBE : nouveau lien par e-mail et 15 minutes d'attente ;
 *    au-delà de 30 minutes, séquence reprogrammée et hors des heures suivies ;
 *    incident noté au registre des incidents.
 *
 * Avant, le livret disait seulement « contactez immédiatement votre référent
 * pédagogique » — ni canal, ni délai, ni secours — et la convocation rien.
 *
 * ## Ce que ce fichier garde
 *
 * Le texte RENDU (arbre react-pdf, via `collectPdfText`), pas le source : les
 * phrases viennent d'une constante (`legal/assistance-distance.ts`), et une
 * section retirée, une condition inversée ou un délai modifié dans la
 * constante doivent tous faire rougir. Les attentes sont donc écrites ICI en
 * toutes lettres, et non relues dans la constante — sinon la garde
 * approuverait n'importe quel texte.
 *
 * Et l'inverse : la convocation PRÉSENTIEL ne porte pas le dispositif (il ne
 * s'y applique pas).
 *
 * Il tient aussi « même exigence que la convocation », promis par
 * `src/content/formations/materiel.ts` : la section « Équipement requis
 * (distanciel) » RENDUE est confrontée à `MATERIEL_DISTANCIEL`, que publient
 * les fiches. Ce test vit ici, et non dans la garde du matériel
 * (`src/content/__tests__/le-materiel-annonce-est-le-meme-partout.spec.ts`),
 * parce que `qualiopi:isolation-check` interdit à `src/content` d'importer le
 * domaine Qualiopi ; l'inverse est permis.
 */

import { describe, expect, it } from "vitest";
import React from "react";

import { MATERIEL_DISTANCIEL } from "@/content/formations/materiel";

import { collectPdfTextNormalized } from "../../collect-pdf-text";
import type { OrganismeIdentite } from "../../organisme";
import { ConvocationPdf, type ConvocationData } from "../convocation";
import { LivretAccueilPdf, type LivretAccueilData } from "../livret-accueil";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://axion-ia.com",
  referentHandicapNom: "Williams Jullin",
};

function convocation(modalite: ConvocationData["modalite"]): string {
  const data: ConvocationData = {
    numero: "CONV-TEST",
    intituleFormation: "IA pour bien commencer",
    dateDebut: "1 octobre 2026",
    dateFin: "1 octobre 2026",
    horaires: "09h00–17h00",
    dureeHeures: 7,
    modalite,
    lieu: "Salle A, 1 rue de la Paix, 75001 Paris",
    nomFormateur: "Sophie Martin",
    contactEmail: "contact@axion-ia.com",
    nomStagiaire: "Jean Dupont",
  };
  return collectPdfTextNormalized(
    React.createElement(ConvocationPdf, { data, identite: IDENTITE }),
  );
}

function livret(): string {
  const data: LivretAccueilData = {
    numero: "LA-TEST",
    contactPedagogique: { nomPrenom: "Williams Jullin", email: "contact@axion-ia.com" },
    dateVersion: "19/09/2026",
  };
  return collectPdfTextNormalized(
    React.createElement(LivretAccueilPdf, { data, identite: IDENTITE }),
  );
}

/**
 * Le dispositif, volet par volet. Chaque entrée : ce qu'on cherche, et le
 * nom du volet dans le message d'échec.
 */
const DISPOSITIF: ReadonlyArray<readonly [string, RegExp]> = [
  [
    "pendant la session : le formateur, dans la visio",
    /Pendant la session : le formateur répond dans la conversation de la visioconférence, aux questions techniques comme pédagogiques\./,
  ],
  [
    "hors session : le référent nommé et sa qualité",
    /Hors session : le référent, Williams Jullin, Président, répond/,
  ],
  ["le canal : contact@axion-ia.com", /répond à contact@axion-ia\.com/],
  ["le délai : 1 jour ouvré", /sous 1 jour ouvré, du lundi au vendredi, de 9 h à 18 h\./],
  ["la trace : la boîte mail", /La demande et la réponse restent dans la boîte mail/],
  [
    "la coupure : nouveau lien et 15 minutes",
    /Si la visioconférence tombe, le formateur renvoie aussitôt un nouveau lien par e-mail et attend les stagiaires 15 minutes\./,
  ],
  [
    "la coupure longue : au-delà de 30 minutes",
    /Si la coupure dépasse 30 minutes, la séquence perdue est reprogrammée et ne compte pas dans les heures suivies\./,
  ],
  ["l'incident : au registre", /L'incident est noté au registre des incidents/],
];

describe("le dispositif d'assistance à distance est imprimé", () => {
  describe.each(["distanciel", "mixte"] as const)("convocation %s", (modalite) => {
    const texte = convocation(modalite);

    it("porte la section « Assistance à distance »", () => {
      expect(texte).toContain("Assistance à distance");
    });

    it.each(DISPOSITIF)("dit %s", (_volet, motif) => {
      expect(texte).toMatch(motif);
    });

    it("dit l'outil : Google Meet, dans le navigateur, rien à installer", () => {
      expect(texte).toContain(
        "Google Meet, depuis le navigateur de l'ordinateur (rien à installer), testé avant la session : caméra, micro, son.",
      );
      expect(texte).not.toMatch(/installée et testée/);
    });

    it("exige ce que les fiches publiques annoncent (MATERIEL_DISTANCIEL)", () => {
      // `materiel.ts` affirme « même exigence que la convocation » : ce test
      // confronte la section « Équipement requis » RENDUE à la constante que
      // les fiches publient, exigence par exigence.
      const debut = texte.indexOf("Équipement requis (distanciel)");
      expect(debut, "plus de section « Équipement requis (distanciel) »").toBeGreaterThan(-1);
      const fin = texte.indexOf("Assistance à distance", debut);
      const bloc = texte.slice(debut, fin === -1 ? undefined : fin);
      const exigences: ReadonlyArray<readonly [string, string]> = [
        ["Un ordinateur avec caméra et micro", "un ordinateur avec caméra et micro"],
        ["Une connexion internet stable", "une connexion internet stable"],
        ["Google Meet, depuis le navigateur", "Google Meet depuis le navigateur"],
        ["rien à installer", "rien à installer"],
        ["testé avant la session", "testé avant la session"],
      ];
      for (const [surLaConvocation, surLesFiches] of exigences) {
        expect(bloc, surLaConvocation).toContain(surLaConvocation);
        expect(MATERIEL_DISTANCIEL, surLesFiches).toContain(surLesFiches);
      }
      // Pas de `\b` après « é » : en JavaScript sans drapeau `u`, la frontière
      // de mot est ASCII et ne tomberait jamais entre « é » et une espace.
      expect(bloc).not.toMatch(/install(?:ée|é|ed)/);
      expect(MATERIEL_DISTANCIEL).not.toMatch(/install(?:ée|é|ed)/);
    });
  });

  it("la convocation présentiel ne porte pas le dispositif", () => {
    const texte = convocation("présentiel");
    expect(texte).not.toContain("Assistance à distance");
    expect(texte).not.toMatch(/Si la visioconférence tombe/);
  });

  describe("livret d'accueil, rubrique « En distanciel »", () => {
    const texte = livret();
    const debut = texte.indexOf("En distanciel");
    const rubrique = texte.slice(debut, texte.indexOf("4. Évaluation et attestation"));

    it("la rubrique existe et précède la section 4", () => {
      expect(debut).toBeGreaterThan(-1);
      expect(rubrique.length).toBeGreaterThan(0);
    });

    it.each(DISPOSITIF)("dit %s", (_volet, motif) => {
      expect(rubrique).toMatch(motif);
    });

    it("ne renvoie plus à un « référent pédagogique » sans canal ni délai", () => {
      expect(rubrique).not.toMatch(/contactez immédiatement votre référent pédagogique/);
    });
  });
});
