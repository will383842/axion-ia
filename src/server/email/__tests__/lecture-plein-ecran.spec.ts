// @vitest-environment node
// Registre des sources de la lecture plein écran (lot I0b-3) : un registre, pas des `if`.
import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "@/lib/email/templates";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import type { EmailJobName } from "@/server/queue/types";
import { CATALOGUE } from "@/server/email/apercu/catalogue";
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

describe("échec fermé : un lien ou une redirection survit (audit I0b-3, B et C)", () => {
  const actif = /<(a\b|area\b|form\b|meta\s+http-equiv)/i;

  it('<a x=a"b href=…> : servi en <pre> échappé, aucune balise active', () => {
    const c = corpsServi({
      subject: "s",
      html: '<a x=a"b href=https://evil.example/>clic</a>',
      text: "",
    })!;
    expect(c).toContain("<pre");
    expect(c).not.toMatch(actif);
    expect(c).toContain("&lt;a ");
  });

  it('<meta http-equiv="refresh"> : servi en <pre> échappé', () => {
    const c = corpsServi({
      subject: "s",
      html: '<meta http-equiv="refresh" content="0;url=https://evil.example"><p>x</p>',
      text: "",
    })!;
    expect(c).toContain("<pre");
    expect(c).not.toMatch(actif);
  });

  it("un e-mail normal : HTML servi, feuille d'inertie ajoutée", () => {
    const c = corpsServi({ subject: "s", html: "<p>Bonjour</p>", text: "" })!;
    expect(c).not.toContain("<pre");
    expect(c).toContain("pointer-events:none");
  });

  it("aucun gabarit du catalogue ne tombe en <pre>", async () => {
    const r = await gabaritCharger();
    expect(r.length).toBeGreaterThan(0);
    for (const [nom, html] of r) expect([nom, html.includes("<pre")]).toEqual([nom, false]);
  });
});

async function gabaritCharger(): Promise<[string, string][]> {
  const g = SOURCES_LECTURE["gabarit"]!;
  const sortie: [string, string][] = [];
  for (const nom of Object.keys(CATALOGUE) as EmailJobName[]) {
    // Un gabarit qui rend SANS HTML (texte seul) est servi en <pre> depuis toujours : hors sujet ici.
    const brut = await renderEmailTemplate(nom, "fr", { ...PAYLOAD_EXEMPLE }).catch(() => null);
    if (!brut || brut.html.trim() === "") continue;
    const r = await g.charger(nom, {});
    if (r.ok) sortie.push([nom, r.html]);
  }
  return sortie;
}
