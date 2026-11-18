// @vitest-environment node
//
// Plus de jeton dans l'URL de `/desabonnement` (plan « jeton op2 », J2).
//
// Pourquoi : Plausible (toutes les pages), puis Clarity / Meta / LinkedIn après accord,
// voient l'URL COMPLÈTE de la page. Le jeton voyage donc désormais dans un cookie court
// `__Host-`, posé par le GET et effacé après traitement. Ce qui ne bouge pas : le GET
// n'agit jamais ; le One-Click (RFC 8058) garde le jeton dans l'URL de l'en-tête.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const unsubscribeNewsletterAction = vi.fn();
const checkRateLimit = vi.fn();
const enregistrerOpposition = vi.fn();

vi.mock("@/features/newsletter/actions", () => ({
  unsubscribeNewsletterAction: (...a: unknown[]) => unsubscribeNewsletterAction(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));
vi.mock("@/server/email/opposition", () => ({
  estJetonOpposition: (t: unknown) =>
    typeof t === "string" && (t.startsWith("op1.") || t.startsWith("op2.")),
  enregistrerOpposition: (...a: unknown[]) => enregistrerOpposition(...a),
}));

import { GET, POST } from "../route";

const BASE = "https://axion-ia.com";
const COOKIE = "__Host-axion-desinscription";

function post(body: string, opts: { token?: string; cookie?: string } = {}) {
  return new NextRequest(`${BASE}/api/unsubscribe${opts.token ? `?token=${opts.token}` : ""}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(opts.cookie ? { cookie: `${COOKIE}=${encodeURIComponent(opts.cookie)}` } : {}),
    },
    body,
  });
}

beforeEach(() => {
  unsubscribeNewsletterAction
    .mockReset()
    .mockResolvedValue({ ok: true, alreadyUnsubscribed: false, email: "x@y.fr" });
  checkRateLimit.mockReset().mockResolvedValue({ allowed: true });
  enregistrerOpposition
    .mockReset()
    .mockResolvedValue({ ok: true, email: "x@y.fr", dejaOpposee: false });
  process.env["NEXT_PUBLIC_SITE_URL"] = BASE;
});

describe("GET — le jeton passe dans un cookie, pas dans l'URL", () => {
  it("🔴 303 vers la page SANS paramètre, avec un cookie __Host- court", async () => {
    const res = await GET(new NextRequest(`${BASE}/api/unsubscribe?token=op2.k1.abcdef`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/fr/desabonnement`);
    expect(res.headers.get("location")).not.toContain("token");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Max-Age=900");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toMatch(/Domain=/i);
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("n'agit jamais : aucun enregistrement, aucune différence bon/mauvais jeton", async () => {
    const bon = await GET(new NextRequest(`${BASE}/api/unsubscribe?token=op2.k1.abcdef`));
    const mauvais = await GET(new NextRequest(`${BASE}/api/unsubscribe?token=nimporte-quoi`));
    expect(bon.headers.get("location")).toBe(mauvais.headers.get("location"));
    expect(enregistrerOpposition).not.toHaveBeenCalled();
    expect(unsubscribeNewsletterAction).not.toHaveBeenCalled();
  });

  it("sans jeton → 303 missing_token, pas de cookie", async () => {
    const res = await GET(new NextRequest(`${BASE}/api/unsubscribe`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      `${BASE}/fr/desabonnement?status=fail&reason=missing_token`,
    );
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("un jeton démesuré n'est pas posé en cookie → échec invalid_token", async () => {
    const res = await GET(new NextRequest(`${BASE}/api/unsubscribe?token=${"a".repeat(2000)}`));
    expect(res.headers.get("location")).toBe(
      `${BASE}/fr/desabonnement?status=fail&reason=invalid_token`,
    );
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("POST formulaire — le cookie fait office de corps", () => {
  it("🔴 sans corps mais avec le cookie : enregistre, 303 ok, cookie effacé", async () => {
    const res = await POST(post("", { cookie: "op2.k1.abcdef" }));
    expect(enregistrerOpposition).toHaveBeenCalledWith("op2.k1.abcdef");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/fr/desabonnement?status=ok&already=0`);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE}=;`);
    expect(cookie).toContain("Max-Age=0");
  });

  it("le corps l'emporte sur le cookie (ordre : corps puis cookie)", async () => {
    await POST(post("token=op1.corps.sig", { cookie: "op2.k1.abcdef" }));
    expect(enregistrerOpposition).toHaveBeenCalledWith("op1.corps.sig");
  });

  it("🔴 échec : le cookie est effacé aussi", async () => {
    enregistrerOpposition.mockResolvedValue({ ok: false, error: "invalid_token" });
    const res = await POST(post("", { cookie: "op2.k1.forge" }));
    expect(res.headers.get("location")).toBe(
      `${BASE}/fr/desabonnement?status=fail&reason=invalid_token`,
    );
    expect(res.headers.get("set-cookie") ?? "").toContain("Max-Age=0");
  });

  it("ni corps ni cookie → missing_token, cookie effacé sans danger", async () => {
    unsubscribeNewsletterAction.mockResolvedValue({ ok: false, error: "missing_token" });
    const res = await POST(post(""));
    expect(res.headers.get("location")).toBe(
      `${BASE}/fr/desabonnement?status=fail&reason=missing_token`,
    );
  });
});

describe("One-Click (RFC 8058) — inchangé", () => {
  it("200, AUCUN Set-Cookie, jeton lu dans la requête (jamais dans le cookie)", async () => {
    const res = await POST(
      post("List-Unsubscribe=One-Click", { token: "op2.k1.abcdef", cookie: "op1.autre.sig" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(enregistrerOpposition).toHaveBeenCalledWith("op2.k1.abcdef");
  });
});
