// @vitest-environment node
//
// Server Action du formulaire du guide (lot L2) : les contrôles d'entrée.
// 🔴 Turnstile est désormais BLOQUANT (décision D3 de Will, 24/09) : le
// formulaire envoie un e-mail à toute adresse saisie.

import { describe, it, expect, vi, beforeEach } from "vitest";

const checkRateLimit = vi.fn();
const verifyTurnstile = vi.fn();
const domaineRecoitDesEmails = vi.fn();
const enregistrerDemandeGuide = vi.fn();
const signalerHoneypot = vi.fn();

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => checkRateLimit(...a) }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: (...a: unknown[]) => verifyTurnstile(...a) }));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: async () => "192.0.2.1",
  getClientUserAgent: async () => "navigateur-de-test",
}));
vi.mock("@/lib/security/honeypot-observable", () => ({
  signalerHoneypot: (...a: unknown[]) => signalerHoneypot(...a),
}));
vi.mock("@/server/guide-ia/mx", () => ({
  domaineRecoitDesEmails: (...a: unknown[]) => domaineRecoitDesEmails(...a),
}));
vi.mock("@/server/guide-ia/demande", () => ({
  enregistrerDemandeGuide: (...a: unknown[]) => enregistrerDemandeGuide(...a),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { demanderGuideAction } from "../actions";

const ETAT = { ok: false as const, error: "" };

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}
const VALIDE = {
  email: "jeanne@example.invalid",
  locale: "fr",
  source: "guide-ia",
  "cf-turnstile-response": "jeton-turnstile",
};

beforeEach(() => {
  checkRateLimit.mockReset().mockResolvedValue({ allowed: true });
  verifyTurnstile.mockReset().mockResolvedValue(true);
  domaineRecoitDesEmails.mockReset().mockResolvedValue("oui");
  enregistrerDemandeGuide.mockReset().mockResolvedValue({ envoi: "en-file" });
  signalerHoneypot.mockReset();
});

describe("demanderGuideAction", () => {
  it("témoin : une demande valide est enregistrée, case non cochée transmise telle quelle", async () => {
    expect(await demanderGuideAction(ETAT, formulaire(VALIDE))).toEqual({ ok: true });
    expect(enregistrerDemandeGuide).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "jeanne@example.invalid",
        locale: "fr",
        source: "guide-ia",
        variante: "guide",
        caseLettre: false,
      }),
    );
  });

  it("case cochée : transmise ; c'est le serveur qui décidera selon la nature de l'adresse", async () => {
    await demanderGuideAction(ETAT, formulaire({ ...VALIDE, lettre: "true" }));
    expect(enregistrerDemandeGuide.mock.calls[0]?.[0]).toMatchObject({
      variante: "guide",
      caseLettre: true,
    });
  });

  it("depuis un encart d'article : la variante de l'ENCART, pas celle de la page", async () => {
    await demanderGuideAction(
      ETAT,
      formulaire({ ...VALIDE, source: "blog-fin-article", lettre: "true" }),
    );
    expect(enregistrerDemandeGuide.mock.calls[0]?.[0]).toMatchObject({
      source: "blog-fin-article",
      variante: "article",
    });
  });

  it("🔴 Turnstile échoué : REFUS, rien n'est enregistré ni envoyé (D3)", async () => {
    verifyTurnstile.mockResolvedValue(false);
    const r = await demanderGuideAction(ETAT, formulaire(VALIDE));
    expect(r.ok).toBe(false);
    expect(enregistrerDemandeGuide).not.toHaveBeenCalled();
  });

  it("🔴 Turnstile qui lève : REFUS aussi (fermé par défaut)", async () => {
    verifyTurnstile.mockRejectedValue(new Error("réseau"));
    expect((await demanderGuideAction(ETAT, formulaire(VALIDE))).ok).toBe(false);
    expect(enregistrerDemandeGuide).not.toHaveBeenCalled();
  });

  it("🔴 domaine sans MX : refus avec un message qui permet de corriger", async () => {
    domaineRecoitDesEmails.mockResolvedValue("non");
    const r = await demanderGuideAction(ETAT, formulaire(VALIDE));
    expect(r).toEqual({
      ok: false,
      error: "Cette adresse ne semble pas pouvoir recevoir d'e-mails. Vérifiez-la, puis réessayez.",
    });
    expect(enregistrerDemandeGuide).not.toHaveBeenCalled();
  });

  it("DNS en panne (« inconnu ») : on laisse passer", async () => {
    domaineRecoitDesEmails.mockResolvedValue("inconnu");
    expect(await demanderGuideAction(ETAT, formulaire(VALIDE))).toEqual({ ok: true });
  });

  it("piège à robots : faux succès, rien n'est enregistré", async () => {
    expect(await demanderGuideAction(ETAT, formulaire({ ...VALIDE, website: "x" }))).toEqual({
      ok: true,
    });
    expect(signalerHoneypot).toHaveBeenCalled();
    expect(enregistrerDemandeGuide).not.toHaveBeenCalled();
  });

  it("provenance hors liste fermée : enregistrée comme absente", async () => {
    await demanderGuideAction(ETAT, formulaire({ ...VALIDE, source: "<script>" }));
    expect(enregistrerDemandeGuide.mock.calls[0]?.[0]).toMatchObject({ source: null });
  });

  it("débit par IP dépassé : refus", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await demanderGuideAction(ETAT, formulaire(VALIDE))).ok).toBe(false);
  });

  it("la ligne ne reçoit que l'EMPREINTE de l'IP ; l'IP brute ne va qu'au registre, qui la hache", async () => {
    await demanderGuideAction(ETAT, formulaire(VALIDE));
    const entree = enregistrerDemandeGuide.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entree["ipHash"]).not.toBe("192.0.2.1");
    expect(entree["ip"]).toBe("192.0.2.1");
    expect(entree["userAgent"]).toBe("navigateur-de-test");
  });
});
