// @vitest-environment node
// Registre des sources de la lecture plein écran (lot I0b-3) : un registre, pas des `if`.
import { describe, expect, it } from "vitest";
import { VARIANTES_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
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

  it("animation SVG qui pose un href (constat C1) : servi en <pre> échappé", () => {
    for (const html of [
      '<svg><a><set attributeName="href" to="https://evil.example/"/><text pointer-events="auto">Voir</text></a></svg>',
      "<p>x</p><MATH><mi>y</mi></MATH>",
      '<a><animate attributeName="href" values="https://evil.example/"/></a>',
      "<a><ANIMATETRANSFORM/></a>",
      "<a><set\nATTRIBUTENAME = 'href'/></a>",
    ]) {
      const c = corpsServi({ subject: "s", html, text: "" })!;
      expect(c).toContain("<pre");
      expect(c).not.toMatch(/<(?:svg|math|set|animate)/i);
    }
  });

  it("aucun gabarit du catalogue (ni aucune variante d'exemple) ne tombe en <pre>", async () => {
    const { testes, ignores } = await gabaritCharger();
    // Aucun gabarit ignoré en silence : tout le catalogue est parcouru, sauf liste explicite.
    expect(ignores).toEqual([]);
    const attendus = Object.keys(CATALOGUE).filter((n) => !SANS_HTML.includes(n));
    expect(
      testes
        .map(([nom]) => nom.split("?")[0])
        .filter((n, i, a) => a.indexOf(n) === i)
        .sort(),
    ).toEqual([...attendus].sort());
    expect(testes.length).toBeGreaterThanOrEqual(attendus.length);
    for (const [nom, html] of testes) expect([nom, html.includes("<pre")]).toEqual([nom, false]);
  });
});

// Gabarits rendus SANS HTML (texte seul), servis en <pre> depuis toujours : aucun pour l'instant.
// Toute entrée ajoutée ici doit être justifiée par un commentaire.
const SANS_HTML: string[] = [];

async function gabaritCharger(): Promise<{ testes: [string, string][]; ignores: string[] }> {
  const g = SOURCES_LECTURE["gabarit"]!;
  const testes: [string, string][] = [];
  const ignores: string[] = [];
  for (const nom of Object.keys(CATALOGUE) as EmailJobName[]) {
    if (SANS_HTML.includes(nom)) continue;
    const variantes = [undefined, ...Object.keys(VARIANTES_EXEMPLE[nom] ?? {})];
    for (const v of variantes) {
      const etiquette = v === undefined ? nom : `${nom}?${v}`;
      try {
        const r = await g.charger(nom, { variante: v });
        if (r.ok) testes.push([etiquette, r.html]);
        else ignores.push(etiquette);
      } catch {
        ignores.push(etiquette);
      }
    }
  }
  return { testes, ignores };
}
