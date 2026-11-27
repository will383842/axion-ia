/**
 * @vitest-environment node
 *
 * La politique de confidentialité décrit le questionnaire du Baromètre 2027.
 */
import { describe, it, expect } from "vitest";
import { LEGAL_PAGES } from "../../legal";
import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
import { RGPD } from "../textes";

function section(locale: "fr" | "en") {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  const s = page?.[locale].sections.find((x) => x.anchor === "questionnaire-barometre-2027");
  expect(s, `section introuvable (${locale})`).toBeTruthy();
  return s!;
}

describe("mentions légales du questionnaire", () => {
  it("la section existe (fr et en) après l'ancre observatoire-ia", () => {
    for (const l of ["fr", "en"] as const) {
      const ancres = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite")![
        l
      ].sections.map((s) => s.anchor);
      expect(ancres.indexOf("questionnaire-barometre-2027")).toBe(
        ancres.indexOf("observatoire-ia") + 1,
      );
    }
  });

  it("cite 24, Cloudflare, « code de retrait » et « ni votre adresse IP »", () => {
    const { body } = section("fr");
    expect(body).toContain("24 mois");
    expect(body).toContain("Cloudflare");
    expect(body).toContain("code de retrait");
    expect(body).toContain("ni votre adresse IP");
  });

  it("désigne le responsable et la page de contact, la CNIL, les droits, Hetzner", () => {
    const { body } = section("fr");
    expect(body).toContain(IDENTITE_LEGALE.legalName);
    expect(body).toContain("/contact");
    expect(body).toContain("CNIL");
    expect(body).toContain("Hetzner");
    expect(body).toMatch(/moins de 10 réponses/);
  });

  it("version anglaise : 24 months, Cloudflare, withdrawal code", () => {
    const { body } = section("en");
    expect(body).toContain("24 months");
    expect(body).toContain("Cloudflare");
    expect(body).toContain("withdrawal code");
  });

  it("la mention affichée sur la page dit la même durée et le même hébergeur", () => {
    const tout = RGPD.map((r) => `${r.titre} ${r.texte}`).join("\n");
    expect(tout).toContain("24 mois");
    expect(tout).toContain("Hetzner (Union européenne)");
    expect(tout).toContain("Turnstile de Cloudflare (États-Unis)");
    expect(tout).toContain("un code de retrait s'affiche une seule fois");
    expect(tout).toContain("article 11 du RGPD");
  });
});
