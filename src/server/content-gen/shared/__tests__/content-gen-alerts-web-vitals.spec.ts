/**
 * Audit 2026-05-15 P0 monitoring — Tests helpers SSOT Web Vitals
 * (alertLcpDegraded / alertInpDegraded / alertClsDegraded / alertWebVitalsBulk).
 *
 * Vérifie :
 *  1. Signature objet { url, p75, budget, count } acceptée
 *  2. Fail-soft : sendTelegram throw → helper ne propage pas
 *  3. Format Telegram contient route + budget + count + runbook R30
 *  4. Bulk helper agrège top breaches
 *  5. Aucun helper n'écrit dans la DB (read-only côté alerts)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const sendTelegramMock = vi.fn().mockResolvedValue(true);

vi.mock("@/lib/telegram", () => ({
  sendTelegram: sendTelegramMock,
}));

describe("content-gen-alerts — Web Vitals helpers (P0 fix 2026-05-15)", () => {
  beforeEach(() => {
    sendTelegramMock.mockClear();
    sendTelegramMock.mockResolvedValue(true);
  });

  it("alertLcpDegraded accepte la signature { url, p75, budget, count } et émet runbook R30", async () => {
    const { alertLcpDegraded } = await import("../content-gen-alerts");
    await alertLcpDegraded({
      url: "/fr/interventions",
      p75: 2400,
      budget: 1800,
      count: 42,
    });
    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    const arg = sendTelegramMock.mock.calls[0]?.[0] as {
      tag: string;
      body: string;
      silent?: boolean;
    };
    expect(arg.tag).toBe("MONITORING");
    expect(arg.silent).toBe(true);
    expect(arg.body).toContain("LCP");
    expect(arg.body).toContain("/fr/interventions");
    expect(arg.body).toContain("2400");
    expect(arg.body).toContain("1800");
    expect(arg.body).toContain("n=42");
    expect(arg.body).toContain("R30");
  });

  it("alertInpDegraded formatte INP en ms entiers", async () => {
    const { alertInpDegraded } = await import("../content-gen-alerts");
    await alertInpDegraded({
      url: "/fr/reserver",
      p75: 187.4,
      budget: 100,
      count: 31,
    });
    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    const arg = sendTelegramMock.mock.calls[0]?.[0] as { body: string };
    expect(arg.body).toContain("INP");
    expect(arg.body).toContain("187 ms");
    expect(arg.body).toContain("100 ms");
  });

  it("alertClsDegraded formatte CLS en 3 décimales et marque critical (silent false)", async () => {
    const { alertClsDegraded } = await import("../content-gen-alerts");
    await alertClsDegraded({
      url: "/fr/reserver",
      p75: 0.087,
      budget: 0.01,
      count: 22,
    });
    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    const arg = sendTelegramMock.mock.calls[0]?.[0] as { body: string; silent?: boolean };
    expect(arg.body).toContain("CLS");
    expect(arg.body).toContain("0.087");
    expect(arg.body).toContain("0.010");
    expect(arg.silent).toBeUndefined();
  });

  it("alertWebVitalsBulk agrège top breaches avec compteur total + runbook R30", async () => {
    const { alertWebVitalsBulk } = await import("../content-gen-alerts");
    await alertWebVitalsBulk(
      [
        { url: "/fr/a", metric: "LCP", p75: 2100, budget: 1800, count: 10 },
        { url: "/fr/b", metric: "INP", p75: 150, budget: 100, count: 12 },
        { url: "/fr/c", metric: "CLS", p75: 0.05, budget: 0.01, count: 8 },
      ],
      8,
      24,
    );
    expect(sendTelegramMock).toHaveBeenCalledTimes(1);
    const arg = sendTelegramMock.mock.calls[0]?.[0] as { body: string };
    expect(arg.body).toContain("bulk");
    expect(arg.body).toContain("8 breaches");
    expect(arg.body).toContain("24h");
    expect(arg.body).toContain("LCP");
    expect(arg.body).toContain("INP");
    expect(arg.body).toContain("CLS");
    expect(arg.body).toContain("R30");
  });

  it("alertWebVitalsBulk noop si top vide (pas d'appel Telegram parasite)", async () => {
    const { alertWebVitalsBulk } = await import("../content-gen-alerts");
    await alertWebVitalsBulk([], 0, 24);
    expect(sendTelegramMock).not.toHaveBeenCalled();
  });

  it("fail-soft — sendTelegram throw doit être swallow (alerte non bloquante)", async () => {
    sendTelegramMock.mockRejectedValueOnce(new Error("Telegram API timeout"));
    const { alertLcpDegraded } = await import("../content-gen-alerts");
    await expect(
      alertLcpDegraded({ url: "/fr/x", p75: 2200, budget: 1800, count: 5 }),
    ).resolves.toBeUndefined();
  });

  it("inclut un lien PageSpeed Insights de la route fautive", async () => {
    const { alertLcpDegraded } = await import("../content-gen-alerts");
    await alertLcpDegraded({ url: "/fr/comparer", p75: 2200, budget: 1800, count: 8 });
    const arg = sendTelegramMock.mock.calls[0]?.[0] as { body: string };
    expect(arg.body).toContain("pagespeed.web.dev");
    expect(arg.body).toContain(encodeURIComponent("/fr/comparer"));
  });
});
