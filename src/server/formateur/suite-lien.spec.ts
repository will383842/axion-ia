/**
 * Lot S6a (h) — `suite` du lien magique : liste blanche, et AUCUNE
 * redirection ouverte, y compris à travers la vraie route de connexion.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  consommer: vi.fn(),
  trainer: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: { trainer: h.trainer } }));
vi.mock("@/server/formateur/magic-link", () => ({ consumeFormateurMagicLink: h.consommer }));
vi.mock("@/lib/formateur-session", () => ({ signFormateurSession: vi.fn(async () => "jeton") }));
vi.mock("@/server/formateur/cookie", () => ({ setFormateurCookie: vi.fn() }));

import { NextRequest } from "next/server";
import { GET } from "@/app/[locale]/espace-formateur/connexion/[token]/route";
import { publicUrl } from "@/lib/public-url";
import { FORMATEUR_BASE_PATH, buildFormateurMagicLinkUrl } from "./routes";
import { destinationApresConnexion, suiteAdmise } from "./suite-lien";

const UUID = "0b6f0d55-6c1d-4d0e-9f73-0d2a1b7c3e44";

/** Tentatives classiques de redirection ouverte et de sortie de l'espace. */
const HOSTILES = [
  "https://evil.example",
  "//evil.example",
  "///evil.example",
  "/\\evil.example",
  "\\\\evil.example",
  "/%2F%2Fevil.example",
  "javascript:alert(1)",
  "data:text/html,x",
  `${FORMATEUR_BASE_PATH}/../../admin`,
  `${FORMATEUR_BASE_PATH}//evil.example`,
  `${FORMATEUR_BASE_PATH}/sessions/${UUID}?x=https://evil.example`,
  `${FORMATEUR_BASE_PATH}/sessions/${UUID}#//evil.example`,
  `${FORMATEUR_BASE_PATH}@evil.example`,
  `${FORMATEUR_BASE_PATH}.evil.example`,
  `${FORMATEUR_BASE_PATH}/sessions/pas-un-uuid`,
  `${FORMATEUR_BASE_PATH}/connexion`,
  `/fr/admin`,
  ` ${FORMATEUR_BASE_PATH}`,
  `${FORMATEUR_BASE_PATH}\n`,
  "",
];

describe("liste blanche", () => {
  it("admet les chemins de l'espace", () => {
    for (const s of [
      FORMATEUR_BASE_PATH,
      `${FORMATEUR_BASE_PATH}/remuneration`,
      `${FORMATEUR_BASE_PATH}/sessions`,
      `${FORMATEUR_BASE_PATH}/seances/${UUID}`,
      `${FORMATEUR_BASE_PATH}/sessions/${UUID}`,
    ]) {
      expect(suiteAdmise(s), s).toBe(true);
      expect(destinationApresConnexion(s)).toBe(s);
    }
  });

  it.each(HOSTILES)("refuse %j et retombe sur le tableau de bord", (s) => {
    expect(suiteAdmise(s)).toBe(false);
    expect(destinationApresConnexion(s)).toBe(FORMATEUR_BASE_PATH);
  });

  it("la destination reste TOUJOURS sur notre origine", () => {
    const origine = publicUrl("/").origin;
    for (const s of HOSTILES) {
      expect(publicUrl(destinationApresConnexion(s)).origin).toBe(origine);
    }
  });

  it("le lien porte la suite encodée, et rien sans elle", () => {
    expect(buildFormateurMagicLinkUrl("TOK")).not.toContain("suite=");
    expect(buildFormateurMagicLinkUrl("TOK", `${FORMATEUR_BASE_PATH}/sessions`)).toContain(
      `?suite=${encodeURIComponent(`${FORMATEUR_BASE_PATH}/sessions`)}`,
    );
  });
});

describe("la vraie route de connexion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.consommer.mockResolvedValue("trainer-1");
    h.trainer.findUnique.mockResolvedValue({ id: "trainer-1", actif: true });
  });

  async function connecter(suite?: string): Promise<URL> {
    const url = new URL("https://interne.invalid/fr/espace-formateur/connexion/TOK");
    if (suite !== undefined) url.searchParams.set("suite", suite);
    const rep = await GET(new NextRequest(url), {
      params: Promise.resolve({ token: "TOK", locale: "fr" }),
    });
    return new URL(rep.headers.get("location")!);
  }

  it("suit une suite admise", async () => {
    const dest = await connecter(`${FORMATEUR_BASE_PATH}/sessions/${UUID}`);
    expect(dest.pathname).toBe(`${FORMATEUR_BASE_PATH}/sessions/${UUID}`);
  });

  it.each(HOSTILES)("anti-redirection ouverte : %j", async (s) => {
    const dest = await connecter(s);
    expect(dest.origin).toBe(publicUrl("/").origin);
    expect(dest.pathname).toBe(FORMATEUR_BASE_PATH);
  });

  it("sans suite : le tableau de bord, comme avant", async () => {
    expect((await connecter()).pathname).toBe(FORMATEUR_BASE_PATH);
  });
});
