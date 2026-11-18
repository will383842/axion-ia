// @vitest-environment node

/**
 * Un devis signé sous la v5 du gabarit se re-rend OCTET POUR OCTET après le passage en v6
 * (charte 2027). Trois cas : devis classique, devis classique avec conditions particulières,
 * devis à formules. Les empreintes ont été relevées par ce même test sur le gabarit v5
 * COURANT, avant toute retouche de `devis.tsx` (horloge figée au 2026-11-05T10:00:00Z : le
 * PDF embarque sa date de création).
 *
 * ⛔ Si une empreinte rougit, NE PAS la mettre à jour : c'est l'exemplaire d'une pièce
 * signée qui vient de changer (archive `devis.v5.tsx`, module partagé, polices, react-pdf).
 */

import { createHash } from "node:crypto";
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

/** Empreintes des trois devis ci-dessus rendus sous la v5, relevées AVANT la v6. ⛔ Ne jamais mettre à jour. */
const EMPREINTES_V5 = {
  classique: "4322b81798e55ae34d55992d739f11e7a778cba0e8eb22dacef886930f6f5128",
  conditions: "7770924ad6ce497c92a5720fa90a2d3a2969745a5fdc7b58c8351a0a8e7eccd3",
  formules: "d7490d50a5e39c1e9db27ac5f961f9419c6bb1467df197283702a883701484c0",
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

describe("🔴 un devis signé sous la v5 se re-rend à l'identique", () => {
  const CAS = [
    ["classique", DATA_CLASSIQUE],
    ["conditions", DATA_CONDITIONS],
    ["formules", DATA_FORMULES],
  ] as const;

  for (const [nom, data] of CAS) {
    it(`v5 ${nom} — mêmes octets qu'avant le passage en v6`, async () => {
      const r = await exemplaire(data as Record<string, unknown>, 5);
      expect(r.ok, r.ok ? "" : r.message).toBe(true);
      if (!r.ok) return;
      expect(sha(r.buffer)).toBe(EMPREINTES_V5[nom]);
    }, 60_000);
  }

  it("la v5 est archivée : la version courante est la v7", () => {
    expect(versionGabaritCourante("devis")).toBe(7);
    expect(gabaritArchive("devis", 5)).not.toBeNull();
  });
});
