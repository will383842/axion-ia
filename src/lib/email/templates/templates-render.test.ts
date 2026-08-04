// Tests render des 7 nouveaux templates Sprint X.13.
//
// Cible : chaque template renvoie un subject non-vide + render HTML
// non-vide pour FR et EN. Pas de regression d'interpolation.

import { describe, it, expect } from "vitest";
import { renderEmailTemplate } from "./index";

const PAYLOADS: Record<string, Record<string, unknown>> = {
  "payment-link": {
    contactName: "Jean Dupont",
    invoiceNumber: "AXION-2026-0001",
    amountTtc: "1 200 €",
    checkoutUrl: "https://checkout.stripe.com/c/pay/abc123",
    expiresAt: "2026-05-15",
  },
  "payment-receipt": {
    contactName: "Jean Dupont",
    invoiceNumber: "AXION-2026-0001",
    amountTtc: "1 200 €",
    paidAt: "2026-05-13",
    paymentType: "deposit",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },
  "payment-failed": {
    contactName: "Jean Dupont",
    invoiceNumber: "AXION-2026-0001",
    amountTtc: "1 200 €",
    retryUrl: "https://checkout.stripe.com/c/pay/retry",
  },
  "booking-validated-on-calendar": {
    contactName: "Jean Dupont",
    interventionType: "essentielle",
    bookingDate: "2026-06-15",
    bookingTime: "09:00",
    participantsCount: 12,
    bookingId: "00000000-0000-0000-0000-000000000001",
  },
  "booking-paused-confirmation": {
    contactName: "Jean Dupont",
    interventionType: "essentielle",
    pausedAt: "2026-05-13",
    pausedUntil: "2026-08-01",
    reason: "Restructuration interne",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },
  "booking-resumed-notification": {
    contactName: "Jean Dupont",
    interventionType: "essentielle",
    resumedDate: "2026-09-15",
    resumedTime: "09:00",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },
  "force-majeure-notice": {
    contactName: "Jean Dupont",
    interventionType: "essentielle",
    notes: "Catastrophe naturelle empêchant le déplacement sur site (alerte rouge).",
    bookingId: "00000000-0000-0000-0000-000000000001",
  },
};

describe("Sprint X.13 — render templates", () => {
  for (const [name, payload] of Object.entries(PAYLOADS)) {
    for (const locale of ["fr", "en"] as const) {
      it(`${name} (${locale}) renders subject + non-empty html + text`, async () => {
        const r = await renderEmailTemplate(name as never, locale, payload);
        expect(r.subject).toBeTruthy();
        expect(r.subject.length).toBeGreaterThan(5);
        expect(r.html).toContain("<html");
        expect(r.html.length).toBeGreaterThan(500);
        expect(r.text).toBeTruthy();
        expect(r.text.length).toBeGreaterThan(50);
      });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Footer social commun (demande Will 2026-08-04) — les 4 liens doivent être
// présents dans TOUT email rendu via le layout. Garde : retirer la rangée
// sociale du footer de `_layout.tsx` fait rougir ce test.
// ─────────────────────────────────────────────────────────────────────────────

describe("footer social — présent dans chaque email", () => {
  const LIENS_SOCIAUX = [
    "https://www.linkedin.com/company/axion-ia-france/",
    "https://www.linkedin.com/in/williamsjullin/",
    "https://www.facebook.com/profile.php?id=61591668644032",
    "https://www.facebook.com/profile.php?id=61586489122989",
  ];

  it("payment-receipt (fr) porte les 4 liens sociaux du footer", async () => {
    const r = await renderEmailTemplate(
      "payment-receipt" as never,
      "fr",
      PAYLOADS["payment-receipt"]!,
    );
    for (const lien of LIENS_SOCIAUX) {
      expect(r.html).toContain(lien);
    }
  });
});
