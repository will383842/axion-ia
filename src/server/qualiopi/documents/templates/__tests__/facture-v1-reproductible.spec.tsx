// @vitest-environment node

/**
 * Une facture ou un avoir émis sous la v1 du gabarit se re-rend OCTET POUR OCTET après le
 * passage en v2 (charte 2027). Sept cas (voir `facture-cas.spec-util.ts`). Les empreintes ont
 * été relevées sur le gabarit v1 COURANT, avant toute retouche de `facture.tsx` (horloge figée
 * au 2026-11-05T10:00:00Z : le PDF embarque sa date de création).
 *
 * ⛔ Si une empreinte rougit, NE PAS la mettre à jour : c'est le rendu d'une pièce comptable
 * déjà émise qui vient de changer (archive `facture.v1.tsx`, module partagé, polices, react-pdf).
 */

import { createHash } from "node:crypto";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { registerPdfTestFontsFallback } from "../../register-pdf-test-fonts";
import { gabaritArchive } from "../archives";
import { versionGabaritCourante } from "../gabarit-versions";
import { CAS_FACTURE } from "./facture-cas.spec-util";

/** Empreintes (SHA-256 du PDF) des sept factures rendues sous la v1. ⛔ Ne jamais mettre à jour. */
const EMPREINTES_V1: readonly string[] = [
  "096ebafc15586b8622fc8922a2692abc321a57a1e9c51235fa5f3e762e706798",
  "f94b61a8b877d3ff4062330b9967b1c0a686de5e61647869f28f3b3a58506fbc",
  "24fdc429471d8393c504e02272a591fac41658c74a8edf0a9fdd46ca053ec7da",
  "8e1052b5723fc3faf7f503e702be78154639a7736477dbc450385796853d69a9",
  "e08ea14d12b31fb498a23f0af65cf1f7d7137140cb1d5333fc245402cb60d723",
  "f2b2744479496411efc4927f9674b1a459019fcb06e907af2398fe9a6f3c1f9e",
  "13c5ae7f6876dd172795f1616f0be2d4f537ef38448e3daf54e3e63dceb1703d",
];

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

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("🔴 une facture émise sous la v1 se re-rend à l'identique", () => {
  it("la v1 est archivée et la version courante est postérieure", () => {
    expect(gabaritArchive("facture", 1)).not.toBeNull();
    expect(versionGabaritCourante("facture")).toBeGreaterThan(1);
  });

  CAS_FACTURE.forEach(([nom, data], i) => {
    it(`${nom} : l'archive v1 rend le PDF d'origine`, async () => {
      const Composant = gabaritArchive("facture", 1) as unknown as React.ComponentType<{
        data: typeof data;
      }>;
      const buf = await renderToBuffer(
        React.createElement(Composant, { data }) as React.ReactElement<DocumentProps>,
      );
      expect(sha(buf)).toBe(EMPREINTES_V1[i]);
    });
  });
});
