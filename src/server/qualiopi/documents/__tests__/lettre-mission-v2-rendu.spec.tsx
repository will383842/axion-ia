/**
 * Lot S5 — la lettre v2 se REND (PDF réel), signée ou non, avec des données
 * assemblées par le module pur — et ne contient aucun mot interdit.
 */

import React from "react";
import { describe, expect, it } from "vitest";

import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { LettreMissionV2Pdf } from "@/server/qualiopi/documents/templates/lettre-mission-v2";
import { assemblerLettreV2 } from "@/server/qualiopi/formateurs-independants/lettre-mission-v2-donnees";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const identite = {
  raisonSociale: "Axion-IA SAS",
  siret: "00000000000000",
  nda: "84000000000",
  adresseSiege: "1 rue Exemple, Lyon",
  email: "contact@exemple.fr",
  rcsVille: "Lyon",
} as unknown as OrganismeIdentite;

describe("lettre de mission v2 — rendu", () => {
  it("rend un PDF", { timeout: 30_000 }, async () => {
    const a = assemblerLettreV2({
      numero: "LM-TEST",
      trainerId: "t-1",
      trainer: {
        prenom: "Marie",
        nom: "Dupont",
        statut: "sous_traitant",
        siret: "12345678900012",
        nda: "84380000000",
        regimeTvaHonoraires: "assujetti_20",
        mandatAutofacturationSigneAt: null,
        mandatAutofacturationRevoqueAt: null,
        organismeSousTraitantId: null,
      },
      contratCadre: { version: 3, signeLe: new Date("2026-10-02T10:00:00Z") },
      mission: {
        statut: "accord_hors_outil",
        reponduAt: null,
        accordHorsOutilAt: new Date("2026-10-12T07:41:00Z"),
        tarifHtCents: 35_000,
        forfaitDeplacementParJourHtCents: 8_000,
        regimeTvaFige: "assujetti_20",
      },
      session: {
        titre: "IA pour managers",
        numero: "AXI-SESS-2026-042",
        client: "Client SAS",
        stagiaires: 8,
        financeurEnAttente: true,
        lieu: "12 rue Exemple, Lyon",
        distanciel: false,
        affectes: [{ trainerId: "t-1" }],
        jours: [
          {
            date: new Date("2026-11-04T00:00:00Z"),
            heureDebut: "09:00",
            heureFin: "17:00",
            trainerId: null,
          },
          {
            date: new Date("2026-12-10T00:00:00Z"),
            heureDebut: "14:00",
            heureFin: "17:30",
            trainerId: null,
          },
        ],
      },
      dateMission: new Date("2026-10-12T08:00:00Z"),
    });
    if (!a.ok) throw new Error(a.motif);
    const r = await renderPdfToBuffer(
      React.createElement(LettreMissionV2Pdf, { data: a.data, identite }),
    );
    expect(r.buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("aucun mot interdit dans le texte du gabarit", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/qualiopi/documents/templates/lettre-mission-v2.tsx"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const mot of [
      /\bposte\b/i,
      /entretien/i,
      /recrutement/i,
      /salaire/i,
      /rémunération/i,
      /bienvenue/i,
      /vous devez/i,
      /obligatoire/i,
      /agent commercial/i,
      /Grenoble/,
      /Qualiopi valide/,
      /mandataire/i,
    ]) {
      expect(src).not.toMatch(mot);
    }
  });
});
