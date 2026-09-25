// @vitest-environment node
//
// /api/newsletter/confirmer et la page de confirmation (lot L2) : un GET ne
// confirme JAMAIS ; seul le POST du bouton le fait, puis redirige (303).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const confirmerLettre = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/server/newsletter/confirmer", () => ({
  confirmerLettre: (...a: unknown[]) => confirmerLettre(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));

import * as route from "./route";

const BASE = "https://axion-ia.com";
const JETON = "c".repeat(64);

function post(body: string): NextRequest {
  return new NextRequest(`${BASE}/api/newsletter/confirmer`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "Navigateur",
      "x-forwarded-for": "192.0.2.1",
    },
    body,
  });
}

beforeEach(() => {
  confirmerLettre
    .mockReset()
    .mockResolvedValue({ ok: true, alreadyConfirmed: false, locale: "fr" });
  checkRateLimit.mockReset().mockResolvedValue({ allowed: true });
  process.env["NEXT_PUBLIC_SITE_URL"] = BASE;
});

describe("POST /api/newsletter/confirmer", () => {
  it("confirme avec l'IP et l'agent de la requête, puis 303 vers le résultat", async () => {
    const res = await route.POST(post(`token=${JETON}&locale=fr`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${BASE}/fr/confirmation/newsletter?statut=ok`);
    expect(confirmerLettre).toHaveBeenCalledWith(JETON, {
      ip: "192.0.2.1",
      userAgent: "Navigateur",
    });
  });

  it("déjà confirmé : statut=deja", async () => {
    confirmerLettre.mockResolvedValue({ ok: true, alreadyConfirmed: true, locale: "en" });
    const res = await route.POST(post(`token=${JETON}&locale=en`));
    expect(res.headers.get("location")).toBe(`${BASE}/en/confirmation/newsletter?statut=deja`);
  });

  it("échec : le code d'erreur voyage, dans la langue du formulaire", async () => {
    confirmerLettre.mockResolvedValue({ ok: false, error: "invalid_token" });
    const res = await route.POST(post(`token=${JETON}&locale=fr`));
    expect(res.headers.get("location")).toBe(
      `${BASE}/fr/confirmation/newsletter?statut=invalid_token`,
    );
  });

  it("limite de débit : 429, sans confirmer", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await route.POST(post(`token=${JETON}`))).status).toBe(429);
    expect(confirmerLettre).not.toHaveBeenCalled();
  });

  it("🔴 la route n'expose AUCUN GET : un lien ouvert n'est pas un consentement", () => {
    expect((route as Record<string, unknown>)["GET"]).toBeUndefined();
  });
});

describe("🔴 la page de confirmation ne confirme rien au rendu (GET)", () => {
  // Sans les commentaires : ils racontent l'ancien défaut, et le nomment.
  const page = readFileSync(
    join(process.cwd(), "src/app/[locale]/confirmation/newsletter/page.tsx"),
    "utf8",
  )
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("n'appelle aucune fonction de confirmation", () => {
    expect(page).not.toMatch(/confirmNewsletterAction|confirmerLettre/);
  });

  it("porte un formulaire POST vers la route de confirmation", () => {
    expect(page).toMatch(/action="\/api\/newsletter\/confirmer"\s+method="POST"/);
  });

  it("🔴 le lien mort `/fr#newsletter` a disparu", () => {
    expect(page).not.toContain("#newsletter");
  });
});
