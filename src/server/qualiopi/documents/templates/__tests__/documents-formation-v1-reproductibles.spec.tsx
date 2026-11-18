// @vitest-environment node

/**
 * Une pièce émise sous la v1 d'un des cinq gabarits de formation (programme, convocation,
 * attestation, attestation partielle, certificat de réalisation) se re-rend OCTET POUR OCTET
 * après le passage en v2 (charte 2027). Les empreintes ont été relevées sur les gabarits
 * COURANTS, avant toute retouche, horloge figée (le PDF embarque sa date de création).
 *
 * ⛔ Si une empreinte rougit, NE PAS la mettre à jour : c'est le rendu d'une pièce déjà émise
 * qui vient de changer (archive, module partagé, polices, react-pdf).
 */

import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { registerPdfTestFontsFallback } from "../../register-pdf-test-fonts";
import { gabaritArchiveFormation } from "../archives";
import { CAS_DOCUMENTS } from "./fixtures-documents-formation";

/** Rendu v1, relevé AVANT la v2. ⛔ Ne jamais mettre à jour. */
const EMPREINTES_V1: Readonly<Record<string, string>> = {
  programme: "3e3532ba81b8e21ae91f38fb10d1a8ce570c416ede12762a771a89c8520f6b91",
  "programme sans module ni ressource":
    "79992f367f8418d93303ffb3da5b093c0ac64466931190952541b65d90ce51b8",
  "convocation présentiel": "dfd1a877e1ba65ebdaf88fda33ab8f4fdcb1a8e227fff3068fc5eece2d9559cc",
  "convocation distanciel v2": "c72abcc948b5c5b0bed1b7812abdeb44f855fbb80bc6dfdb6e4d821b4c062df1",
  attestation: "74288725e823cd3f7a8169674969f2d2edf04e52a54bc22983df268cce6c817a",
  "attestation partielle": "04f92deb26aff28909f845499d0cfcf9496139ba11e6c0bb0e294e92c9de27e0",
  "attestation partielle sans heure suivie":
    "07e1b2e4eaa5dde0b230cac3150bb18722bae6a33e6eaceff07eee5e4d0279a5",
  "certificat de réalisation": "89d506d1d3ea38b4fc9cd854eacaa34f84e8ee6125dc493f52b85d6e5787276f",
};

beforeAll(() => {
  registerPdfTestFontsFallback();
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => {
  vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("🔴 une pièce émise sous la v1 se re-rend à l'identique", () => {
  for (const cas of CAS_DOCUMENTS) {
    it(`v1 ${cas.nom} — mêmes octets qu'avant le passage en v2`, async () => {
      const C = gabaritArchiveFormation(cas.gabarit, 1);
      expect(C).not.toBeNull();
      const buffer = await renderToBuffer(cas.rendre(C as never));
      expect(sha(buffer)).toBe(EMPREINTES_V1[cas.nom]);
    }, 60_000);
  }
});
