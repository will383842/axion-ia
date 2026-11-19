// @vitest-environment node

/**
 * Une convention bipartite SIGNÉE sous la v7 se re-rend OCTET POUR OCTET après le passage à la
 * v8 (clause financeur, 5 bis et ligne Qualiopi imprimées seulement si la certification est
 * obtenue). Les empreintes ont été relevées par ce même test sur `main` INTACT, avant toute
 * retouche de `convention.tsx` (horloge figée : le PDF embarque sa date de création).
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
const CONVENTION_QUALIOPI = { ...CONVENTION, numero: "AXI-DOC-2026-052" };
const IDENTITE_QUALIOPI = { ...IDENTITE, qualiopi: "FR-2024-001" };

/** Empreintes des exemplaires signés ci-dessus rendus AVANT la v8. ⛔ Ne jamais mettre à jour. */
const CAS = [
  {
    nom: "convention v7",
    data: CONVENTION,
    identite: IDENTITE,
    sha: "a27a1fc03c621873d1467daa6e3aab80b9bbfe03fac10c89026cf0c9b7596cff",
  },
  {
    nom: "convention v7 avec condition suspensive",
    data: CONVENTION_CS,
    identite: IDENTITE,
    sha: "e551f65de4acf64208843a547dba742f86cc81bbb0c4a5e9425e46bde515123a",
  },
  {
    nom: "convention v7 avec numéro Qualiopi",
    data: CONVENTION_QUALIOPI,
    identite: IDENTITE_QUALIOPI,
    sha: "36a5f53088b0a96fc65c8bff30ba74c41169a21ea34af01f1458e4f8ae5ed65d",
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
    type: "convention",
    metadata: {
      renderData: JSON.parse(
        JSON.stringify({ data: cas.data, identite: cas.identite, gabaritVersion: 7 }),
      ),
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
  return rendreExemplaireSigne("doc-id");
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("🔴 une convention signée sous la v7 se re-rend à l'identique", () => {
  for (const cas of CAS) {
    it(`${cas.nom} — mêmes octets qu'avant la v8`, async () => {
      const r = await exemplaire(cas);
      expect(r.ok, r.ok ? "" : r.message).toBe(true);
      if (!r.ok) return;
      expect(sha(r.buffer)).toBe(cas.sha);
    }, 60_000);
  }

  it("la v7 est archivée une fois la v8 courante", () => {
    const courante = versionGabaritCourante("convention") ?? 0;
    expect(courante).toBeGreaterThanOrEqual(7);
    if (courante > 7) {
      expect(gabaritArchive("convention", 7)).not.toBeNull();
    }
  });
});
