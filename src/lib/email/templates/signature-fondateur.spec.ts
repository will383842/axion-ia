// Signature (§6.1) — les e-mails automatiques qui OUVRENT un dialogue la
// portent ; un reçu ne la porte pas.
//
// 2026-09-23 : un seul gabarit (qualiopi-suivi-j30) l'affichait. Un client qui
// venait d'écrire, de demander un devis ou de réserver un audit recevait une
// réponse automatique signée par personne — puis, s'il répondait, une réponse
// Zoho dessinée autrement. Les signatures Zoho ont été refaites dans la même
// charte le même jour : ce test garde le côté automatique.
//
// ⛔ Aucun numéro de téléphone : le fondateur ne le veut que dans la signature Presse.
//
// Lot S2 (2026-11-17) : la signature se déduit de `data-destinataire` et `data-famille`,
// estampillés par le châssis (plan §2.2-5), et plus d'une liste de noms de gabarits :
//   - destinataire posé : une signature par destinataire (client = bloc fondateur complet en
//     famille B ou D, sobre en A ou C ; apporteur et formateur = nom, rôle, LinkedIn en B ou D ;
//     stagiaire et candidat = sobre ; interne = aucune) ;
//   - destinataire non posé (gabarit non migré) : le dessin hérité, dont la prop `signature`
//     décide encore ;
//   - dans tous les cas : plus de lien « Prendre rendez-vous » (décision « pas de réservation
//     directe en ligne »).
//
// ⚠️ `roi-report` est volontairement ABSENT des attentes de signature : ses liens remplissent
// déjà le budget de la famille B (9, §5.2) — `lien-opposition.spec.tsx` le refuse.

import { describe, expect, it } from "vitest";

import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "./index";
import { EMAIL_LEGAL, EMAIL_SIGNATURE } from "@/lib/email/legal-footer";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

const ROLE_FONDATEUR = EMAIL_SIGNATURE.roleFr.replace("&", "&amp;");
const EQUIPE = "L&#x27;équipe Axion-IA";

/** Gabarits qui ouvraient un dialogue avant S2 : signés tant qu'ils ne sont pas migrés. */
const SIGNE_FONDATEUR = [
  "audit-confirmed",
  "implementation-confirmed",
  "qualiopi-suivi-j30",
] as const;
const SIGNE_EQUIPE = ["contact-confirmed", "quote-request-received", "rappel-confirme"] as const;

async function rendre(nom: string, locale: "fr" | "en" = "fr"): Promise<string> {
  const { html } = await renderEmailTemplate(nom as never, locale, PAYLOAD_EXEMPLE);
  return html;
}

const estampille = (html: string, attribut: string): string | null =>
  new RegExp(`data-${attribut}="([^"]*)"`).exec(html)?.[1] ?? null;
const blocSignature = (html: string): string | null =>
  /<p[^>]*data-bloc="signature"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? null;

/** Ce que la signature doit porter pour (destinataire, famille) — plan §2.2-5. */
function attendue(destinataire: string, famille: string) {
  if (destinataire === "interne") return null;
  const pleine = famille === "B" || famille === "D";
  return {
    positionnement: destinataire === "client" && pleine,
    lien: pleine && destinataire !== "stagiaire" && destinataire !== "candidat",
  };
}

describe("signature — les gabarits non migrés gardent leur dessin, moins le rendez-vous", () => {
  for (const nom of SIGNE_FONDATEUR) {
    it(`${nom} : signé ${EMAIL_SIGNATURE.fullName} (tant qu'il n'est pas migré)`, async () => {
      const html = await rendre(nom);
      if (estampille(html, "destinataire") !== null) return; // migré : voir le test par destinataire
      expect(html).toContain(EMAIL_SIGNATURE.fullName);
      expect(html).toContain(ROLE_FONDATEUR);
    });
  }

  for (const nom of SIGNE_EQUIPE) {
    it(`${nom} : signé « L'équipe Axion-IA » (tant qu'il n'est pas migré)`, async () => {
      const html = await rendre(nom);
      if (estampille(html, "destinataire") !== null) return;
      expect(html).toContain(EQUIPE);
      expect(html).not.toContain(ROLE_FONDATEUR);
    });
  }

  it("un reçu (famille A) ne porte aucune signature", async () => {
    const html = await rendre("payment-receipt");
    expect(html).not.toContain(ROLE_FONDATEUR);
    expect(html).not.toContain(EQUIPE);
  });
});

describe("signature — déduite de data-destinataire et data-famille sur tous les gabarits", () => {
  for (const nom of EMAIL_TEMPLATE_NAMES) {
    it(`${nom}`, async () => {
      for (const locale of ["fr", "en"] as const) {
        const html = await rendre(nom, locale);
        const bloc = blocSignature(html);
        const destinataire = estampille(html, "destinataire");
        const famille = estampille(html, "famille")!;

        // Dans tous les cas : plus de lien de rendez-vous EN SIGNATURE (un bouton du corps peut
        // porter ce libellé : il n'est pas la signature), plus de numéro de téléphone.
        expect(html, `${nom} (${locale})`).not.toMatch(/utm_content=signature/);
        expect(html, `${nom} (${locale})`).not.toContain(EMAIL_LEGAL.phoneTel);
        if (bloc !== null) {
          expect(bloc, `${nom} (${locale}) : lien de rendez-vous en signature`).not.toContain(
            "/appel",
          );
          expect(bloc, `${nom} (${locale})`).not.toMatch(/Prendre rendez-vous|Book a call/);
          expect(bloc, `${nom} (${locale}) : téléphone en signature`).not.toContain(
            EMAIL_LEGAL.phone,
          );
        }

        if (destinataire === null) continue; // non migré : le dessin hérité, déjà gardé plus haut
        const a = attendue(destinataire, famille);
        if (a === null) {
          expect(bloc, `${nom} (${locale}) : « interne » sans signature`).toBeNull();
          continue;
        }
        expect(bloc, `${nom} (${locale}) : signature absente`).not.toBeNull();
        expect(bloc, `${nom} (${locale})`).toContain(EMAIL_SIGNATURE.fullName);
        expect(bloc, `${nom} (${locale}) : plus de « L'équipe »`).not.toContain(EQUIPE);
        expect(
          bloc!.includes(locale === "fr" ? "de bout en bout" : "end to end"),
          `${nom} (${locale}) : positionnement`,
        ).toBe(a.positionnement);
        expect(bloc!.includes("<a "), `${nom} (${locale}) : lien LinkedIn`).toBe(a.lien);
      }
    });
  }

  it("⛔ aucune signature ne porte le numéro de téléphone", async () => {
    for (const nom of [...SIGNE_FONDATEUR, ...SIGNE_EQUIPE]) {
      const html = await rendre(nom);
      expect(html, `${nom} affiche le numéro de téléphone`).not.toContain(EMAIL_LEGAL.phone);
      expect(html, `${nom} affiche le numéro de téléphone`).not.toContain(EMAIL_LEGAL.phoneTel);
    }
  });

  it("les signatures héritées gardent le positionnement et la ligne de services, sans OPCO", async () => {
    for (const nom of [...SIGNE_FONDATEUR, ...SIGNE_EQUIPE]) {
      const html = await rendre(nom);
      if (estampille(html, "destinataire") !== null) continue;
      expect(html, nom).toContain("de bout en bout");
      expect(html, nom).toContain("Formation · Coaching 1-to-1");
      expect(html, nom).not.toMatch(/OPCO/i);
    }
  });
});
