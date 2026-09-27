/**
 * 🔴 L'aperçu RECONSTITUÉ est bandé comme tel à l'écran (2026-09-27).
 *
 * Pris pour la copie d'origine, un aperçu reconstitué ferait relire comme
 * « envoyé » un texte qui n'a peut-être jamais existé sous cette forme. Le
 * bandeau « Reconstitué — ce n'est pas la copie d'origine » doit donc être
 * présent, et placé AVANT le rendu. On passe par la vraie reconstitution
 * (seule la base est doublée) et par le vrai composant d'écran.
 *
 * La règle de rendu elle-même (dates charnières, signature) est gardée dans
 * `features/admin-emails/__tests__/l-apercu-reconstitue-respecte-la-signature-selon-la-date`.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findUnique: async () => ({
        id: "9d7c6b5a-4e3f-4a2b-9c1d-0e1f2a3b4c5d",
        contactName: "Camille Dupont",
        contactEmailHash: "empreinte",
        details: {
          unifiedType: "recrutement",
          subType: "candidature-commerciale",
          etape: "premier-contact",
        },
        deletedAt: null,
      }),
      findMany: async () => [],
    },
    customerReview: { aggregate: async () => ({ _avg: { rating: null }, _count: { _all: 0 } }) },
  },
}));

import { reconstituerInvitation } from "@/features/admin-emails/reconstitution-invitation";
import type { DetailEmail } from "@/features/admin-emails/detail";
import { VueDetailEmail } from "../../_components/VueDetailEmail";

const AVANT_SIGNATURE = new Date("2026-09-27T17:40:00Z"); // 19:40 à Paris

const EMAIL: DetailEmail = {
  id: "3f2a9c1e-8b7d-4e6f-a5c4-1b2d3e4f5a6b",
  template: "apporteur-invitation-appel",
  recipient: "camille.dupont@example.invalid",
  locale: "fr",
  marketing: false,
  status: "sent",
  attempts: 1,
  error: null,
  bounceType: null,
  bounceReason: null,
  bouncedAt: null,
  sentAt: AVANT_SIGNATURE,
  failedAt: null,
  dueAt: null,
  createdAt: AVANT_SIGNATURE,
  entityType: "Submission",
  entityId: "9d7c6b5a-4e3f-4a2b-9c1d-0e1f2a3b4c5d",
  providerMessageId: null,
  copie: null,
};

describe("🔴 l'écran bande l'aperçu reconstitué", () => {
  it("le bandeau « Reconstitué — ce n'est pas la copie d'origine » précède le rendu", async () => {
    process.env["CALENDLY_APPORTEUR_URL"] =
      "https://calendly.com/axion-ia/echange-apporteur-15-min";
    process.env["AUTH_SECRET"] ??= "secret-de-test-suffisamment-long-0123456789";
    const apercu = await reconstituerInvitation(EMAIL);
    expect(apercu.ok).toBe(true);
    const html = renderToStaticMarkup(
      <VueDetailEmail
        email={EMAIL}
        vue="html"
        raison={{
          kind: "anterieure",
          phrase: "Copie non conservée (envoi antérieur au 28/09/2026).",
        }}
        apercu={apercu}
        base="/fr/p/emails-envoyes"
        adminPrefix="p"
      />,
    );
    const bandeau = html.indexOf("Reconstitué — ce n&#x27;est pas la copie d&#x27;origine");
    expect(bandeau).toBeGreaterThan(-1);
    expect(bandeau).toBeLessThan(html.indexOf("<iframe"));
    expect(html).toMatch(/<iframe[^>]*sandbox=""/);
    expect(html).toContain("sans signature");
    expect(html).toContain("Copie non conservée (envoi antérieur au 28/09/2026).");
  });

  it("témoin : une vraie copie ne porte PAS le bandeau", () => {
    const html = renderToStaticMarkup(
      <VueDetailEmail
        email={{
          ...EMAIL,
          copie: {
            subject: "Ta candidature est retenue",
            html: "<p>x</p>",
            text: "x",
            attachmentNames: [],
            secretsMasques: 1,
            createdAt: new Date(),
          },
        }}
        vue="texte"
        raison={null}
        apercu={null}
        base="/fr/p/emails-envoyes"
        adminPrefix="p"
      />,
    );
    expect(html).not.toContain("Reconstitué");
    expect(html).toContain("Copie exacte");
    // Onglet texte : pas d'iframe, le texte brut.
    expect(html).not.toContain("<iframe");
    expect(html).toContain("<pre");
  });
});
