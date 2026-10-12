/**
 * Lot D2 (M10) — « Signaler un désaccord » depuis l'espace formateur.
 * La session vient du cookie, jamais du formulaire ; un identifiant forgé ou
 * d'un autre formateur ne passe pas ; anti-abus ; retour sur la page existante.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.fn();
const signaler = vi.fn();
const limite = vi.fn();
const redirect = vi.fn((u: string) => {
  throw new Error(`NEXT_REDIRECT ${u}`);
});

vi.mock("@/server/formateur/guard", () => ({ getFormateurSession: () => session() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => limite(...a) }));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/desaccord-mission", () => ({
  signalerDesaccord: (...a: unknown[]) => signaler(...a),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { signalerDesaccordFormAction } from "../desaccord.actions";

const T = "22222222-2222-4222-8222-222222222222";
const R = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}
async function url(p: Promise<unknown>): Promise<string> {
  await expect(p).rejects.toThrow(/NEXT_REDIRECT/);
  return String(redirect.mock.calls.at(-1)![0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ trainerId: T, nom: "N", prenom: "P", email: "e" });
  limite.mockResolvedValue({ allowed: true });
  signaler.mockResolvedValue("enregistre");
});

describe("signalerDesaccordFormAction", () => {
  it("transmet l'identifiant du formateur CONNECTÉ, jamais un champ du formulaire", async () => {
    const u = await url(
      signalerDesaccordFormAction(
        fd({ statementId: R, texte: "Il manque une journée.", trainerId: "forge" }),
      ),
    );
    expect(signaler.mock.calls[0]![0]).toMatchObject({ trainerId: T, statementId: R });
    expect(u).toBe(`/fr/espace-formateur/remuneration?signale=enregistre#releve-${R}`);
  });

  it("sans session : connexion, rien n'est signalé", async () => {
    session.mockResolvedValue(null);
    const u = await url(signalerDesaccordFormAction(fd({ statementId: R, texte: "x" })));
    expect(u).toBe("/fr/espace-formateur/connexion");
    expect(signaler).not.toHaveBeenCalled();
  });

  it("identifiant non UUID ou trop de demandes : rien n'est signalé", async () => {
    await url(signalerDesaccordFormAction(fd({ statementId: "x", texte: "x" })));
    limite.mockResolvedValue({ allowed: false });
    const u = await url(signalerDesaccordFormAction(fd({ statementId: R, texte: "x" })));
    expect(u).toContain("signale=trop_tot");
    expect(signaler).not.toHaveBeenCalled();
  });

  it("texte invalide : le formulaire se rouvre sur le même relevé", async () => {
    signaler.mockResolvedValue("texte_invalide");
    const u = await url(signalerDesaccordFormAction(fd({ statementId: R, texte: " " })));
    expect(u).toContain(`desaccord=${R}`);
  });
});
