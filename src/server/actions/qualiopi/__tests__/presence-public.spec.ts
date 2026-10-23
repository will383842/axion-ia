/**
 * QNC NC6 (lot présence 2/3) — l'action publique de réponse. Surface non authentifiée :
 * entrée forgée refusée avant toute base, limite de débit sur l'EMPREINTE du jeton, puis
 * redirection vers la page (qui relit l'état).
 */

import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  enregistrer: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: h.checkRateLimit }));
vi.mock("@/server/qualiopi/confirmation-presence/reponse", () => ({
  enregistrerReponsePresence: h.enregistrer,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

import { repondrePresenceAction } from "../presence-public";

function formulaire(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

async function destination(f: FormData): Promise<string> {
  try {
    await repondrePresenceAction(f);
  } catch (e) {
    return (e as { url: string }).url;
  }
  throw new Error("aucune redirection");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.checkRateLimit.mockResolvedValue({ allowed: true });
  h.enregistrer.mockResolvedValue({ ok: true, enregistre: true, reponse: "oui" });
});

describe("repondrePresenceAction", () => {
  it.each([
    ["jeton absent", { choix: "oui" }],
    ["jeton vide", { token: "", choix: "oui" }],
    ["jeton démesuré", { token: "x".repeat(2049), choix: "oui" }],
    ["choix absent", { token: "jeton" }],
    ["choix hors liste", { token: "jeton", choix: "peut-etre" }],
  ])(
    "entrée forgée (%s) : refusée avant tout accès, redirigée vers l'accueil",
    async (_n, champs) => {
      expect(await destination(formulaire(champs))).toBe("/fr");
      expect(h.checkRateLimit).not.toHaveBeenCalled();
      expect(h.enregistrer).not.toHaveBeenCalled();
    },
  );

  it("la limite de débit porte sur l'empreinte du jeton, jamais sur le jeton en clair", async () => {
    await destination(formulaire({ token: "jeton-secret", choix: "oui" }));
    const empreinte = createHash("sha256").update("jeton-secret").digest("hex");
    const [cle] = h.checkRateLimit.mock.calls[0]!;
    expect(cle).toBe(`presence:rep:${empreinte}`);
    expect(String(cle)).not.toContain("jeton-secret");
  });

  it("limite atteinte : redirection avec ?e=trop_de_tentatives, rien n'est enregistré", async () => {
    h.checkRateLimit.mockResolvedValue({ allowed: false });
    expect(await destination(formulaire({ token: "jeton", choix: "non" }))).toBe(
      "/fr/portail/presence/jeton?e=trop_de_tentatives",
    );
    expect(h.enregistrer).not.toHaveBeenCalled();
  });

  it("réponse enregistrée : redirection vers la page, le jeton est encodé", async () => {
    expect(await destination(formulaire({ token: "a.b/c", choix: "oui" }))).toBe(
      "/fr/portail/presence/a.b%2Fc",
    );
    expect(h.enregistrer).toHaveBeenCalledWith("a.b/c", "oui");
  });

  it("refus relu par la page (session commencée…) : redirection sans paramètre", async () => {
    h.enregistrer.mockResolvedValue({ ok: false, raison: "session_commencee" });
    expect(await destination(formulaire({ token: "jeton", choix: "oui" }))).toBe(
      "/fr/portail/presence/jeton",
    );
  });

  it("demande introuvable : la raison est passée à la page (?e=aucune_demande)", async () => {
    h.enregistrer.mockResolvedValue({ ok: false, raison: "aucune_demande" });
    expect(await destination(formulaire({ token: "jeton", choix: "oui" }))).toBe(
      "/fr/portail/presence/jeton?e=aucune_demande",
    );
  });
});
