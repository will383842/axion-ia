// @vitest-environment node

/**
 * Un devis signé sous la v6 du gabarit se re-rend OCTET POUR OCTET après le passage en v7
 * (retrait de la carte d'estimation de financement et du champ certification). Trois cas : devis classique, devis classique avec conditions particulières,
 * devis à formules. Les empreintes ont été relevées par ce même test sur l'archive v6
 * (copie conforme du gabarit courant d'avant la v7) (horloge figée au 2026-11-05T10:00:00Z : le
 * PDF embarque sa date de création).
 *
 * ⛔ Si une empreinte rougit, NE PAS la mettre à jour : c'est l'exemplaire d'une pièce
 * signée qui vient de changer (archive `devis.v6.tsx`, module partagé, polices, react-pdf).
 */

import { createHash } from "node:crypto";
import React from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: (...a: unknown[]) => findUnique(...a) },
    documentSignature: { findMany: (...a: unknown[]) => findMany(...a) },
    devis: { findFirst: (...a: unknown[]) => findFirst(...a) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { rendreExemplaireSigne } from "@/server/qualiopi/documents/signature/exemplaire-signe";
import { versionGabaritCourante } from "@/server/qualiopi/documents/templates/gabarit-versions";
import { gabaritArchive } from "@/server/qualiopi/documents/templates/archives";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";

const IDENTITE = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
};

const DATA_CLASSIQUE = {
  numero: "AXI-DEV-2026-014",
  dateEmission: "05/11/2026",
  dateValidite: "05/12/2026",
  identite: IDENTITE,
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client",
  },
  lignes: [{ designation: "Atelier IA — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 }],
  regimeTva: "assujetti",
  tauxTvaStandardPercent: 20,
};

const DATA_CONDITIONS = {
  ...DATA_CLASSIQUE,
  numero: "AXI-DEV-2026-015",
  conditionsParticulieres:
    "Les ateliers ont lieu dans les locaux du client.\n\nLe client fournit un accès réseau.",
  phrasePrimaute: "En cas de contradiction, les conditions particulières priment sur les CGV.",
};

const DATA_ESTIMATION = {
  ...DATA_CLASSIQUE,
  numero: "AXI-DEV-2026-017",
  financementSuggere: "OPCO",
  montantOpcoEstimeCents: 100000,
  resteAChargeCents: 80000,
};

const offre = () => {
  const o = offreFictive();
  o.achat!.phases = [
    { rang: 1, libelle: "Acompte", pourcentage: 30, declencheur: "signature" },
    { rang: 2, libelle: "Solde", pourcentage: 70, declencheur: "livraison" },
  ];
  o.achat!.lignes = [{ libelle: "Ligne A", quantite: 1, prixHtCents: 100000, tauxTvaBps: 2000 }];
  o.abonnement!.preavisMois = 2;
  o.abonnement!.engagementMois = 12;
  o.servicesTiers = [
    { nom: "Serveur dédié", obligatoire: true, estimationHtCents: 1500, rythme: "mensuel" },
  ];
  o.plafondAConfirmer = { montantHtCents: 50000, texte: "Frais d'infrastructure" };
  return o;
};

const DATA_FORMULES = {
  ...DATA_CLASSIQUE,
  numero: "AXI-DEV-2026-016",
  lignes: [],
  formules: vueFormules(offre()),
};

/** Empreintes des trois devis ci-dessus rendus sous la v6, relevées AVANT la v7. ⛔ Ne jamais mettre à jour. */
const EMPREINTES_V6 = {
  classique: "c1e4015cff01f9122e82b788c83464d859a4ffe99a77a9558290214dce4c834c",
  conditions: "9bccfe5b18d598accd504ffd35100bcd3701ecbd8ac53ba7fefe8d2b0581a73c",
  formules: "36ca7b9aad8725232711691a8892fa73e488b3812d9b72680f91de0e8b141e6e",
  estimation: "a3cb77bd55def24f9eaf98a3950ac9f3a5f1d577be7047bc0b324a51be366fba",
} as const;

beforeAll(() => {
  registerPdfTestFontsFallback();
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => {
  vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

async function exemplaire(data: Record<string, unknown>, version: number) {
  findUnique.mockResolvedValueOnce({
    numero: data["numero"],
    type: "devis",
    metadata: {
      renderData: JSON.parse(JSON.stringify({ data, identite: IDENTITE, gabaritVersion: version })),
    },
    client: null,
    session: null,
  });
  findMany.mockResolvedValueOnce(
    ["client", "axionia"].map((partie, i) => ({
      partie,
      signataireNom: `Signataire ${partie}`,
      signataireQualite: "Représentant",
      signeAt: new Date(Date.UTC(2026, 10, 5, 9, 15 + i)),
      selfHash: String(i).repeat(64),
      methode: "trace",
      signatureKey: null,
      imagePurgeeAt: null,
      hashVersion: 1,
      choixOffre: null,
      choixOffreSha256: null,
    })),
  );
  findFirst.mockResolvedValue(null);
  return rendreExemplaireSigne("doc-id");
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("🔴 un devis signé sous la v6 se re-rend à l'identique", () => {
  const CAS = [
    ["classique", DATA_CLASSIQUE],
    ["conditions", DATA_CONDITIONS],
    ["formules", DATA_FORMULES],
    ["estimation", DATA_ESTIMATION],
  ] as const;

  for (const [nom, data] of CAS) {
    it(`v6 ${nom} — mêmes octets qu'avant le passage en v7`, async () => {
      const r = await exemplaire(data as Record<string, unknown>, 6);
      expect(r.ok, r.ok ? "" : r.message).toBe(true);
      if (!r.ok) return;
      expect(sha(r.buffer)).toBe(EMPREINTES_V6[nom]);
    }, 60_000);
  }

  it("la v6 est archivée : la version courante est la v7", () => {
    expect(versionGabaritCourante("devis")).toBe(7);
    expect(gabaritArchive("devis", 6)).not.toBeNull();
  });

  it("la v6 imprime ENCORE la carte quand les données y sont (une pièce signée garde son texte)", async () => {
    const r = await exemplaire(DATA_ESTIMATION as Record<string, unknown>, 6);
    expect(r.ok, r.ok ? "" : r.message).toBe(true);
    const el = React.createElement(
      gabaritArchive("devis", 6)! as React.ComponentType<{ data: never }>,
      {
        data: DATA_ESTIMATION as never,
      },
    );
    const t = collectPdfTextNormalized(el);
    expect(t).toContain("Estimation de financement");
    expect(t).toContain("Prise en charge estimée");
    expect(t).toContain("Reste à charge estimé");
  }, 60_000);
});
