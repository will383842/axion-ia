import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const captureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...a: unknown[]) => captureMessage(...a),
  captureException: vi.fn(),
}));
const sendTelegramRaw = vi.fn();
vi.mock("@/server/notifications/channels/telegram", () => ({
  sendTelegramRaw: (...a: unknown[]) => sendTelegramRaw(...a),
}));
const isDuplicate = vi.fn();
const libererDedup = vi.fn();
vi.mock("@/server/notifications/dedup", () => ({
  isDuplicate: (...a: unknown[]) => isDuplicate(...a),
  libererDedup: (...a: unknown[]) => libererDedup(...a),
}));

import { alerterContresignature, alerterSignatureApporteur } from "../alerte-telegram";

const SALON = "-100000000001";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  for (const k of Object.keys(process.env)) if (k.startsWith("TELEGRAM_")) delete process.env[k];
  process.env["TELEGRAM_BOT_TOKEN"] = "123:jeton-fictif";
  process.env["TELEGRAM_CHAT_ID_APPORTEURS"] = SALON;
  process.env["TELEGRAM_CHAT_ID_MESSAGES"] = "-100000000002";
  isDuplicate.mockResolvedValue(false);
  sendTelegramRaw.mockResolvedValue(true);
});

const SIGNATURE = {
  cleSignature: "apporteur-dossier-a-verifier-abc-1",
  prenom: "Éloïse",
  nom: "Lefèvre",
  lienConsole: "https://exemple.test/admin/apporteurs/abc",
};

describe("alerte Telegram — signature", () => {
  it("part dans le salon Apporteurs, avec le lien, sans nom complet", async () => {
    expect(await alerterSignatureApporteur(SIGNATURE)).toBe("envoye");
    expect(sendTelegramRaw).toHaveBeenCalledTimes(1);
    const arg = sendTelegramRaw.mock.calls[0]![0] as { text: string; chatId: string };
    expect(arg.chatId).toBe(SALON);
    expect(arg.text).toContain("✍️ Un apporteur a signé son contrat : Éloïse L.");
    expect(arg.text).toContain(
      "À vérifier puis contresigner : https://exemple.test/admin/apporteurs/abc",
    );
    expect(arg.text).not.toContain("Lefèvre");
  });

  it("une seule alerte par signature : la seconde est dédoublonnée", async () => {
    isDuplicate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await alerterSignatureApporteur(SIGNATURE)).toBe("envoye");
    expect(await alerterSignatureApporteur(SIGNATURE)).toBe("deja_envoye");
    expect(sendTelegramRaw).toHaveBeenCalledTimes(1);
  });

  it("variable absente : rien n'est envoyé, pas de Sentry", async () => {
    delete process.env["TELEGRAM_CHAT_ID_APPORTEURS"];
    expect(await alerterSignatureApporteur(SIGNATURE)).toBe("non_configure");
    expect(sendTelegramRaw).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("Telegram refuse : ne lève pas, libère la clé, Sentry sans donnée personnelle", async () => {
    sendTelegramRaw.mockResolvedValue(false);
    expect(await alerterSignatureApporteur(SIGNATURE)).toBe("echec");
    expect(libererDedup).toHaveBeenCalled();
    expect(JSON.stringify(captureMessage.mock.calls)).not.toMatch(/Éloïse|Lefèvre|exemple\.test/);
  });

  it("Telegram lève : ne lève pas non plus", async () => {
    sendTelegramRaw.mockRejectedValue(new Error("réseau"));
    await expect(alerterSignatureApporteur(SIGNATURE)).resolves.toBe("echec");
  });

  it("aucun bot configuré : rien n'est envoyé", async () => {
    delete process.env["TELEGRAM_BOT_TOKEN"];
    expect(await alerterSignatureApporteur(SIGNATURE)).toBe("non_configure");
    expect(sendTelegramRaw).not.toHaveBeenCalled();
  });
});

describe("alerte Telegram — contresignature", () => {
  it("part dans le salon Apporteurs", async () => {
    await alerterContresignature({
      apporteurId: "abc",
      prenom: "Éloïse",
      nom: "Lefèvre",
      envoi: "envoye",
    });
    const arg = sendTelegramRaw.mock.calls[0]![0] as { text: string; chatId: string };
    expect(arg.chatId).toBe(SALON);
    expect(arg.text).toBe("✅ Contrat contresigné : Éloïse L., e-mail et pièces jointes envoyés.");
  });

  it("e-mail en validation : message dédié, pas de « PAS parti »", async () => {
    await alerterContresignature({
      apporteurId: "abe",
      prenom: "Éloïse",
      nom: "Lefèvre",
      envoi: "en-validation",
    });
    const arg = sendTelegramRaw.mock.calls[0]![0] as { text: string };
    expect(arg.text).toContain("en attente de validation dans la console");
    expect(arg.text).not.toContain("PAS parti");
  });

  it("e-mail non parti : le message ne dit pas « envoyés » et demande la relance", async () => {
    await alerterContresignature({
      apporteurId: "abd",
      prenom: "Éloïse",
      nom: "Lefèvre",
      envoi: "echec",
    });
    const arg = sendTelegramRaw.mock.calls[0]![0] as { text: string };
    expect(arg.text).not.toContain("envoyés");
    expect(arg.text).toContain("PAS parti");
    expect(arg.text).toContain("echec");
  });
});
