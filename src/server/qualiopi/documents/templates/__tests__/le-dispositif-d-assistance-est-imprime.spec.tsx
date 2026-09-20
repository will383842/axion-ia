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
 * L'équipement requis n'est plus confronté à `MATERIEL_DISTANCIEL` : la
 * convocation IMPORTE ses éléments depuis `src/content/formations/materiel.ts`
 * (l'isolation permet ce sens-là). Ce qui reste écrit ici en toutes lettres,
 * c'est ce que le stagiaire doit lire : Zoom, le navigateur, rien à
 * installer — si la constante change, ce test le voit.
 *
 * Et la règle « rien à installer » du site (`regle-installation.ts`) s'applique
 * au texte RENDU des deux pièces : « Installez l'application Zoom sur votre
 * ordinateur avant la session » rougit (revue exactitude 5256482948) — le mot
 * « Zoom » reste permis, c'est l'outil ; seule une exigence d'installation est
 * refusée.
 */

import { describe, expect, it } from "vitest";
import React from "react";

import { fautesInstallation } from "@/content/__tests__/regle-installation";
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

    it("dit l'outil : Zoom, dans le navigateur, rien à installer", () => {
      expect(texte).toContain(
        "Zoom, depuis le navigateur (rien à installer), testé avant la session : caméra, micro, son.",
      );
      expect(texte).toContain("Un ordinateur avec caméra et micro fonctionnels.");
      expect(texte).toContain("Une connexion internet stable (≥ 5 Mbit/s recommandé).");
    });

    it("importe l'équipement que publient les fiches (MATERIEL_DISTANCIEL)", () => {
      // Aucun élément retapé : chaque morceau de la constante est imprimé.
      for (const element of MATERIEL_DISTANCIEL.split(", ")) {
        expect(texte.toLowerCase(), element).toContain(element.toLowerCase());
      }
    });
  });

  it.each(["distanciel", "mixte", "présentiel"] as const)(
    "la convocation %s n'exige d'installer rien",
    (modalite) => {
      expect(fautesInstallation([convocation(modalite)])).toEqual([]);
    },
  );

  it("le livret n'exige d'installer rien", () => {
    expect(fautesInstallation([livret()])).toEqual([]);
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
