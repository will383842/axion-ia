// Couverture render — TOUS les templates email (P2 2026-06-21).
//
// Garde-fou : chaque template enregistré rend un subject + HTML + texte non
// vides en FR et EN, NE FUIT AUCUNE trace Estonie/OÜ (l'entité est une SAS
// française), et affiche le footer légal France. Empêche toute régression de
// layout ou de bascule France→Estonie sur l'ensemble du parc email.

import { describe, it, expect } from "vitest";
import { renderEmailTemplate, EMAIL_TEMPLATE_NAMES } from "./index";

// Payload « superset » : les templates ignorent les champs inconnus et ont des
// fallbacks, donc une seule charge couvre tous les cas (rendu non vide garanti).
const PAYLOAD: Record<string, unknown> = {
  contactName: "Jean Dupont",
  invoiceNumber: "F-2026-0001",
  amountTtc: "1 200,00 €",
  amountOverdue: "1 200,00 €",
  amountDue: "1 200,00 €",
  dueDate: "20/05/2026",
  daysOverdue: 30,
  deadlineDate: "30/06/2026",
  installmentNumber: "2/4",
  regularizeUrl: "https://axion-ia.com/contact",
  checkoutUrl: "https://example.com/pay",
  expiresAt: "2026-06-30",
  signUrl: "https://example.com/sign",
  reason: "Mise à jour des conditions",
  interventionType: "essentielle",
  bookingDate: "2026-06-15",
  newDate: "2026-07-01",
  meetingDate: "2026-06-15 09:00",
  scheduledAt: "2026-06-15T09:00:00.000Z",
  durationMin: 45,
  durationMinutes: 45,
  cadrageId: "00000000-0000-0000-0000-000000000002",
  visioUrl: "https://meet.example.com/x",
  feedbackUrl: "https://example.com/feedback",
  quoteNumber: "D-2026-0001",
  validUntil: "2026-07-15",
  quoteUrl: "https://example.com/quote",
  paidAt: "2026-05-13",
  paymentType: "deposit",
  bookingId: "00000000-0000-0000-0000-000000000001",
  subject: "Votre demande — Axion-IA",
  bodyMarkdown: "Bonjour,\n\nMerci de votre message, voici notre retour.",
  numero: "AXI-CONV-2026-001",
  intituleFormation: "IA appliquée aux entreprises",
};

const ESTONIA_LEAKS = ["oü", "estoni", "tallinn", "aki.ee", "registrikood", "eesti"];

describe("Couverture render — tous les templates email", () => {
  it("expose au moins 35 templates enregistrés", () => {
    expect(EMAIL_TEMPLATE_NAMES.length).toBeGreaterThanOrEqual(35);
  });

  for (const name of EMAIL_TEMPLATE_NAMES) {
    for (const locale of ["fr", "en"] as const) {
      it(`${name} (${locale}) : rend + zéro fuite Estonie + footer France`, async () => {
        const r = await renderEmailTemplate(name, locale, PAYLOAD);

        // Rendu non vide.
        expect(r.subject.length).toBeGreaterThan(3);
        expect(r.html).toContain("<html");
        expect(r.html.length).toBeGreaterThan(400);
        expect(r.text.length).toBeGreaterThan(40);

        // Zéro fuite Estonie/OÜ (sujet + html + texte).
        const blob = `${r.subject} ${r.html} ${r.text}`.toLowerCase();
        for (const leak of ESTONIA_LEAKS) {
          expect(blob, `${name} (${locale}) ne doit pas contenir « ${leak} »`).not.toContain(leak);
        }

        // Footer légal France (forme juridique SAS).
        expect(r.html).toContain(locale === "fr" ? "SAS française" : "French company (SAS)");
      });
    }
  }
});
