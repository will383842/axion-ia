/**
 * Chantier OPCO A6 — le kit OPCO coche SEULEMENT les pièces présentes au
 * registre, nomme celles qui manquent, et porte l'encart « Comment déposer ».
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { KitOpcoPdf, type KitOpcoData } from "./kit-opco";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import {
  encartDepot,
  etatPiecesDemande,
} from "@/server/qualiopi/financements/dossier-pret-a-deposer";
import type { OrganismeIdentite } from "../organisme";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: null,
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const D = (iso: string) => new Date(`${iso}T10:00:00.000Z`);

function rendu(extra: Partial<KitOpcoData>): string {
  const data: KitOpcoData = {
    numero: "AXI-DOC-2026-100",
    dateEmission: "04/10/2026",
    identite: IDENTITE,
    nomOpco: "Akto",
    numeroDossier: "—",
    intituleFormation: "IA appliquée",
    dateDebut: "20/11/2026",
    dateFin: "21/11/2026",
    ventilation: [],
    totalPrisEnChargeCents: 0,
    totalResteAChargeCents: 0,
    ...extra,
  };
  return collectPdfTextNormalized(React.createElement(KitOpcoPdf, { data }));
}

const PIECES = etatPiecesDemande([
  {
    id: "c",
    type: "convention",
    numero: "AXI-DOC-1",
    createdAt: D("2026-09-01"),
    annuleeAt: null,
    statutSignature: "signee",
  },
  {
    id: "p",
    type: "programme",
    numero: "AXI-DOC-2",
    createdAt: D("2026-09-01"),
    annuleeAt: null,
    statutSignature: "non_requise",
  },
]);

describe("kit OPCO vérifié", () => {
  it("pièce manquante → non cochée et listée parmi les manquantes", () => {
    const texte = rendu({ pieces: PIECES });
    expect(texte).toContain("Jointe — AXI-DOC-1");
    expect(texte).toContain("Jointe — AXI-DOC-2");
    expect(texte).toContain("Manquante — non émise");
    expect(texte).toMatch(/Pièces manquantes : Devis, Calendrier et organisation de l'action/);
  });

  it("toutes présentes → aucune ligne de pièces manquantes", () => {
    const toutes = PIECES.map((p) => ({ ...p, presente: true, detail: "AXI-X" }));
    expect(rendu({ pieces: toutes })).not.toContain("Pièces manquantes");
  });

  it("encart de dépôt avec un OPCO dont les faits sont null → « non renseigné »", () => {
    const encart = encartDepot({
      opco: "akto",
      dateDebut: D("2026-11-20"),
      regime: "inconnu",
      etatFonds: null,
    });
    const texte = rendu({ pieces: PIECES, encartDepot: encart });
    expect(texte).toContain("Comment déposer chez Akto");
    expect(texte).toContain("non renseigné");
    expect(texte).toContain("à confirmer sur l'accord");
  });

  it("bandeau d'état des fonds imprimé quand il existe", () => {
    const encart = encartDepot({
      opco: "constructys",
      dateDebut: D("2026-11-20"),
      regime: "subrogation_possible",
      etatFonds: "Financement suspendu pour cette branche (relevé du 01/10/2026)",
    });
    const texte = rendu({ pieces: PIECES, encartDepot: encart });
    expect(texte).toContain("Financement suspendu pour cette branche");
    expect(texte).toContain("05/11/2026");
  });

  it("aucun engagement de délai de l'organisme, aucune promesse de prise en charge", () => {
    const encart = encartDepot({
      opco: "constructys",
      dateDebut: D("2026-11-20"),
      regime: "subrogation_possible",
      etatFonds: null,
    });
    const texte = rendu({ pieces: PIECES, encartDepot: encart });
    expect(texte).not.toMatch(/Axion-IA (s'engage|garantit|traite|répond)/);
    expect(texte).not.toContain("100 %");
  });
});
