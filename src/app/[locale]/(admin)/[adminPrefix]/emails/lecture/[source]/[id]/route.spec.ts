// @vitest-environment node

/**
 * Lecture plein écran d'un e-mail enregistré (lot I0b-3). Session et rôle AVANT
 * toute lecture en base ; le corps sort masqué et inerte (CSP `sandbox` sans `allow-`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  logCreate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLogContent: { findUnique: h.findUnique },
    activityLog: { create: h.logCreate },
  },
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));

import { GET } from "./route";
import { cspCorpsEmail } from "@/lib/email/apercu-lecteur";

const ID = "11111111-1111-4111-8111-111111111111";
const JETON = "Zq7rT9xWm2LpV4nB8cD6fH1jK3sA5gYe0uIoPlMkNb";
const PREFIXE = "pfx-test";
const appel = (source: string, id: string, query = "", adminPrefix = PREFIXE, locale = "fr") =>
  GET(
    new Request(
      `https://exemple.invalid/${locale}/${adminPrefix}/emails/lecture/${source}/${id}${query}`,
    ),
    { params: Promise.resolve({ locale, adminPrefix, source, id }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_URL_PREFIX", PREFIXE);
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example:5432/x");
  h.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
  h.findUnique.mockResolvedValue({
    subject: "Objet",
    html: "<p>Bonjour</p>",
    text: "Bonjour",
  });
});

describe("préfixe d'administration", () => {
  it("0) mauvais préfixe : 404, auth jamais appelé, aucune lecture en base", async () => {
    for (const p of ["zzz", "", "PFX-TEST", `${PREFIXE}x`, "emails"]) {
      const r = await appel("envoye", ID, "", p);
      expect(r.status).toBe(404);
      expect(await r.text()).toBe("");
    }
    expect(h.auth).not.toHaveBeenCalled();
    expect(h.findUnique).not.toHaveBeenCalled();
    expect(h.logCreate).not.toHaveBeenCalled();
  });
});

describe("locale (second tour d'audit, constat A)", () => {
  it("locales exclues du matcher du proxy : 404, auth jamais appelé, aucune lecture", async () => {
    for (const l of ["questionnaire", "document", "videos", "api", "sitemap", "widget", "zz"]) {
      const r = await appel("envoye", ID, "", PREFIXE, l);
      expect(r.status).toBe(404);
      expect(await r.text()).toBe("");
    }
    expect(h.auth).not.toHaveBeenCalled();
    expect(h.findUnique).not.toHaveBeenCalled();
    expect(h.logCreate).not.toHaveBeenCalled();
  });

  it("contrôle de locale isolé : URL en /fr/ mais params.locale invalide : 404, auth et base jamais appelés", async () => {
    const r = await GET(
      new Request(`https://exemple.invalid/fr/${PREFIXE}/emails/lecture/envoye/${ID}`),
      {
        params: Promise.resolve({
          locale: "questionnaire",
          adminPrefix: PREFIXE,
          source: "envoye",
          id: ID,
        }),
      },
    );
    expect(r.status).toBe(404);
    expect(h.auth).not.toHaveBeenCalled();
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it("fr et en avec le bon préfixe : servi comme avant", async () => {
    for (const l of ["fr", "en"])
      expect((await appel("envoye", ID, "", PREFIXE, l)).status).toBe(200);
  });

  it("chemin non couvert par le proxy (même avec une locale valide dans params) : 404 avant auth", async () => {
    const r = await GET(
      new Request(`https://exemple.invalid/questionnaire/${PREFIXE}/emails/lecture/envoye/${ID}`),
      {
        params: Promise.resolve({ locale: "fr", adminPrefix: PREFIXE, source: "envoye", id: ID }),
      },
    );
    expect(r.status).toBe(404);
    expect(h.auth).not.toHaveBeenCalled();
    expect(h.findUnique).not.toHaveBeenCalled();
  });
});

describe("garde : session et rôle avant toute lecture", () => {
  it("1) sans session : 401, base jamais lue", async () => {
    h.auth.mockResolvedValue(null);
    const r = await appel("envoye", ID);
    expect(r.status).toBe(401);
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it("2) rôle hors peutConsulter : 403, base jamais lue", async () => {
    h.auth.mockResolvedValue({ user: { id: "u1", role: "n_importe_quoi" } });
    const r = await appel("envoye", ID);
    expect(r.status).toBe(403);
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it("3) source inconnue ou identifiant mal formé : 404 sans appel Prisma", async () => {
    expect((await appel("inconnue", ID)).status).toBe(404);
    expect((await appel("envoye", "pas-un-uuid")).status).toBe(404);
    expect((await appel("gabarit", "../../etc/passwd")).status).toBe(404);
    expect((await appel("constructor", ID)).status).toBe(404);
    expect(h.findUnique).not.toHaveBeenCalled();
  });
});

describe("source « envoye »", () => {
  it("4) copie présente : 200 et les en-têtes exacts", async () => {
    const r = await appel("envoye", ID);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    const csp = r.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toBe(
      `sandbox; default-src 'none'; img-src data: ${cspCorpsEmail()}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    );
    expect(csp.startsWith("sandbox")).toBe(true);
    expect(csp).not.toContain("allow-");
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(r.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(r.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await r.text()).toContain("Bonjour");
  });

  it("4b) une copie ancienne non masquée sort masquée, sans jeton", async () => {
    h.findUnique.mockResolvedValue({
      subject: "Objet",
      html: `<a href="https://axion-ia.com/fr/opposition?token=${JETON}">Ne plus recevoir</a>`,
      text: "",
    });
    const corps = await (await appel("envoye", ID)).text();
    expect(corps).not.toContain(JETON);
    expect(corps).toContain("[masqué]");
  });

  it("4c) un lien du corps n'est plus cliquable", async () => {
    h.findUnique.mockResolvedValue({
      subject: "o",
      html: '<a href="https://exemple.fr/x">Lien</a>',
      text: "",
    });
    const corps = await (await appel("envoye", ID)).text();
    expect(corps).not.toMatch(/href\s*=/i);
    expect(corps).toContain("Lien");
  });

  it("4d) copie sans HTML : texte échappé dans un <pre> ; sans texte non plus : 404", async () => {
    h.findUnique.mockResolvedValue({ subject: "o", html: "", text: "a <b> c" });
    const r = await appel("envoye", ID);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("<pre");
    h.findUnique.mockResolvedValue({ subject: "o", html: "", text: "" });
    expect((await appel("envoye", ID)).status).toBe(404);
  });

  it("4e) trace d'accès sans donnée de personne ; une panne du journal ne bloque pas", async () => {
    await appel("envoye", ID);
    expect(h.logCreate).toHaveBeenCalledTimes(1);
    const data = h.logCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      adminUserId: "u1",
      action: "email.lecture_plein_ecran",
      targetId: ID,
    });
    expect(JSON.stringify(data)).not.toContain("Bonjour");
    h.logCreate.mockRejectedValue(new Error("journal HS"));
    expect((await appel("envoye", ID)).status).toBe(200);
  });

  it("5) sans copie : 404 avec une phrase", async () => {
    h.findUnique.mockResolvedValue(null);
    const r = await appel("envoye", ID);
    expect(r.status).toBe(404);
    expect((await r.text()).length).toBeGreaterThan(10);
  });
});

describe("source « gabarit »", () => {
  it("6) inconnu : 404", async () => {
    expect((await appel("gabarit", "gabarit-qui-n-existe-pas")).status).toBe(404);
  });

  it("6b) connu : rendu de l'exemple, mêmes en-têtes", async () => {
    const r = await appel("gabarit", "submission-reply");
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Security-Policy")?.startsWith("sandbox;")).toBe(true);
    expect((await r.text()).toLowerCase()).toContain("<html");
    expect(h.findUnique).not.toHaveBeenCalled();
  });
});
