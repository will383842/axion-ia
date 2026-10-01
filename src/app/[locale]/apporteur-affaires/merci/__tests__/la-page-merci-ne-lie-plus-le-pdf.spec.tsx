/**
 * JUR-T44 (Axion Partners) — la page de remerciement `/apporteur-affaires/merci`
 * ne lie plus le PDF de présentation, et ne l'annonce plus.
 *
 * Décision C1 de Williams du 2026-10-01 (option A) : le document est retiré
 * jusqu'à sa réécriture (JUR-T45). Le témoin des e-mails vit à côté du kit :
 * `src/lib/commercial-application/__tests__/kit-apporteur-sans-pdf.spec.ts`.
 *
 * Rendu RÉEL de la page (composant serveur résolu, puis HTML statique) : un
 * bouton conditionné mais toujours rendu serait vert à la lecture du source.
 */
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DOCUMENT_APPORTEUR_CHEMIN } from "@/lib/commercial-application/kit-apporteur";

vi.mock("next-intl/server", () => ({ setRequestLocale: () => undefined }));
vi.mock("@/components/recrutement/MerciLeadMeta", () => ({ MerciLeadMeta: () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import Page from "../page";

const NOM_DU_PDF = DOCUMENT_APPORTEUR_CHEMIN.split("/").pop()!;

function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ");
}

describe("JUR-T44 — la page de remerciement ne lie plus le PDF", () => {
  it.each(["fr", "en"])(
    "%s : ni lien vers le PDF, ni document annoncé ; le catalogue reste",
    async (locale) => {
      const h = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale }) }));
      expect(h).not.toContain(NOM_DU_PDF);
      expect(texte(h)).not.toMatch(/document de présentation/i);
      expect(h).toMatch(/\/catalogue"/);
    },
  );
});
