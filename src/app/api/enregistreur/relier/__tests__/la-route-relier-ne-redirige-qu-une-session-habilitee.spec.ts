/**
 * `GET /api/enregistreur/relier?nonce=<32 hex>` — la liaison automatique
 * extension ↔ console (extension 1.4.0, demande de Williams du 02/10).
 *
 *   · sans session, ou avec un rôle qui ne voit pas les échanges : 404, SANS
 *     `Location` (le préfixe de la console ne fuit jamais) ;
 *   · session habilitée (A2) : 302 vers `rendez-vous/enregistreur?relier=<nonce>` ;
 *   · nonce absent ou mal formé : 404 ;
 *   · la liaison marche MÊME drapeau d'enregistrement fermé (c'est la mise en
 *     service du poste) ; la garde de rôle, elle, reste.
 *
 * Mutation qui rougit : retirer `peutVoirLesEchanges(role)` → le 2e cas rend 302.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));

import { GET, OPTIONS } from "../route";

const NONCE = "0123456789abcdef0123456789abcdef";
const req = (q: string) => new Request(`https://axion-ia.com/api/enregistreur/relier${q}`);

describe("la route « relier » ne redirige qu'une session habilitée", () => {
  beforeEach(() => {
    delete process.env["DATABASE_URL"];
    delete process.env["ENREGISTREMENT_VISIO_PILOTE"];
    delete process.env["ENREGISTREMENT_VISIO_OUVERT"];
    process.env["ADMIN_URL_PREFIX"] = "console-secrete";
    d.session = null;
  });

  it("sans session : 404 sans Location", async () => {
    const r = await GET(req(`?nonce=${NONCE}`));
    expect(r.status).toBe(404);
    expect(r.headers.get("location")).toBeNull();
    expect(await r.text()).not.toContain("console-secrete");
  });

  it("rôle sans accès aux échanges : 404 sans Location", async () => {
    d.session = { user: { id: "u", role: "editor" } };
    const r = await GET(req(`?nonce=${NONCE}`));
    expect(r.status).toBe(404);
    expect(r.headers.get("location")).toBeNull();
  });

  it("session habilitée, drapeau FERMÉ : 302 vers la page Enregistreur avec le nonce", async () => {
    d.session = { user: { id: "u", role: "super_admin" } };
    const r = await GET(req(`?nonce=${NONCE}`));
    expect(r.status).toBe(302);
    const lieu = r.headers.get("location") ?? "";
    expect(lieu).toMatch(/\/rendez-vous\/enregistreur\?relier=0123456789abcdef0123456789abcdef$/);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["", "?nonce=", "?nonce=pas-un-nonce", `?nonce=${NONCE}0`, `?nonce=${"A".repeat(32)}`])(
    "nonce invalide (%s) : 404",
    async (q) => {
      d.session = { user: { id: "u", role: "super_admin" } };
      const r = await GET(req(q));
      expect(r.status).toBe(404);
      expect(r.headers.get("location")).toBeNull();
    },
  );

  it("OPTIONS : 405", () => {
    expect(OPTIONS().status).toBe(405);
  });
});
