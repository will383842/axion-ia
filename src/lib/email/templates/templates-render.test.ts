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
// Footer social — présent SELON LA FAMILLE, plus « dans tous les e-mails ».
//
// 🔴 2026-08-31 — ce bloc affirmait : « les 4 liens doivent être présents dans
// TOUT email rendu via le layout » (demande Will 2026-08-04), et ne le
// vérifiait que sur `payment-receipt`. Or `payment-receipt` est un REÇU : le
// référentiel e-mail le classe en famille A, où les réseaux sociaux, le partage
// et la demande d'avis sont interdits (§2.5, §5.1 règle 3).
//
// Ce n'est pas une préférence esthétique. Un e-mail de paiement chargé de liens
// sociaux ressemble à un e-mail marketing — c'est-à-dire à ce qu'un hameçonneur
// fabrique. La sobriété de la famille A est le repère qui permet à un
// destinataire de distinguer un vrai message d'argent d'un faux.
//
// La règle est donc conservée, mais RESTREINTE à son domaine : familles B et D
// portent les 4 liens, famille A n'en porte aucun. Arbitrage Will, 2026-08-31.
// ─────────────────────────────────────────────────────────────────────────────

describe("footer social — selon la famille de l'e-mail", () => {
  const LIENS_SOCIAUX = [
    "https://www.linkedin.com/company/axion-ia-france/",
    "https://www.linkedin.com/in/williamsjullin/",
    "https://www.facebook.com/profile.php?id=61591668644032",
    "https://www.facebook.com/profile.php?id=61586489122989",
  ];

  it("famille B (force-majeure-notice) porte les 4 liens sociaux du footer", async () => {
    const r = await renderEmailTemplate(
      "force-majeure-notice" as never,
      "fr",
      PAYLOADS["force-majeure-notice"]!,
    );
    for (const lien of LIENS_SOCIAUX) {
      expect(r.html, `famille B doit porter ${lien}`).toContain(lien);
    }
  });

  it("famille A (payment-receipt) n'en porte AUCUN — un reçu n'est pas un support de marque", async () => {
    const r = await renderEmailTemplate(
      "payment-receipt" as never,
      "fr",
      PAYLOADS["payment-receipt"]!,
    );
    for (const lien of LIENS_SOCIAUX) {
      expect(r.html, `famille A ne doit pas porter ${lien}`).not.toContain(lien);
    }
    // Ni preuve sociale, ni sollicitation d'avis sur une pièce comptable.
    expect(r.html).not.toContain("Laisser un avis");
    expect(r.html).not.toContain("Partager sur LinkedIn");
  });
});
