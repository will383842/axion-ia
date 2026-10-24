import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lireParJeton = vi.fn();
const enregistrerReponse = vi.fn();
const enqueueEmail = vi.fn();
const findUnique = vi.fn();
const marquerEnvoye = vi.fn();

vi.mock("@/features/questionnaire-preaudit/serveur", () => ({
  lireParJeton: (...a: unknown[]) => lireParJeton(...a),
  enregistrerReponse: (...a: unknown[]) => enregistrerReponse(...a),
  marquerEnvoye: (...a: unknown[]) => marquerEnvoye(...a),
  urlPreaudit: () => "https://axion-ia.com/questionnaire/preaudit/x/y",
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { questionnaireAvantAudit: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
// Le vrai module tire la session (next-auth) : inutile ici, on garde seulement la classe d'erreur.
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class MessagePourWill extends Error {},
}));

import { POST } from "@/app/api/questionnaire-preaudit/[id]/[jeton]/route";
import { GET } from "@/app/questionnaire/preaudit/[id]/[jeton]/route";
import { envoyerQuestionnaire } from "../envoyer";

const ctx = { params: Promise.resolve({ id: "i", jeton: "j" }) };
const CHARGE = JSON.stringify({
  schema: 3,
  mode: "main",
  consentements: { traitement: true },
  donnees: { ent_nom: "X" },
});
const post = (qs = "") =>
  POST(new Request(`http://localhost/api/q${qs}`, { method: "POST", body: CHARGE }), ctx);

const HTML = `<html><body><script>
const CONFIG = {
  endpoint: "",
  rgpd: { contact: "", conservation: "" },
};
const p = { schema: 3 };
</script></body></html>`;

const ENV_AVANT = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"];
  delete process.env["QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT"];
  delete process.env["QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION"];
});
afterEach(() => {
  process.env = { ...ENV_AVANT };
});

describe("réception des réponses", () => {
  it("jeton inconnu : 404, rien d'écrit", async () => {
    lireParJeton.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
    expect(enregistrerReponse).not.toHaveBeenCalled();
  });

  it("essai : 200 sans rien écrire, même éteint", async () => {
    lireParJeton.mockResolvedValue({ id: "i", envoyeLe: null, ref: "r", html: HTML });
    const r = await post("?essai=1");
    expect(r.status).toBe(200);
    expect(enregistrerReponse).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("réel éteint : refusé, rien d'écrit", async () => {
    lireParJeton.mockResolvedValue({ id: "i", envoyeLe: new Date(), ref: "r", html: HTML });
    expect((await post()).status).toBe(404);
    expect(enregistrerReponse).not.toHaveBeenCalled();
  });

  it("réel allumé : enregistre, sans aucune notification", async () => {
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    lireParJeton.mockResolvedValue({ id: "i", envoyeLe: new Date(), ref: "r", html: HTML });
    enregistrerReponse.mockResolvedValue("ok");
    expect((await post()).status).toBe(200);
    expect(enregistrerReponse).toHaveBeenCalledOnce();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("réel allumé mais questionnaire pas envoyé : refusé", async () => {
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    lireParJeton.mockResolvedValue({ id: "i", envoyeLe: null, ref: "r", html: HTML });
    enregistrerReponse.mockResolvedValue("pas_envoye");
    expect((await post()).status).toBe(404);
  });
});

describe("la page publique", () => {
  const get = (qs: string) =>
    GET(new Request(`http://localhost/questionnaire/preaudit/i/j${qs}`), ctx);

  it("jeton inconnu : 404 neutre", async () => {
    lireParJeton.mockResolvedValue(null);
    expect((await get("?ref=r")).status).toBe(404);
  });

  it("l'essai est servi avec bandeau, même éteint et en brouillon", async () => {
    lireParJeton.mockResolvedValue({ id: "i", envoyeLe: null, ref: "r", html: HTML });
    const r = await get("?essai=1&ref=r");
    expect(r.status).toBe(200);
    const corps = await r.text();
    expect(corps).toContain("ESSAI");
    expect(corps).toContain("essai=1");
  });

  it("le réel est introuvable tant que c'est éteint ou en brouillon", async () => {
    lireParJeton.mockResolvedValue({ id: "i", envoyeLe: new Date(), ref: "r", html: HTML });
    expect((await get("?ref=r")).status).toBe(404);
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    lireParJeton.mockResolvedValue({ id: "i", envoyeLe: null, ref: "r", html: HTML });
    expect((await get("?ref=r")).status).toBe(404);
  });

  it("impose la référence commune par redirection", async () => {
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    lireParJeton.mockResolvedValue({ id: "i", envoyeLe: new Date(), ref: "r", html: HTML });
    const r = await get("?s=1");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toContain("ref=r");
    expect(r.headers.get("location")).toContain("s=1");
  });
});

describe("l'envoi par clic", () => {
  const args = { questionnaireId: "i", destinataire: "client@exemple.fr", prenom: "Sam" };

  it("refusé éteint : rien en file", async () => {
    await expect(envoyerQuestionnaire(args)).rejects.toThrow(/éteint/);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("refusé tant que la notice RGPD est vide", async () => {
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    await expect(envoyerQuestionnaire(args)).rejects.toThrow(/RGPD/);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("allumé et complet : une mise en file, puis l'état « envoyé »", async () => {
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    process.env["QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT"] = "contact@axion-ia.com";
    process.env["QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION"] = "3 ans";
    findUnique.mockResolvedValue({ id: "i", rencontre: { clientId: null } });
    enqueueEmail.mockResolvedValue({ enqueued: true });
    await envoyerQuestionnaire(args);
    expect(enqueueEmail).toHaveBeenCalledOnce();
    expect(enqueueEmail.mock.calls[0]?.[0]).toBe("questionnaire-avant-audit");
    expect(marquerEnvoye).toHaveBeenCalledWith("i");
  });

  it("adresse invalide : refusée", async () => {
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
    process.env["QUESTIONNAIRE_PREAUDIT_RGPD_CONTACT"] = "contact@axion-ia.com";
    process.env["QUESTIONNAIRE_PREAUDIT_RGPD_CONSERVATION"] = "3 ans";
    await expect(
      envoyerQuestionnaire({ ...args, destinataire: "pas-une-adresse" }),
    ).rejects.toThrow();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
