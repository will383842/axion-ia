// 2026-09-27 — information art. 14 des organisateurs d'événements
// professionnels. Les premiers messages renvoient à
// `/fr/politique-confidentialite#organisateurs-evenements` (et à
// `/en/privacy-policy#organisateurs-evenements`) : l'ancre ne doit pas
// bouger, et le texte ne doit ni chiffrer la conservation (décision du
// responsable de traitement) ni nommer un prestataire d'envoi qui n'achemine
// pas ces messages.
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LEGAL_PAGES } from "@/content/legal";
import { LegalPageTemplate } from "@/components/sections/LegalPageTemplate";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const ANCRE = "organisateurs-evenements";

function section(locale: "fr" | "en") {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  const trouvees = page?.[locale].sections.filter((s) => s.anchor === ANCRE) ?? [];
  expect(trouvees).toHaveLength(1);
  return trouvees[0] as { title: string; body: string; anchor?: string };
}

describe("politique de confidentialité — organisateurs d'événements", () => {
  it("la section existe en FR et en EN, sous l'ancre stable", () => {
    expect(section("fr").title).toBe("Organisateurs d'événements professionnels");
    expect(section("en").title).toBe("Professional event organisers");
  });

  it("dit la source, la base légale, l'art. 14 et le droit d'opposition", () => {
    const fr = section("fr").body;
    expect(fr).toMatch(/pages publiques/);
    expect(fr).toMatch(/Aucune donnée n'est achetée/);
    expect(fr).toMatch(/6\.1\.f/);
    expect(fr).toMatch(/art\. 14/);
    expect(fr).toMatch(/STOP/);
    expect(fr).toMatch(/CNIL/);
    const en = section("en").body;
    expect(en).toMatch(/public pages only/);
    expect(en).toMatch(/6\.1\.f/);
    expect(en).toMatch(/art\. 14/);
    expect(en).toMatch(/STOP/);
  });

  it("ne chiffre aucune durée, ne nomme pas ZeptoMail, ne donne aucun numéro", () => {
    for (const locale of ["fr", "en"] as const) {
      const body = section(locale).body;
      expect(body).not.toMatch(/\d+\s*(mois|ans?|jours|months?|years?|days)\b/i);
      expect(body).not.toMatch(/zeptomail/i);
      expect(body).not.toMatch(/(\+33|\b0[1-9])([\s.]?\d{2}){4}/);
    }
  });

  it("la page rendue porte bien l'identifiant, et les autres ancres ne bougent pas", () => {
    const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
    for (const locale of ["fr", "en"] as const) {
      const copy = page?.[locale];
      if (!copy) throw new Error("politique introuvable");
      const html = renderToStaticMarkup(
        <LegalPageTemplate
          isFr={locale === "fr"}
          title={copy.title}
          intro={copy.intro}
          sections={copy.sections}
        />,
      );
      expect(html).toContain(`id="${ANCRE}"`);
      expect(html).toContain(`href="#${ANCRE}"`);
      // Ancre dérivée du titre, citée par l'invitation apporteur : inchangée.
      expect(html).toContain(
        locale === "fr"
          ? 'id="reseau-d-apporteurs-d-affaires"'
          : 'id="business-introducer-network"',
      );
    }
  });
});
