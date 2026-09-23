// Signature du fondateur (§6.1) — les e-mails automatiques qui OUVRENT un
// dialogue la portent ; un reçu ne la porte pas.
//
// 2026-09-23 : un seul gabarit (qualiopi-suivi-j30) l'affichait. Un client qui
// venait d'écrire, de demander un devis ou de réserver un audit recevait une
// réponse automatique signée par personne — puis, s'il répondait, une réponse
// Zoho signée « Williams Jullin ». Les signatures Zoho ont été refaites dans la
// même charte le même jour : ce test garde le côté automatique.
//
// ⚠️ `roi-report` est volontairement ABSENT : ses liens remplissent déjà le
// budget de la famille B (9, §5.2) et la signature en ajoute deux —
// `lien-opposition.spec.tsx` le refuse.

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "./index";
import { EMAIL_SIGNATURE } from "@/lib/email/legal-footer";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

const AVEC_SIGNATURE = [
  "contact-confirmed",
  "quote-request-received",
  "audit-confirmed",
  "implementation-confirmed",
  "rappel-confirme",
  "qualiopi-suivi-j30",
] as const;

describe("signature du fondateur — e-mails qui ouvrent un dialogue", () => {
  for (const nom of AVEC_SIGNATURE) {
    it(`${nom} porte la signature « ${EMAIL_SIGNATURE.fullName} · ${EMAIL_SIGNATURE.roleFr} »`, async () => {
      const { html } = await renderEmailTemplate(nom as never, "fr", PAYLOAD_EXEMPLE);
      expect(html).toContain(EMAIL_SIGNATURE.fullName);
      expect(html).toContain(EMAIL_SIGNATURE.roleFr.replace("&", "&amp;"));
    });
  }

  it("un reçu (famille A) ne la porte pas", async () => {
    const { html } = await renderEmailTemplate("payment-receipt" as never, "fr", PAYLOAD_EXEMPLE);
    expect(html).not.toContain(EMAIL_SIGNATURE.roleFr.replace("&", "&amp;"));
  });
});
