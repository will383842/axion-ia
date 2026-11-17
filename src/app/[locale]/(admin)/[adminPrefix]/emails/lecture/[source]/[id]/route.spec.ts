// @vitest-environment node

/**
 * Lecture plein écran d'un e-mail enregistré (lot I0b-3). Session et rôle AVANT
 * toute lecture en base ; le corps sort masqué et inerte (CSP `sandbox` sans `allow-`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { emailLogContent: { findUnique: h.findUnique } },
}));

import { GET } from "./route";
import { cspCorpsEmail } from "@/lib/email/apercu-lecteur";

const ID = "11111111-1111-4111-8111-111111111111";
const JETON = "Zq7rT9xWm2LpV4nB8cD6fH1jK3sA5gYe0uIoPlMkNb";
const appel = (source: string, id: string, query = "") =>
  GET(new Request(`https://exemple.invalid/x${query}`), {
    params: Promise.resolve({ adminPrefix: "admin-dev", source, id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example:5432/x");
  h.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
  h.findUnique.mockResolvedValue({
    subject: "Objet",
    html: "<p>Bonjour</p>",
    text: "Bonjour",
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
