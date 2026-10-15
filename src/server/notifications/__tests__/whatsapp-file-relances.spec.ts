// File d'envoi WhatsApp (CallMeBot) : retour immédiat, espacement, relances,
// abandon, 200 porteur d'erreur. Minuteries simulées : aucun vrai délai.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  sendWhatsAppRaw,
  flushWhatsAppQueue,
  resetWhatsAppQueueForTests,
} from "../channels/whatsapp";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
let errorSpy: ReturnType<typeof vi.spyOn>;

const ok = () => new Response("Message queued", { status: 200 });

beforeEach(() => {
  vi.useFakeTimers();
  resetWhatsAppQueueForTests();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
  process.env.WHATSAPP_NOTIFY_PHONE = "+33755512345";
});
afterEach(async () => {
  await vi.runAllTimersAsync();
  await flushWhatsAppQueue();
  vi.useRealTimers();
  errorSpy.mockRestore();
  globalThis.fetch = originalFetch;
  process.env = { ...savedEnv };
});

describe("file WhatsApp", () => {
  it('rend "queued" immédiatement, même si fetch ne répond jamais', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    await expect(sendWhatsAppRaw({ text: "x" })).resolves.toBe("queued");
  });

  it("no-op sans clé ou sans numéro", async () => {
    delete process.env.WHATSAPP_NOTIFY_PHONE;
    expect(await sendWhatsAppRaw({ text: "x" })).toBe("skipped");
    await vi.runAllTimersAsync();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("espace les envois d'environ 4,5 s", async () => {
    fetchMock.mockImplementation(async () => ok());
    await sendWhatsAppRaw({ text: "a" });
    await sendWhatsAppRaw({ text: "b" });
    await sendWhatsAppRaw({ text: "c" });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("relance après un 503 puis réussit (attente 5 s)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(ok());
    await sendWhatsAppRaw({ text: "x" });
    await vi.advanceTimersByTimeAsync(4900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await flushWhatsAppQueue();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("abandonne après 3 échecs, sans numéro ni clé dans le journal", async () => {
    fetchMock.mockImplementation(async () => new Response("busy", { status: 503 }));
    await sendWhatsAppRaw({ text: "texte secret" });
    await vi.runAllTimersAsync();
    await flushWhatsAppQueue();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledOnce();
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("33755512345");
    expect(logged).not.toContain("123456");
    expect(logged).not.toContain("secret");
  });

  it("traite un 200 contenant une erreur CallMeBot comme un échec", async () => {
    fetchMock.mockResolvedValue(new Response("ERROR: APIKey is invalid", { status: 200 }));
    await sendWhatsAppRaw({ text: "x" });
    await vi.runAllTimersAsync();
    await flushWhatsAppQueue();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
