/**
 * JUR-T44 (Axion Partners) — le PDF de présentation « Devenir apporteur
 * d'affaires » ne part plus dans AUCUN e-mail.
 *
 * Décision C1 de Williams du 2026-10-01 (option A) : le document contient des
 * formulations relevées par la vérification de bout en bout du chantier
 * Partners ; on le retire tout de suite des e-mails, on le réécrit avec des
 * formulations prudentes (JUR-T45), et seulement ensuite on le remet.
 *
 * Rendu RÉEL : chaque gabarit du registre, dans les deux langues. Le
 * catalogue, lui, reste : il ne porte aucune promesse de gains. La page de
 * remerciement a son propre témoin, à côté d'elle (frontière des modules :
 * `lib/` n'importe pas `app/`) :
 * `src/app/[locale]/apporteur-affaires/merci/__tests__/la-page-merci-ne-lie-plus-le-pdf.spec.tsx`.
 *
 * Fichier `.ts` (et non `.tsx`) parce que le registre Partners le nomme ainsi.
 */
import { describe, it, expect } from "vitest";

import { renderEmailTemplate, EMAIL_TEMPLATE_NAMES } from "@/lib/email/templates";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import {
  DOCUMENT_APPORTEUR_CHEMIN,
  VARIANTE_DOSSIER_COMMENCE,
  liensKitApporteur,
} from "@/lib/commercial-application/kit-apporteur";

/** Le nom du fichier, sans dossier : un autre chemin vers le même PDF reste le PDF. */
const NOM_DU_PDF = DOCUMENT_APPORTEUR_CHEMIN.split("/").pop()!;

/** Texte visible, sans balises ni entités : ce que la personne lit. */
function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/** Annoncer un document qui n'est plus là serait une promesse vide. */
const DOCUMENT_ANNONCE = /document de présentation|presentation document/i;

describe("JUR-T44 — le kit ne porte plus le document de présentation", () => {
  it("liensKitApporteur ne rend plus d'URL du document, et garde le catalogue", () => {
    for (const l of ["fr", "en"] as const) {
      const kit = liensKitApporteur(l, "https://axion-ia.com");
      expect(kit.documentUrl).toBeNull();
      expect(kit.catalogueUrl).toBe(`https://axion-ia.com/${l}/catalogue`);
    }
  });
});

describe("JUR-T44 — aucun e-mail ne lie le PDF de présentation", () => {
  // Les variantes que le payload d'exemple ne déclenche pas seul : le kit du
  // dossier commencé, et l'invitation d'un candidat dont le dossier est arrivé.
  const VARIANTES: ReadonlyArray<Record<string, unknown>> = [
    {},
    { variante: VARIANTE_DOSSIER_COMMENCE },
    { candidature: true },
    { dossierUrl: undefined },
  ];

  for (const nom of EMAIL_TEMPLATE_NAMES) {
    for (const l of ["fr", "en"] as const) {
      it(`${nom} (${l}) : ni lien vers le PDF, ni document annoncé`, async () => {
        for (const v of VARIANTES) {
          const { html } = await renderEmailTemplate(nom, l, { ...PAYLOAD_EXEMPLE, ...v });
          expect(html, `${nom} (${l}) lie encore le PDF`).not.toContain(NOM_DU_PDF);
          expect(texte(html), `${nom} (${l}) annonce encore le document`).not.toMatch(
            DOCUMENT_ANNONCE,
          );
        }
      });
    }
  }
});
