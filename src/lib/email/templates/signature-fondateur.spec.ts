// Signature (§6.1) — les e-mails automatiques qui OUVRENT un dialogue la
// portent ; un reçu ne la porte pas.
//
// 2026-09-23 : un seul gabarit (qualiopi-suivi-j30) l'affichait. Un client qui
// venait d'écrire, de demander un devis ou de réserver un audit recevait une
// réponse automatique signée par personne — puis, s'il répondait, une réponse
// Zoho dessinée autrement. Les signatures Zoho ont été refaites dans la même
// charte le même jour : ce test garde le côté automatique.
//
// Deux signataires, décision Will du même jour :
// - « L'équipe Axion-IA » sur les accusés de réception ;
// - Williams Jullin quand c'est lui qui suit le client.
//
// ⛔ Aucun numéro de téléphone : Will ne le veut que dans la signature Presse.
//
// ⚠️ `roi-report` est volontairement ABSENT : ses liens remplissent déjà le
// budget de la famille B (9, §5.2) et la signature en ajoute deux —
// `lien-opposition.spec.tsx` le refuse.

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "./index";
import { EMAIL_LEGAL, EMAIL_SIGNATURE } from "@/lib/email/legal-footer";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

const ROLE_FONDATEUR = EMAIL_SIGNATURE.roleFr.replace("&", "&amp;");
const EQUIPE = "L&#x27;équipe Axion-IA";

const SIGNE_FONDATEUR = ["audit-confirmed", "implementation-confirmed", "qualiopi-suivi-j30"] as const;
const SIGNE_EQUIPE = ["contact-confirmed", "quote-request-received", "rappel-confirme"] as const;

async function rendre(nom: string): Promise<string> {
  const { html } = await renderEmailTemplate(nom as never, "fr", PAYLOAD_EXEMPLE);
  return html;
}

describe("signature — e-mails qui ouvrent un dialogue", () => {
  for (const nom of SIGNE_FONDATEUR) {
    it(`${nom} est signé ${EMAIL_SIGNATURE.fullName}`, async () => {
      const html = await rendre(nom);
      expect(html).toContain(EMAIL_SIGNATURE.fullName);
      expect(html).toContain(ROLE_FONDATEUR);
    });
  }

  for (const nom of SIGNE_EQUIPE) {
    it(`${nom} est signé « L'équipe Axion-IA »`, async () => {
      const html = await rendre(nom);
      expect(html).toContain(EQUIPE);
      expect(html).not.toContain(ROLE_FONDATEUR);
    });
  }

  it("⛔ aucune de ces signatures ne porte le numéro de téléphone", async () => {
    for (const nom of [...SIGNE_FONDATEUR, ...SIGNE_EQUIPE]) {
      const html = await rendre(nom);
      expect(html, `${nom} affiche le numéro de téléphone`).not.toContain(EMAIL_LEGAL.phone);
      expect(html, `${nom} affiche le numéro de téléphone`).not.toContain(EMAIL_LEGAL.phoneTel);
    }
  });

  it("chaque signature porte le positionnement et la ligne de services", async () => {
    for (const nom of [...SIGNE_FONDATEUR, ...SIGNE_EQUIPE]) {
      const html = await rendre(nom);
      expect(html, nom).toContain("de bout en bout");
      expect(html, nom).toContain("Formation finançable OPCO");
    }
  });

  it("un reçu (famille A) ne porte aucune signature", async () => {
    const html = await rendre("payment-receipt");
    expect(html).not.toContain(ROLE_FONDATEUR);
    expect(html).not.toContain(EQUIPE);
  });
});
