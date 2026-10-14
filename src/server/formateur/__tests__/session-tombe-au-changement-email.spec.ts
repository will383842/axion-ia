/**
 * Lot C4 — une session de l'espace formateur ouverte sous l'ANCIENNE adresse d'un
 * indépendant tombe quand la console change son adresse.
 *
 * La session porte l'empreinte de l'adresse au moment de la connexion ; la garde la
 * compare à l'adresse de la fiche. Sans migration : rien n'est stocké en base.
 *
 * ⚠️ Une session signée AVANT ce lot ne porte pas d'empreinte : elle reste valable
 * jusqu'à son expiration (30 jours au plus), comme les sessions sans version du lot E.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  consommer: vi.fn(),
  signer: vi.fn(async () => "jeton"),
  verifier: vi.fn(),
  jeton: vi.fn(),
  trainer: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: { trainer: h.trainer } }));
vi.mock("@/server/formateur/magic-link", () => ({ consumeFormateurMagicLink: h.consommer }));
vi.mock("@/lib/formateur-session", () => ({
  signFormateurSession: h.signer,
  verifyFormateurSession: h.verifier,
}));
vi.mock("@/server/formateur/cookie", () => ({
  setFormateurCookie: vi.fn(),
  getFormateurToken: h.jeton,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`NEXT_REDIRECT:${p}`);
  }),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/[locale]/espace-formateur/connexion/[token]/route";
import { empreinteSessionFormateur } from "../acces-apres-fin";
import { getFormateurSession } from "../guard";

const ADRESSE = "camille@exemple.test";

function fiche(statut: string, email = ADRESSE) {
  return {
    id: "trainer-1",
    nom: "Martin",
    prenom: "Camille",
    email,
    actif: true,
    statut,
    finCollaborationAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.jeton.mockResolvedValue("jeton");
});

describe("empreinteSessionFormateur", () => {
  it("ne dépend ni de la casse ni des espaces, et ne contient pas l'adresse", () => {
    const e = empreinteSessionFormateur(ADRESSE);
    expect(empreinteSessionFormateur("  Camille@Exemple.TEST ")).toBe(e);
    expect(empreinteSessionFormateur("autre@exemple.test")).not.toBe(e);
    expect(e).not.toContain("camille");
    expect(e).toMatch(/^[0-9a-f]{16}$/);
  });

  it("relecture — est une HMAC du secret de session : sans le secret, rien ne se vérifie", () => {
    const avant = process.env["AUTH_SECRET"];
    process.env["AUTH_SECRET"] = "secret-a-0123456789abcdef0123456789";
    const a = empreinteSessionFormateur(ADRESSE);
    process.env["AUTH_SECRET"] = "secret-b-0123456789abcdef0123456789";
    const b = empreinteSessionFormateur(ADRESSE);
    process.env["AUTH_SECRET"] = avant;
    expect(a).not.toBe(b);
  });
});

describe("connexion — la session porte l'empreinte de l'adresse", () => {
  it("🔴 signe la session avec l'empreinte de l'adresse de la fiche", async () => {
    h.consommer.mockResolvedValue("trainer-1");
    h.trainer.findUnique.mockResolvedValue(fiche("sous_traitant"));
    const url = new URL("https://interne.invalid/fr/espace-formateur/connexion/TOK");
    await GET(new NextRequest(url), { params: Promise.resolve({ token: "TOK", locale: "fr" }) });
    expect(h.signer).toHaveBeenCalledTimes(1);
    const args = h.signer.mock.calls[0] as unknown[];
    expect(args[4]).toBe(empreinteSessionFormateur(ADRESSE));
  });
});

describe("garde — adresse changée depuis la connexion", () => {
  it("🔴 un indépendant dont l'adresse a changé perd sa session", async () => {
    h.verifier.mockResolvedValue({
      ok: true,
      trainerId: "trainer-1",
      version: 0,
      empreinte: empreinteSessionFormateur(ADRESSE),
    });
    h.trainer.findUnique.mockResolvedValue(fiche("sous_traitant", "nouvelle@exemple.test"));
    expect(await getFormateurSession()).toBeNull();
  });

  it("même adresse : la session reste ouverte", async () => {
    h.verifier.mockResolvedValue({
      ok: true,
      trainerId: "trainer-1",
      version: 0,
      empreinte: empreinteSessionFormateur(ADRESSE),
    });
    h.trainer.findUnique.mockResolvedValue(fiche("sous_traitant"));
    expect(await getFormateurSession()).not.toBeNull();
  });

  it.each(["salarie", "dirigeant"])("un %s garde sa session (INCHANGÉ)", async (statut) => {
    h.verifier.mockResolvedValue({
      ok: true,
      trainerId: "trainer-1",
      version: 0,
      empreinte: empreinteSessionFormateur(ADRESSE),
    });
    h.trainer.findUnique.mockResolvedValue(fiche(statut, "nouvelle@exemple.test"));
    expect(await getFormateurSession()).not.toBeNull();
  });

  it("une session signée avant ce lot (sans empreinte) n'est pas jugée sur l'adresse", async () => {
    h.verifier.mockResolvedValue({ ok: true, trainerId: "trainer-1", version: 0 });
    h.trainer.findUnique.mockResolvedValue(fiche("sous_traitant", "nouvelle@exemple.test"));
    expect(await getFormateurSession()).not.toBeNull();
  });
});
