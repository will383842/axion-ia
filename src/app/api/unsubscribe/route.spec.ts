// @vitest-environment node
//
// /api/unsubscribe — trois portes, trois réponses (audit e-mails 2026-09-02).
//
// Ce qui est gardé : le POST One-Click d'un client de messagerie reçoit un 200
// SANS redirection (RFC 8058 § 3.1) ; un GET ne désabonne JAMAIS ; le formulaire
// navigateur garde sa redirection ; la limite de débit tient les trois portes.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const unsubscribeNewsletterAction = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/features/newsletter/actions", () => ({
  unsubscribeNewsletterAction: (...a: unknown[]) => unsubscribeNewsletterAction(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));
const enregistrerOpposition = vi.fn();
vi.mock("@/server/email/opposition", () => ({
  estJetonOpposition: (t: unknown) => typeof t === "string" && t.startsWith("op1."),
  enregistrerOpposition: (...a: unknown[]) => enregistrerOpposition(...a),
}));

import { GET, POST } from "./route";

const BASE = "https://axion-ia.com";

function post(body: string, token?: string, contentType = "application/x-www-form-urlencoded") {
  const url = `${BASE}/api/unsubscribe${token ? `?token=${token}` : ""}`;
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": contentType },
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

describe("porte 1 — POST One-Click (client de messagerie)", () => {
  it("🔴 répond 200 SANS redirection, le jeton pris dans la query", async () => {
    const res = await POST(post("List-Unsubscribe=One-Click", "jeton-abcdefghijklmnop"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(unsubscribeNewsletterAction).toHaveBeenCalledWith("jeton-abcdefghijklmnop");
  });

  it("200 aussi quand la personne était déjà désabonnée (idempotent)", async () => {
    unsubscribeNewsletterAction.mockResolvedValue({
      ok: true,
      alreadyUnsubscribed: true,
      email: "x@y.fr",
    });
    const res = await POST(post("List-Unsubscribe=One-Click", "jeton-abcdefghijklmnop"));
    expect(res.status).toBe(200);
  });

  it("400 sans redirection quand le jeton est inconnu", async () => {
    unsubscribeNewsletterAction.mockResolvedValue({ ok: false, error: "invalid_token" });
    const res = await POST(post("List-Unsubscribe=One-Click", "jeton-inconnu-xxxxxxxx"));
    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("porte 2 — POST formulaire (navigateur)", () => {
  it("désabonne puis redirige vers la page de résultat", async () => {
    const res = await POST(post("token=jeton-abcdefghijklmnop"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/fr/desabonnement?status=ok&already=0`);
    expect(unsubscribeNewsletterAction).toHaveBeenCalledWith("jeton-abcdefghijklmnop");
  });

  it("redirige vers l'échec quand le jeton est inconnu", async () => {
    unsubscribeNewsletterAction.mockResolvedValue({ ok: false, error: "invalid_token" });
    const res = await POST(post("token=jeton-inconnu-xxxxxxxx"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      `${BASE}/fr/desabonnement?status=fail&reason=invalid_token`,
    );
  });
});

describe("porte 3 — GET (un lien ouvert n'est pas un consentement retiré)", () => {
  it("🔴 ne désabonne JAMAIS : il renvoie vers la page de confirmation avec le jeton", async () => {
    const res = await GET(new NextRequest(`${BASE}/api/unsubscribe?token=jeton-abcdefghijklmnop`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      `${BASE}/fr/desabonnement?token=jeton-abcdefghijklmnop`,
    );
    expect(unsubscribeNewsletterAction).not.toHaveBeenCalled();
  });

  it("sans jeton, renvoie vers l'échec explicite", async () => {
    const res = await GET(new NextRequest(`${BASE}/api/unsubscribe`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      `${BASE}/fr/desabonnement?status=fail&reason=missing_token`,
    );
    expect(unsubscribeNewsletterAction).not.toHaveBeenCalled();
  });
});

describe("limite de débit", () => {
  it("429 sur les trois portes quand l'adresse IP dépasse la limite, sans toucher à l'action", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const r1 = await POST(post("List-Unsubscribe=One-Click", "jeton-abcdefghijklmnop"));
    const r2 = await POST(post("token=jeton-abcdefghijklmnop"));
    const r3 = await GET(new NextRequest(`${BASE}/api/unsubscribe?token=jeton-abcdefghijklmnop`));
    expect([r1.status, r2.status, r3.status]).toEqual([429, 429, 429]);
    expect(unsubscribeNewsletterAction).not.toHaveBeenCalled();
  });

  it("la clé de débit est par adresse IP", async () => {
    await GET(
      new NextRequest(`${BASE}/api/unsubscribe?token=jeton-abcdefghijklmnop`, {
        headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
      }),
    );
    expect(checkRateLimit).toHaveBeenCalledWith(
      "unsubscribe:203.0.113.9",
      expect.objectContaining({ windowSec: 60 }),
    );
  });
});

describe("jeton d'opposition (lot 1b) — même porte, autre registre", () => {
  it("🔴 un jeton `op1.` enregistre une OPPOSITION, pas un désabonnement newsletter", async () => {
    const res = await POST(post("List-Unsubscribe=One-Click", "op1.abc.def"));
    expect(res.status).toBe(200);
    expect(enregistrerOpposition).toHaveBeenCalledWith("op1.abc.def");
    expect(unsubscribeNewsletterAction).not.toHaveBeenCalled();
  });

  it("depuis le formulaire, redirige vers le résultat comme la newsletter", async () => {
    enregistrerOpposition.mockResolvedValue({ ok: true, email: "x@y.fr", dejaOpposee: true });
    const res = await POST(post("token=op1.abc.def"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/fr/desabonnement?status=ok&already=1`);
  });

  it("un jeton d'opposition forgé rend 400 en un clic", async () => {
    enregistrerOpposition.mockResolvedValue({ ok: false, error: "invalid_token" });
    const res = await POST(post("List-Unsubscribe=One-Click", "op1.forge.xxx"));
    expect(res.status).toBe(400);
  });
});
