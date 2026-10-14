// @vitest-environment node

/**
 * Étape 3 du C4 — contrat-cadre v4 (art. 18.2, décision (c) de Will) et lettre de
 * mission v3 (paiement, décision (d)). Nouvelles versions : les textes v3 et v2 restent
 * rendables à l'identique (copies figées dans `archives/`), jamais retouchés.
 */

import React from "react";
import { describe, expect, it } from "vitest";

import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { assemblerLettreV2 } from "@/server/qualiopi/formateurs-independants/lettre-mission-v2-donnees";

import { ContratCadrePdf as ContratCadreV3 } from "../archives/contrat-cadre.v3";
import { LettreMissionV2Pdf as LettreV2 } from "../archives/lettre-mission-v2.v2";
import { ContratCadrePdf, type ContratCadreData } from "../contrat-cadre";
import { LettreMissionV2Pdf } from "../lettre-mission-v2";
import { composantVersionArretee, derniereVersionArretee } from "../versions-arretees";

const IDENTITE = {
  raisonSociale: "Axion-IA SAS",
  nda: "84000000000",
  qualiopi: "",
  siret: "12345678900011",
  adresseSiege: "1 rue de la Formation, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Formation, 42000 Saint-Étienne",
  email: "contact@exemple.fr",
  telephone: "",
  site: "https://www.exemple.fr",
  representantLegalNom: "Camille Martin",
  representantLegalQualite: "Présidente",
  capitalSocial: "1 000 €",
  rcsVille: "Saint-Étienne",
  siren: "123456789",
} as OrganismeIdentite;

const INDEPENDANT: ContratCadreData = {
  numero: "AXI-DOC-2026-900",
  nature: "independant",
  cocontractant: {
    prenomNom: "Alex Durand",
    siret: "98765432100017",
    adresse: "5 chemin des Tilleuls, 69001 Lyon",
    numeroDeclaration: null,
    tvaIntracom: null,
    email: "alex@exemple.fr",
  },
  mandatAutofacturation: true,
  axion: { regionDeclaration: "Auvergne-Rhône-Alpes", adresseFormateurs: "formateurs@exemple.fr" },
  dateContrat: "14/10/2026",
};

const net = (t: string) =>
  t
    .replace(/ ([,.)])/g, "$1")
    .replace(/\( /g, "(")
    .replace(/\s+/g, " ");
const contrat = (C: typeof ContratCadrePdf) =>
  net(collectPdfTextNormalized(React.createElement(C, { data: INDEPENDANT, identite: IDENTITE })));

const ARTICLE_18_2 =
  "Vous nous transmettez une attestation de vigilance URSSAF dès que le cumul de vos honoraires avec nous approche 5 000 € hors taxes, puis tous les six mois. À partir de ce seuil, le règlement de vos honoraires attend cette attestation : le délai de paiement est suspendu, et non dépassé, tant qu'elle manque (article 16.7).";
// Décision du 14/10/2026 (« comme les apporteurs ») : facture quand tout est complet,
// virement au plus tard 30 jours après SA date.
const ARTICLE_16_1 =
  "16.1 Date limite. Axion établit votre autofacture dès que tout est complet : vos feuilles de présence contresignées (article 12) et, pour le dernier mois de la mission, le bilan de fin de formation remis, quand il vous revient (article 20.2). Axion vous paie par virement au plus tard 30 jours après la date de cette autofacture. Si une pièce arrive en retard, l'autofacture est simplement établie plus tard, et le virement suit toujours dans les 30 jours de sa date.";
const PAIEMENT_LETTRE =
  "Le virement part au plus tard 30 jours après la date de la facture, que le client ait réglé ou non. Si une pièce arrive en retard, la facture est simplement établie plus tard, et le virement suit dans les 30 jours.";
const FACTURE_LETTRE =
  "Axion établit la facture à votre nom (autofacture) dès que tout est complet : les feuilles de présence signées et, pour le dernier mois de la mission, le bilan de fin de formation remis s'il vous revient.";

describe("registre : v4 et v3 arrêtées, les anciennes figées", () => {
  it("le contrat-cadre émis est la v4 ; la v3 se rend avec sa copie figée", () => {
    expect(derniereVersionArretee("contrat_sous_traitance")).toBe(4);
    expect(composantVersionArretee("contrat_sous_traitance", 4)).toBe(ContratCadrePdf);
    expect(composantVersionArretee("contrat_sous_traitance", 3)).toBe(ContratCadreV3);
  });

  it("la lettre arrêtée la plus récente est la v3 ; la v2 se rend avec sa copie figée", () => {
    expect(derniereVersionArretee("lettre_mission")).toBe(3);
    expect(composantVersionArretee("lettre_mission", 3)).toBe(LettreMissionV2Pdf);
    expect(composantVersionArretee("lettre_mission", 2)).toBe(LettreV2);
  });
});

describe("contrat-cadre v4 — le texte de Will, sans contradiction", () => {
  const v4 = contrat(ContratCadrePdf);
  const v3 = contrat(ContratCadreV3 as typeof ContratCadrePdf);

  it("porte sa version", () => {
    expect(v4).toContain("Version 4 du 14 octobre 2026");
    expect(v3).toContain("Version 3 du 10 octobre 2026");
  });

  it("art. 18.2 : le texte arrêté, et la demande avant une mission qui ferait dépasser le seuil", () => {
    expect(v4).toContain(ARTICLE_18_2);
    expect(v4).toMatch(/demandée avant une mission qui ferait dépasser ce seuil/);
    // L'ancienne exigence « avant la contresignature » ne survit pas.
    expect(v4).not.toMatch(/avant la contresignature d.Axion, une attestation/);
  });

  it("art. 16 : 30 jours après la date de l'autofacture, établie quand tout est complet ; jamais « ne recule jamais »", () => {
    expect(v4).toContain(ARTICLE_16_1);
    expect(v4).not.toMatch(/le délai court à partir de leur remise/);
    expect(v4).not.toMatch(/Elle ne recule jamais/);
    // 16.7 : suspendu, et non dépassé, faute d'attestation à jour.
    expect(v4).toMatch(
      /le délai de paiement est suspendu, et non dépassé\. L.autofacture est émise normalement/,
    );
    // 13.2 : l'autofacture attend aussi le bilan du dernier mois.
    expect(v4).toMatch(/Axion émet l.autofacture dès que tout est complet pour la mission/);
    // 16.5 : la facture rectifiée garde la date limite de celle qu'elle remplace (le code).
    expect(v4).toMatch(/date limite de l.autofacture qu.elle remplace/);
    // 20.2 : seul le formateur de la dernière journée remet le bilan (#1530).
    expect(v4).toMatch(/si vous animez la dernière journée, faites ensuite/);
  });

  it("annexe 2 : l'attestation suit le seuil", () => {
    expect(v4).toMatch(/approchent 5 000 € HT/);
    expect(v4).not.toMatch(/dans le dossier, avant la contresignature/);
  });

  it("le texte v3 figé est intact (le signataire v3 garde son texte)", () => {
    expect(v3).toMatch(/Elle ne recule jamais/);
    expect(v3).not.toContain(ARTICLE_18_2);
  });

  it("ni « Grenoble », ni « aucun gain garanti »", () => {
    expect(v4).not.toMatch(/Grenoble|aucun gain garanti/i);
  });
});

describe("lettre de mission v3 — le paiement", () => {
  const a = assemblerLettreV2({
    numero: "LM-TEST",
    trainerId: "t-1",
    trainer: {
      prenom: "Marie",
      nom: "Dupont",
      statut: "sous_traitant",
      siret: "12345678900012",
      nda: "84380000000",
      regimeTvaHonoraires: "franchise_293b",
      mandatAutofacturationSigneAt: new Date("2026-10-01T00:00:00Z"),
      mandatAutofacturationRevoqueAt: null,
      organismeSousTraitantId: null,
    },
    contratCadre: { version: 4, signeLe: new Date("2026-10-02T10:00:00Z") },
    mission: {
      statut: "acceptee",
      reponduAt: new Date("2026-10-12T07:41:00Z"),
      accordHorsOutilAt: null,
      tarifHtCents: 35_000,
      forfaitDeplacementParJourHtCents: null,
      regimeTvaFige: "franchise_293b",
    },
    session: {
      titre: "IA pour managers",
      numero: "AXI-SESS-2026-042",
      client: "Client SAS",
      stagiaires: 8,
      financeurEnAttente: false,
      lieu: "à distance",
      distanciel: true,
      affectes: [{ trainerId: "t-1" }],
      jours: [
        {
          date: new Date("2026-11-04T00:00:00Z"),
          heureDebut: "09:00",
          heureFin: "17:00",
          trainerId: null,
        },
      ],
    },
    dateMission: new Date("2026-10-14T08:00:00Z"),
  });
  if (!a.ok) throw new Error(a.motif);
  const lettre = (C: typeof LettreMissionV2Pdf) =>
    net(collectPdfTextNormalized(React.createElement(C, { data: a.data, identite: IDENTITE })));

  it("v3 : la règle de paiement, mot pour mot", () => {
    const t = lettre(LettreMissionV2Pdf);
    expect(t).toContain(FACTURE_LETTRE);
    expect(t).toContain(PAIEMENT_LETTRE);
    expect(t).toMatch(/le délai de paiement est suspendu tant qu.elle manque/);
    expect(t).not.toMatch(/délai court à partir de leur remise/);
  });

  it("v3 : plus aucune date de paiement fixe (la date de la facture n'est pas connue à l'émission)", () => {
    expect(lettre(LettreMissionV2Pdf)).not.toMatch(/au plus tard le \d\d\/\d\d\/\d{4}/);
  });

  it("v2 figée : intacte", () => {
    expect(lettre(LettreV2 as typeof LettreMissionV2Pdf)).not.toContain(PAIEMENT_LETTRE);
  });
});
