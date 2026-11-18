// @vitest-environment node

/**
 * Une convention (v6), une convention tripartite (v6) ou un contrat de formation (v2) SIGNÉ
 * se re-rend OCTET POUR OCTET après le passage à la charte 2027 (convention v7, tripartite v7,
 * contrat v3). Les empreintes ont été relevées par ce même test sur les gabarits COURANTS,
 * avant toute retouche de `convention.tsx`, `convention-tripartite.tsx` et
 * `contrat-formation.tsx` (horloge figée : le PDF embarque sa date de création).
 *
 * ⛔ Si une empreinte rougit, NE PAS la mettre à jour : c'est l'exemplaire d'une pièce
 * signée qui vient de changer (archive, module partagé, polices, react-pdf).
 */

import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: (...a: unknown[]) => findUnique(...a) },
    documentSignature: { findMany: (...a: unknown[]) => findMany(...a) },
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

const CONVENTION = {
  numero: "AXI-DOC-2026-050",
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client, 42000 Saint-Étienne",
    contact: "Gérante",
  },
  intitule: "IA pour l'immobilier",
  objectifs: ["Utiliser l'IA générative au quotidien", "Automatiser des tâches"],
  publicVise: "Dirigeants et collaborateurs",
  dureeHeures: 7,
  dateDebut: "15/11/2026",
  dateFin: "15/11/2026",
  modalite: "Présentiel",
  lieu: "Saint-Étienne",
  effectif: 2,
  stagiairesNommes: ["Camille Durand", "Alex Martin"],
  prixHt: 1400,
  acomptePercent: 30,
  dateConvention: "05/11/2026",
};
const CONVENTION_CS = {
  ...CONVENTION,
  numero: "AXI-DOC-2026-051",
  acomptePercent: 0,
  conditionSuspensiveOpco: {
    opco: "OPCO Atlas",
    dateLimite: "30/11/2026",
    seuil: { type: "pourcentage", bps: 5000 },
  },
};
const TRIPARTITE = {
  ...CONVENTION,
  numero: "AXI-DOC-2026-052",
  opco: { nom: "OPCO Atlas", numeroPriseEnCharge: "ATLAS-123" },
  montantPrisEnCharge: 1000,
  resteAChargeClient: 400,
};
const TRIPARTITE_CS = {
  ...TRIPARTITE,
  conditionSuspensiveOpco: CONVENTION_CS.conditionSuspensiveOpco,
  acomptePercent: 0,
  numero: "AXI-DOC-2026-053",
};
const CONTRAT = {
  numero: "AXI-DOC-2026-054",
  stagiaire: { nomPrenom: "Camille Durand", email: "camille@example.fr" },
  intitule: "IA pour l'immobilier",
  objectifs: ["Utiliser l'IA générative au quotidien"],
  dureeHeures: 14,
  dateDebut: "01/12/2026",
  dateFin: "02/12/2026",
  modalite: "Distanciel",
  lieu: "Distanciel",
  prixNet: 1490,
  dateContrat: "05/11/2026",
};
const CONTRAT_ACOMPTE = { ...CONTRAT, numero: "AXI-DOC-2026-055", acomptePercent: 20 };

/** Empreintes des exemplaires signés ci-dessus rendus AVANT la charte 2027. ⛔ Ne jamais mettre à jour. */
const CAS = [
  {
    nom: "convention v6",
    type: "convention",
    version: 6,
    data: CONVENTION,
    parties: ["client", "axionia"],
    sha: "4a4806f3cbc8ee31b25eb155a97b402c76b60a1429ae0e769fcbf15b1904b096",
  },
  {
    nom: "convention v6 avec condition suspensive",
    type: "convention",
    version: 6,
    data: CONVENTION_CS,
    parties: ["client", "axionia"],
    sha: "d9e2896f33a1817be757a53bbcf77f3b6ef0afece4f19100386e4a4ef84bfa10",
  },
  {
    nom: "convention tripartite v6",
    type: "convention_tripartite",
    version: 6,
    data: TRIPARTITE,
    parties: ["client", "financeur", "axionia"],
    sha: "6f2bec98cfd575509fc1b4751a3a411f7d769459caae7cb79392931408f84ae7",
  },
  {
    nom: "convention tripartite v6 avec condition suspensive",
    type: "convention_tripartite",
    version: 6,
    data: TRIPARTITE_CS,
    parties: ["client", "financeur", "axionia"],
    sha: "3d44c56401214f41715d3e275123c03a48ab22fa269b0d23d790f74204a6a673",
  },
  {
    nom: "contrat de formation v2",
    type: "contrat",
    version: 2,
    data: CONTRAT,
    parties: ["beneficiaire", "axionia"],
    sha: "23300fcc21b59405b30b82a5d2a0f376bcc7a77cbb1bf29d1ebee56af1fdb660",
  },
  {
    nom: "contrat de formation v2 avec acompte",
    type: "contrat",
    version: 2,
    data: CONTRAT_ACOMPTE,
    parties: ["beneficiaire", "axionia"],
    sha: "cf22291b7783fcb8e749e9eee99ceb04f4a7101e539413706f07003c5dcb0d3c",
  },
] as const;

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

async function exemplaire(cas: (typeof CAS)[number]) {
  findUnique.mockResolvedValueOnce({
    numero: cas.data.numero,
    type: cas.type,
    metadata: {
      renderData: JSON.parse(
        JSON.stringify({ data: cas.data, identite: IDENTITE, gabaritVersion: cas.version }),
      ),
    },
    client: null,
    session: null,
  });
  findMany.mockResolvedValueOnce(
    cas.parties.map((partie, i) => ({
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
  return rendreExemplaireSigne("doc-id");
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("🔴 une pièce signée sous l'ancien style se re-rend à l'identique", () => {
  for (const cas of CAS) {
    it(`${cas.nom} — mêmes octets qu'avant la charte 2027`, async () => {
      const r = await exemplaire(cas);
      expect(r.ok, r.ok ? "" : r.message).toBe(true);
      if (!r.ok) return;
      expect(sha(r.buffer)).toBe(cas.sha);
    }, 60_000);
  }

  it("les anciennes versions sont archivées et les courantes sont postérieures", () => {
    expect(versionGabaritCourante("convention")).toBeGreaterThan(6);
    expect(versionGabaritCourante("convention_tripartite")).toBeGreaterThan(6);
    expect(versionGabaritCourante("contrat")).toBeGreaterThan(2);
    expect(gabaritArchive("convention", 6)).not.toBeNull();
    expect(gabaritArchive("convention_tripartite", 6)).not.toBeNull();
    expect(gabaritArchive("contrat_formation", 2)).not.toBeNull();
  });
});
