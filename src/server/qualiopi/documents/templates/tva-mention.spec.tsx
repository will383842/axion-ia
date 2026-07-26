/**
 * Tests de NON-RÉGRESSION — mention de TVA sur les pièces envoyées aux tiers.
 *
 * 🔴 Vérification E2E 2026-07-26. L'exonération 261-4-4° a été retirée du code
 * TROIS fois (pieds de page des documents, puis kits financeurs, puis
 * checklists des kits) et une quatrième famille a été trouvée dans la console
 * admin. La raison structurelle de ces rechutes est ici : aucun test du dépôt
 * ne renseignait `mentionTvaRegime`, donc tous les blocs gardés étaient sautés
 * à chaque exécution — les kits, la convention et le contrat avaient ZÉRO
 * couverture sur la mention TVA. Chaque correctif avait été vérifié par
 * lecture, jamais par un test.
 *
 * Ce fichier pose les deux garde-fous qui manquaient :
 *   1. Rendu — en régime « assujetti » (celui de Will), aucune pièce n'imprime
 *      « 261-4-4 » ; et en régime « exoneration_261 », la mention SORT bien.
 *      Le second cas est indispensable : sans lui, le premier passerait aussi
 *      pour un template qui n'imprimerait jamais rien.
 *   2. Source — aucun fichier de rendu (templates, écrans admin) ne réintroduit
 *      « 261-4-4 » en dur hors du SSOT `legal/`.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { KitOpcoPdf } from "./kit-opco";
import { KitCpfPdf } from "./kit-cpf";
import { KitFranceTravailPdf } from "./kit-france-travail";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import { mentionTva } from "@/server/qualiopi/legal/tva";
import type { OrganismeIdentite } from "../organisme";

// Régime réel de Will : assujetti. `mentionTvaRegime` vaut alors `undefined`.
const IDENTITE_ASSUJETTI: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-TEST-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const MENTION_EXONERATION = mentionTva("exoneration_261");

const IDENTITE_EXONERE: OrganismeIdentite = {
  ...IDENTITE_ASSUJETTI,
  mentionTvaRegime: MENTION_EXONERATION,
};

function kits(identite: OrganismeIdentite): React.ReactElement[] {
  return [
    React.createElement(KitOpcoPdf, {
      data: {
        numero: "AXI-FORM-2026-001",
        dateEmission: "06/06/2026",
        identite,
        nomOpco: "OPCO Atlas",
        numeroDossier: "ATLAS-2026-00123",
        intituleFormation: "IA appliquée aux entreprises",
        dateDebut: "01/06/2026",
        dateFin: "02/06/2026",
        ventilation: [
          {
            nomParticipant: "Jean Martin",
            heuresRealisees: 14,
            baremePrisEnChargeHeureCents: 2000,
            montantPrisEnChargeCents: 28000,
            resteAChargeCents: 0,
          },
        ],
        totalPrisEnChargeCents: 28000,
        totalResteAChargeCents: 0,
      },
    }),
    React.createElement(KitCpfPdf, {
      data: {
        numero: "AXI-FORM-2026-002",
        dateEmission: "06/06/2026",
        identite,
        beneficiaire: { nom: "Rousseau", prenom: "Claire", numeroEdof: "CPF-2026-XYZ" },
        codeCpf: "331 689",
        intituleFormation: "IA appliquée aux entreprises",
        dateDebut: "01/06/2026",
        dateFin: "02/06/2026",
        montantCpfCents: 100000,
        resteAChargeCents: 10000,
        coutTotalCents: 110000,
      },
    }),
    React.createElement(KitFranceTravailPdf, {
      data: {
        numero: "AXI-FORM-2026-003",
        dateEmission: "06/06/2026",
        identite,
        dispositif: "AIF" as const,
        beneficiaire: { nom: "Petit", prenom: "Lucas", identifiantPoleEmploi: "1234567A" },
        intituleFormation: "IA appliquée aux entreprises",
        dateDebut: "01/06/2026",
        dateFin: "02/06/2026",
        numeroDossierFranceTravail: "FT-2026-00456",
        montants: {
          montantAideFranceTravailCents: 200000,
          resteAChargeCents: 0,
          coutTotalCents: 200000,
        },
      },
    }),
  ];
}

describe("Mention TVA — kits financeurs, régime assujetti", () => {
  it("aucun kit n'annonce l'exonération 261-4-4° que Will ne détient pas", () => {
    for (const kit of kits(IDENTITE_ASSUJETTI)) {
      const texte = collectPdfTextNormalized(kit);
      expect(texte).not.toContain("261-4-4");
      expect(texte.toLowerCase()).not.toContain("exonér");
    }
  });

  // Le fallback « Régime de TVA applicable » remplissait la checklist OPCO d'un
  // texte de remplissage sous la ligne « Facture ». Chez un financeur, une
  // mention légale vague vaut moins que pas de mention du tout.
  it("la checklist OPCO n'imprime pas de texte de remplissage à la place", () => {
    const texte = collectPdfTextNormalized(kits(IDENTITE_ASSUJETTI)[0]!);
    expect(texte).not.toContain("Régime de TVA applicable");
  });
});

describe("Mention TVA — kits financeurs, régime exonéré", () => {
  // Sans ce test, celui du dessus passerait aussi sur un template qui aurait
  // perdu la mention. Il prouve que le bloc gardé est atteignable.
  it("la mention SORT bien quand le régime la porte", () => {
    const textes = kits(IDENTITE_EXONERE).map((k) => collectPdfTextNormalized(k));
    expect(textes.some((t) => t.includes("261-4-4"))).toBe(true);
  });
});

describe("Mention TVA — garde-fou au niveau des sources", () => {
  // Le SSOT a le droit de nommer l'article : c'est son travail.
  const AUTORISES = [
    path.join("src", "server", "qualiopi", "legal", "tva.ts"),
    path.join("src", "server", "qualiopi", "legal", "legal-mentions.ts"),
    path.join("src", "server", "qualiopi", "config", "registry.ts"),
    path.join("src", "server", "qualiopi", "remuneration", "calcul.ts"),
    path.join("src", "server", "qualiopi", "facturation", "facture-libre-pur.ts"),
  ];

  function fichiersDeRendu(): string[] {
    const racines = [
      path.join("src", "server", "qualiopi", "documents", "templates"),
      path.join("src", "components", "admin", "qualiopi"),
    ];
    const out: string[] = [];
    for (const racine of racines) {
      const pile = [racine];
      while (pile.length > 0) {
        const dir = pile.pop()!;
        if (!fs.existsSync(dir)) continue;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) pile.push(p);
          else if (/\.tsx?$/.test(e.name) && !/\.spec\.tsx?$/.test(e.name)) out.push(p);
        }
      }
    }
    return out;
  }

  it("aucun template ni écran admin ne code l'exonération en dur", () => {
    // Les commentaires ont le droit d'expliquer la règle — ce sont eux qui
    // évitent la rechute suivante. Seul le texte RENDU est fautif.
    const sansCommentaires = (src: string): string =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    const coupables = fichiersDeRendu().filter((p) => {
      if (AUTORISES.some((a) => p.endsWith(a))) return false;
      return /261-4-4/.test(sansCommentaires(fs.readFileSync(p, "utf8")));
    });
    expect(coupables).toEqual([]);
  });

  it("le recensement trouve bien des fichiers — le garde-fou n'est pas vide", () => {
    expect(fichiersDeRendu().length).toBeGreaterThan(10);
  });
});
