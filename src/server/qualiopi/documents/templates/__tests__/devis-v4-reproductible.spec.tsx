// @vitest-environment node

/**
 * Un devis signé sous la v4 du gabarit se re-rend OCTET POUR OCTET après le passage en v5
 * (bloc « Conditions particulières »). L'empreinte a été relevée par ce même test sur le
 * gabarit v4 COURANT, avant toute retouche de `devis.tsx` (horloge figée : le PDF embarque
 * sa date de création).
 *
 * ⛔ Si cette empreinte rougit, NE PAS la mettre à jour : c'est l'exemplaire d'une pièce
 * signée qui vient de changer (archive `devis.v4.tsx`, module partagé, polices, react-pdf).
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

const DATA_DEVIS = {
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

/** Empreinte du devis ci-dessus rendu sous la v4, relevée AVANT la v5. */
const EMPREINTE_V4 = "4322b81798e55ae34d55992d739f11e7a778cba0e8eb22dacef886930f6f5128";

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

describe("🔴 un devis signé sous la v4 se re-rend à l'identique", () => {
  it("v4 — mêmes octets qu'avant le passage en v5", async () => {
    const r = await exemplaire(DATA_DEVIS, 4);
    expect(r.ok, r.ok ? "" : r.message).toBe(true);
    if (!r.ok) return;
    expect(createHash("sha256").update(r.buffer).digest("hex")).toBe(EMPREINTE_V4);
  }, 60_000);

  it("la v4 est archivée et la version courante est postérieure", () => {
    expect(versionGabaritCourante("devis")).toBeGreaterThan(4);
    expect(gabaritArchive("devis", 4)).not.toBeNull();
  });

  it("un devis v5 sans conditions particulières se rend comme sous la v4 (texte)", async () => {
    const v4 = await exemplaire(DATA_DEVIS, 4);
    const v5 = await exemplaire(DATA_DEVIS, 5);
    expect(v4.ok, v4.ok ? "" : v4.message).toBe(true);
    expect(v5.ok, v5.ok ? "" : v5.message).toBe(true);
    if (v4.ok && v5.ok) expect(v5.buffer.equals(v4.buffer)).toBe(true);
  }, 60_000);
});
