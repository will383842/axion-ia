/**
 * CLIQUET — la feuille d'émargement ne certifie pas ce qu'elle vient de nier.
 *
 * ## Le défaut (2026-08-25, cahier D9-1)
 *
 * 🔴 La feuille imprimait, **inconditionnellement** :
 *
 * > « Je certifie l'exactitude des présences enregistrées sur ce document. »
 *
 * …y compris sur une feuille où elle venait d'écrire, **dix lignes plus haut** :
 *
 * > « Non contresignée (Matin) — feuille incomplète. »
 *
 * La pièce se contredit sur la même page, devant le certificateur. Elle
 * **déclare l'exactitude d'un relevé qu'elle qualifie elle-même d'incomplet.**
 *
 * 🔑 Et la donnée nécessaire était **déjà là** : `contresignaturesManquantes`
 * est une propriété du gabarit, alimentée par son appelant
 * (`emargement-tirage.ts`). La phrase de certification ne la consultait
 * simplement pas.
 *
 * ## Ce que ce fichier garde, et pourquoi il existe
 *
 * ⚠️ `emargement.tsx` était **le seul des 30 gabarits sans aucune assertion de
 * contenu.** Sa seule garde (`sessions-docs.spec.tsx`) n'assertait que
 * `buffer.slice(0, 4) === "%PDF"` — c'est-à-dire que le fichier est un PDF,
 * pas ce qu'il dit. Supprimer n'importe quelle phrase de cette pièce probante
 * n'aurait fait rougir personne.
 *
 * On lit le texte via `collectPdfText`, qui parcourt l'arbre React **avant**
 * rendu — pas le binaire : les flux d'un PDF sont compressés, et l'extraction
 * binaire coûte cher pour rien.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import {
  EmargementPdf,
  type EmargementData,
  type EmargementJournee,
} from "@/server/qualiopi/documents/templates/emargement";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

const IDENTITE = {
  raisonSociale: "Axion-IA SAS",
  nda: "11380490538",
  siret: "12345678900010",
  adresse: "1 rue de la Formation, 75001 Paris",
  email: "contact@axion-ia.com",
  telephone: "0100000000",
} as unknown as OrganismeIdentite;

function journee(over: Partial<EmargementJournee> = {}): EmargementJournee {
  return {
    dateLisible: "mercredi 10 juin 2026",
    horaires: "09:00–17:00",
    formateurNom: "Williams Jullin",
    modules: ["Module 1"],
    entetes: ["Matin", "Après-midi"],
    lignes: [
      { nom: "Alice Dupont", entreprise: "ACME", cases: ["09:12", "14:03"], ancrage: "abc123" },
    ],
    contresignatures: ["Matin — signé à 12:35", "Après-midi — signé à 17:04"],
    contresignaturesManquantes: [],
    ...over,
  };
}

function data(journees: EmargementJournee[]): EmargementData {
  return {
    numero: "AXI-DOC-2026-001",
    intituleFormation: "IA pour bien commencer",
    numeroSession: "AXI-SESS-2026-001",
    lieu: "Paris",
    nda: "11380490538",
    journees,
    totalSignatures: 2,
  };
}

const CERTIFICATION = "je certifie l'exactitude des présences";

describe("la feuille d'émargement ne certifie pas ce qu'elle nie", () => {
  it("le contre-témoin : une feuille COMPLÈTE certifie bien", () => {
    // 🔑 Sans ce cas, on « corrigerait » le défaut en retirant purement la
    // phrase — et le test suivant passerait au vert sur une pièce qui aurait
    // perdu sa certification. La feuille complète DOIT certifier : c'est ce qui
    // lui donne sa valeur devant le certificateur.
    const txt = collectPdfTextNormalized(
      React.createElement(EmargementPdf, { data: data([journee()]), identite: IDENTITE }),
    ).toLowerCase();

    expect(
      txt,
      "une feuille intégralement contresignée ne certifie plus rien : la pièce a " +
        "perdu la phrase qui lui donne sa valeur probante.",
    ).toContain(CERTIFICATION);
  });

  it("🔴 une feuille INCOMPLÈTE ne certifie pas l'exactitude", () => {
    // Le cœur du défaut. La journée déclare une demi-journée non contresignée,
    // et la pièce affirmait quand même l'exactitude de l'ensemble.
    const txt = collectPdfTextNormalized(
      React.createElement(EmargementPdf, {
        data: data([journee({ contresignaturesManquantes: ["Matin"] })]),
        identite: IDENTITE,
      }),
    ).toLowerCase();

    expect(
      txt,
      "la feuille écrit « feuille incomplète » ET « je certifie l'exactitude des " +
        "présences » sur la même page. Elle se contredit devant le certificateur : " +
        "elle déclare exact un relevé qu'elle vient elle-même de qualifier " +
        "d'incomplet. La donnée est pourtant déjà en propriété du gabarit — la " +
        "phrase ne la consultait pas.",
    ).not.toContain(CERTIFICATION);
  });

  it("🔴 et elle DIT pourquoi elle ne certifie pas", () => {
    // Retirer la phrase sans rien mettre à la place laisserait un blanc : le
    // lecteur ne saurait pas si la mention manque ou si elle a été omise. Une
    // pièce probante doit dire ce qu'elle ne peut pas affirmer.
    const txt = collectPdfTextNormalized(
      React.createElement(EmargementPdf, {
        data: data([journee({ contresignaturesManquantes: ["Matin"] })]),
        identite: IDENTITE,
      }),
    ).toLowerCase();

    expect(
      txt,
      "la certification disparaît sans explication : un blanc à cet endroit se " +
        "confond avec un défaut d'impression. La pièce doit nommer la réserve.",
    ).toMatch(/sous réserve|non contresign/);
  });

  it("une seule demi-journée manquante suffit — pas besoin que tout manque", () => {
    // ⚠️ Le commentaire du gabarit le dit déjà : « une journée à moitié
    // contresignée ne doit pas passer pour complète ». On le rend exécutoire.
    const txt = collectPdfTextNormalized(
      React.createElement(EmargementPdf, {
        data: data([
          journee(),
          journee({
            dateLisible: "jeudi 11 juin 2026",
            contresignaturesManquantes: ["Après-midi"],
          }),
        ]),
        identite: IDENTITE,
      }),
    ).toLowerCase();

    expect(
      txt,
      "une seule demi-journée non contresignée sur deux journées, et la feuille " +
        "certifie encore l'ensemble.",
    ).not.toContain(CERTIFICATION);
  });

  it("le contre-témoin de l'extracteur : il lit bien le texte du gabarit", () => {
    // 🔑 Si `collectPdfTextNormalized` cessait de descendre dans l'arbre, tous
    // les tests ci-dessus passeraient au vert sur une chaîne vide — la panne
    // que ce dépôt a payée cinq fois.
    const txt = collectPdfTextNormalized(
      React.createElement(EmargementPdf, { data: data([journee()]), identite: IDENTITE }),
    );

    expect(
      txt.length,
      "l'extracteur ne rend plus de texte : les assertions `not.toContain` " +
        "passeraient toutes, en n'examinant rien.",
    ).toBeGreaterThan(200);
    expect(txt, "l'extracteur ne voit plus le contenu métier de la feuille").toContain(
      "Alice Dupont",
    );
  });
});
