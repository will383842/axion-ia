/**
 * Lot S6a (f) — l'autorisation de captation se rend en EXEMPLAIRE SIGNÉ, et
 * sous la version de gabarit qui l'a produite.
 *
 * Avant : `rendreExemplaireSigne` rendait `type_non_rendu` pour un consentement,
 * alors que c'est un circuit du SSOT et que son template rend la preuve. La
 * personne qui consentait ne recevait jamais l'exemplaire de son consentement.
 *
 * Le rendu PDF est le VRAI ; seuls Prisma et R2 sont simulés.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  p: {
    // Interrupteur `signature.exemplaire_captation` allumé : coupé, le
    // consentement ne se rend pas (cf. `exemplaire-captation-interrupteur.spec.ts`).
    setting: {
      findUnique: vi.fn(async () => ({
        value: { actif: true, allumeLe: "2026-10-01T00:00:00.000Z" },
        updatedAt: new Date("2026-10-01T00:00:00Z"),
      })),
    },
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/lib/r2-storage", () => ({ getSignedUrlR2: vi.fn() }));

import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { versionGabaritCourante } from "@/server/qualiopi/documents/templates/gabarit-versions";
import { rendreExemplaireSigne } from "./exemplaire-signe";

const IDENTITE = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@exemple.test",
  telephone: "+33 1 00 00 00 00",
  site: "https://exemple.test",
};

const DATA = {
  numero: "AXI-DOC-2026-900",
  personne: { nomPrenom: "Personne Essai", qualite: "Stagiaire" },
  intitule: "Formation d'essai",
  dateAction: "10/10/2026",
  lieu: "Lyon",
  dateEdition: "10/10/2026",
  finalites: ["Illustrer les supports de formation"],
  supports: ["Site internet de l'organisme"],
  dureeAnnees: 3,
};

beforeAll(() => registerPdfTestFontsFallback());

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
  h.p.documentSignature.findMany.mockResolvedValue([
    {
      partie: "beneficiaire",
      signataireNom: "Personne Essai",
      signataireQualite: "Stagiaire",
      signeAt: new Date("2026-10-10T09:00:00Z"),
      selfHash: "c".repeat(64),
      methode: "confirmation_accessible",
      signatureKey: null,
      imagePurgeeAt: null,
    },
  ]);
});

describe("autorisation de captation — exemplaire signé", () => {
  it("la pièce est VERSIONNÉE", () => {
    expect(versionGabaritCourante("autorisation_captation")).toBe(1);
  });

  it("un consentement de test se rend en exemplaire PDF", async () => {
    h.p.documentGenere.findUnique.mockResolvedValue({
      numero: DATA.numero,
      type: "autorisation_captation",
      metadata: {
        renderData: { data: DATA, identite: IDENTITE, gabaritVersion: 1 },
      },
      client: null,
      session: { titreSession: "Formation d'essai" },
    });
    const r = await rendreExemplaireSigne("doc-captation");
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (r.ok) {
      expect(r.buffer.subarray(0, 5).toString()).toBe("%PDF-");
      expect(r.buffer.length).toBeGreaterThan(1000);
    }
  });

  it("une version inconnue n'est pas reproduite avec le texte d'aujourd'hui", async () => {
    h.p.documentGenere.findUnique.mockResolvedValue({
      numero: DATA.numero,
      type: "autorisation_captation",
      metadata: { renderData: { data: DATA, identite: IDENTITE, gabaritVersion: 7 } },
      client: null,
      session: null,
    });
    const r = await rendreExemplaireSigne("doc-captation");
    expect(r).toMatchObject({ ok: false, raison: "gabarit_modifie" });
  });
});
