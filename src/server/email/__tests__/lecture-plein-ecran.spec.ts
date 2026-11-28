// @vitest-environment node
// Registre des sources de la lecture plein écran (lot I0b-3) : un registre, pas des `if`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  subFindUnique: vi.fn(),
  jobFindUnique: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submissionReply: { findUnique: h.subFindUnique },
    jobApplicationReply: { findUnique: h.jobFindUnique },
    emailLogContent: { findUnique: vi.fn() },
    activityLog: { create: vi.fn() },
  },
}));
import { VARIANTES_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import type { EmailJobName } from "@/server/queue/types";
import { CATALOGUE } from "@/server/email/apercu/catalogue";
import { SOURCES_LECTURE, corpsServi, enTetesLecturePleinEcran } from "../lecture-plein-ecran";
import { GET } from "@/app/[locale]/(admin)/[adminPrefix]/emails/lecture/[source]/[id]/route";

describe("registre des sources", () => {
  it("contient envoye, gabarit et les deux réponses écrites à la main, chacun avec sa garde de rôle et de forme d'identifiant", () => {
    expect(Object.keys(SOURCES_LECTURE).sort()).toEqual([
      "envoye",
      "gabarit",
      "reponse-candidature",
      "reponse-demande",
    ]);
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

// ─── I3-1 : sources `reponse-demande` et `reponse-candidature` ──────────────────────────────
describe("I3-1 : réponses écrites à la main au registre", () => {
  const ID = "cm0abcdefghijklmnopqrstuv";
  const JETON = "Zq7rT9xWm2LpV4nB8cD6fH1jK3sA5gYe0uIoPlMkNb";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example:5432/x");
    vi.stubEnv("ADMIN_URL_PREFIX", "pfx-test");
  });

  it("droits : reader lit une réponse de demande, jamais une réponse de candidat", () => {
    expect(SOURCES_LECTURE["reponse-demande"]!.habilite("reader")).toBe(true);
    expect(SOURCES_LECTURE["reponse-candidature"]!.habilite("reader")).toBe(false);
    expect(SOURCES_LECTURE["reponse-candidature"]!.habilite("admin")).toBe(true);
    for (const n of ["reponse-demande", "reponse-candidature"]) {
      expect(SOURCES_LECTURE[n]!.habilite(undefined)).toBe(false);
      expect(SOURCES_LECTURE[n]!.habilite(null)).toBe(false);
    }
  });

  it("forme d'identifiant : un cuid, rien d'autre", () => {
    for (const n of ["reponse-demande", "reponse-candidature"]) {
      expect(SOURCES_LECTURE[n]!.idValide(ID)).toBe(true);
      expect(SOURCES_LECTURE[n]!.idValide("../x")).toBe(false);
      expect(SOURCES_LECTURE[n]!.idValide("")).toBe(false);
      expect(SOURCES_LECTURE[n]!.idValide("a b")).toBe(false);
    }
  });

  it("le corps servi est MASQUÉ : le jeton d'opposition stocké n'en sort jamais", async () => {
    h.subFindUnique.mockResolvedValue({
      subject: "Objet",
      bodyHtml: `<p>Salut</p><a href="https://axion-ia.com/opposition?t=${JETON}">Se désinscrire</a>`,
      bodyText: `Salut https://axion-ia.com/opposition?t=${JETON}`,
    });
    const r = await SOURCES_LECTURE["reponse-demande"]!.charger(ID, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).not.toContain(JETON);
      expect(r.html).not.toMatch(/href\s*=/i);
      expect(r.html).toContain("Se désinscrire");
    }
  });

  it("identifiant inconnu : phrase d'échec, pas d'exception", async () => {
    h.jobFindUnique.mockResolvedValue(null);
    const r = await SOURCES_LECTURE["reponse-candidature"]!.charger(ID, {});
    expect(r.ok).toBe(false);
  });

  const appel = (source: string) =>
    GET(new Request(`https://exemple.invalid/fr/pfx-test/emails/lecture/${source}/${ID}`), {
      params: Promise.resolve({
        locale: "fr",
        adminPrefix: "pfx-test",
        source,
        id: ID,
      }),
    });

  it("7) route plein écran : reponse-candidature avec reader → 403, base jamais lue", async () => {
    h.auth.mockResolvedValue({ user: { id: "u1", role: "reader" } });
    const r = await appel("reponse-candidature");
    expect(r.status).toBe(403);
    expect(h.jobFindUnique).not.toHaveBeenCalled();
  });

  it("route plein écran : reponse-demande avec reader → 200, corps masqué", async () => {
    h.auth.mockResolvedValue({ user: { id: "u1", role: "reader" } });
    h.subFindUnique.mockResolvedValue({
      subject: "Objet",
      bodyHtml: `<p>Salut</p><a href="https://axion-ia.com/opposition?t=${JETON}">x</a>`,
      bodyText: "Salut",
    });
    const r = await appel("reponse-demande");
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain(JETON);
  });
});
