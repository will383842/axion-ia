// @vitest-environment node
// Registre des sources de la lecture plein écran (lot I0b-3) : un registre, pas des `if`.
import { describe, expect, it } from "vitest";
import { SOURCES_LECTURE, corpsServi, enTetesLecturePleinEcran } from "../lecture-plein-ecran";

describe("registre des sources", () => {
  it("contient envoye et gabarit, chacun avec sa garde de rôle et de forme d'identifiant", () => {
    expect(Object.keys(SOURCES_LECTURE).sort()).toEqual(["envoye", "gabarit"]);
    for (const s of Object.values(SOURCES_LECTURE)) {
      expect(typeof s.habilite).toBe("function");
      expect(typeof s.idValide).toBe("function");
    }
  });

  it("envoye n'accepte qu'un UUID ; gabarit refuse un nom hors catalogue", () => {
    expect(SOURCES_LECTURE["envoye"]!.idValide("x")).toBe(false);
    expect(SOURCES_LECTURE["envoye"]!.idValide("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(SOURCES_LECTURE["gabarit"]!.idValide("nom-inconnu")).toBe(false);
    expect(SOURCES_LECTURE["gabarit"]!.idValide("submission-reply")).toBe(true);
  });

  it("ni lecteur simple ni anonyme ne sont habilités à rien qu'ils ne devraient", () => {
    for (const s of Object.values(SOURCES_LECTURE)) {
      expect(s.habilite(undefined)).toBe(false);
      expect(s.habilite("inconnu")).toBe(false);
    }
  });
});

describe("en-têtes", () => {
  it("six en-têtes, CSP sandbox sans allow-", () => {
    const e = enTetesLecturePleinEcran();
    expect(Object.keys(e).sort()).toEqual(
      [
        "Cache-Control",
        "Content-Security-Policy",
        "Content-Type",
        "Referrer-Policy",
        "X-Content-Type-Options",
        "X-Robots-Tag",
      ].sort(),
    );
    expect(e["Content-Security-Policy"]).not.toContain("allow-");
  });
});

describe("corpsServi", () => {
  it("un <a href> du corps n'est plus cliquable", () => {
    const c = corpsServi({
      subject: "s",
      html: '<p><a href="https://exemple.fr/x">Lien</a></p>',
      text: "",
    });
    expect(c).not.toBeNull();
    expect(c).not.toMatch(/href\s*=/i);
    expect(c).toContain("Lien");
  });

  it("sans HTML : le texte échappé dans un <pre>", () => {
    const c = corpsServi({
      subject: "s",
      html: "  ",
      text: "Bonjour <script>alert(1)</script> & merci",
    });
    expect(c).toContain("<pre");
    expect(c).not.toContain("<script>");
    expect(c).toContain("&lt;script&gt;");
    expect(c).toContain("&amp; merci");
  });

  it("sans HTML ni texte : null", () => {
    expect(corpsServi({ subject: "s", html: "", text: " " })).toBeNull();
  });
});
