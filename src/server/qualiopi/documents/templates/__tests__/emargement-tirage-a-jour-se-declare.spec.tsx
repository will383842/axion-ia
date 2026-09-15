/**
 * 🔴 X-documents-pdf-01 (audit initial 2026-09-14, relecture de la PR 1089).
 *
 * Le tirage À JOUR d'une feuille d'émargement emprunte le numéro de la pièce du
 * registre. Posé à côté de la pièce scellée dans un dossier d'audit, il en était
 * indiscernable : même numéro, même titre, et rien SUR LE PDF ne disait « tiré
 * le … ». La date de tirage ne vivait que dans `index.txt` et dans le suffixe
 * `-a-jour` du nom de fichier — deux choses qui disparaissent dès qu'on extrait
 * ou qu'on imprime la pièce. Lue seule, elle ressemblait à une feuille émise le
 * 31/07 portant des signatures du 01/08 : l'apparence exacte d'une pièce
 * antidatée.
 *
 * Ce fichier garde que la mention, quand elle est fournie, est imprimée sur la
 * pièce — et qu'elle n'apparaît pas sur la pièce officielle, qui n'en porte pas.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import {
  EmargementPdf,
  type EmargementData,
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

const MENTION =
  "Réimpression à jour du 14/09/2026 à 15:32 (heure de Paris) — pièce d'origine : AXI-DOC-2026-004, émise le 31/07/2026";

function data(over: Partial<EmargementData> = {}): EmargementData {
  return {
    numero: "AXI-DOC-2026-004",
    intituleFormation: "IA pour bien commencer",
    numeroSession: "AXI-SESS-2026-003",
    lieu: "Paris",
    nda: "11380490538",
    journees: [
      {
        dateLisible: "vendredi 1 août 2026",
        horaires: "09:00–17:00",
        formateurNom: "Williams Jullin",
        modules: [],
        entetes: ["Matin"],
        lignes: [{ nom: "Alice Dupont", entreprise: "ACME", cases: ["Signé 09:12"], ancrage: "1" }],
        contresignatures: ["Matin — Williams Jullin, signé 12:30"],
        contresignaturesManquantes: [],
      },
    ],
    totalSignatures: 1,
    ...over,
  };
}

function texte(d: EmargementData): string {
  return collectPdfTextNormalized(
    React.createElement(EmargementPdf, { data: d, identite: IDENTITE }),
  );
}

describe("🔴 le tirage à jour se DÉCLARE sur la pièce elle-même", () => {
  it("imprime la mention de réimpression, datée, avec la pièce d'origine", () => {
    const t = texte(data({ reimpression: MENTION }));
    expect(
      t,
      "le tirage à jour ne dit pas, sur le PDF, qu'il est une réimpression ni quand il a été tiré : " +
        "posé à côté de la pièce scellée au même numéro, il passe pour l'original ou pour une pièce antidatée.",
    ).toContain(MENTION);
    expect(t).toContain("n'est pas la pièce d'origine");
  });

  it("n'imprime rien de tel sur la pièce officielle du registre", () => {
    const t = texte(data());
    expect(t).not.toContain("Réimpression");
    expect(t).not.toContain("n'est pas la pièce d'origine");
  });
});
