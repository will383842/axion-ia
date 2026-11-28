// @vitest-environment node
// Non-régression du châssis (lot S2, relecture constat 2) : cinq gabarits NON migrés sont figés
// en instantanés, HTML et texte brut, en français et en anglais. Le plan §2.4 demande la preuve
// « instantané de 5 gabarits avant/après » : l'instantané est celui d'APRÈS le retrait du lien de
// rendez-vous de la signature et de la phrase « action sur votre compte » (seuls écarts voulus) ;
// toute autre évolution du rendu d'un gabarit non migré fait rougir ce fichier.
//
// ⛔ Ne régénérez pas l'instantané pour « faire passer » : s'il change, un rendu existant a été
// modifié. Seule la migration du gabarit lui-même (S4 et suivants) le retire de la liste.
//
// Les statistiques d'avis sont neutralisées comme dans les specs voisines : rendu indépendant de
// la base et de la date.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../review-stats", () => ({
  getPublishedReviewStats: async () => ({ count: 0, avg: 0 }),
}));

import { renderEmailTemplate } from "../index";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

const TEMOINS = [
  ["audit-confirmed", "signature fondateur, famille B"],
  ["apporteur-attribution-confirmee", "signature fondateur-court, famille B"],
  ["contact-confirmed", "signature équipe, famille B"],
  ["payment-receipt", "famille A"],
  ["candidature-entretien-rappel", "famille C"],
] as const;

beforeAll(() => {
  // Le pied porte l'année courante (© 2026) : la date est figée pour que l'instantané ne change
  // pas au 1er janvier. Seule `Date` est simulée, jamais les minuteries.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
  process.env["AUTH_SECRET"] ??= "secret-de-test-suffisamment-long-0123456789";
  process.env["NEXT_PUBLIC_SITE_URL"] ??= "https://axion-ia.com";
});

afterAll(() => {
  vi.useRealTimers();
});

describe("S2 — non-régression : 5 gabarits non migrés figés (HTML et texte)", () => {
  for (const [nom, role] of TEMOINS) {
    for (const locale of ["fr", "en"] as const) {
      it(`${nom} (${role}) en ${locale}`, async () => {
        const { html, text } = await renderEmailTemplate(nom, locale, PAYLOAD_EXEMPLE);
        // Garde de portée : le gabarit doit rester NON migré, sinon l'instantané ne prouve rien.
        expect(html, `${nom} est migré : retirez-le de la liste`).not.toContain(
          "data-destinataire=",
        );
        expect(html).toMatchSnapshot("html");
        expect(text).toMatchSnapshot("texte");
      });
    }
  }
});
