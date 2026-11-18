// Durcissement 2026-11 : le lien de signature MAISON (`/portail/signer/<payload>.<sig>`) est un
// jeton porteur : qui le détient signe à la place du client. Il traverse la file d'e-mails
// (`signatureUrl`) ; il ne doit atteindre Sentry ni par `jobData`, ni par `failedReason`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureExceptionMock } = vi.hoisted(() => ({ captureExceptionMock: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { sanitizeJobData } from "../sanitize-job-data";
import { captureWorkerError } from "../sentry-worker";

// Jeton maison à 2 segments base64url : aucun motif générique (JWT 3 segments, hex 32) ne l'attrape.
const JETON = "eyJkIjoiYWJjIn0abcdefghijkl.c2lnbmF0dXJlLWRlLXRlc3QtMTIzNDU2";
const LIEN = `https://axion-ia.com/fr/portail/signer/${JETON}`;

beforeEach(() => captureExceptionMock.mockReset());

describe("le lien de signature ne part pas chez Sentry", () => {
  it("🔴 la clé signatureUrl est masquée, à toute profondeur", () => {
    const out = sanitizeJobData({ template: "devis-envoi", payload: { signatureUrl: LIEN } });
    expect(JSON.stringify(out)).not.toContain(JETON);
    expect(JSON.stringify(out)).not.toContain("/signer/");
  });

  it.each([
    ["URL absolue", LIEN],
    ["chemin relatif", `/fr/portail/signer/${JETON}`],
    ["segment /signer/ nu", `/signer/${JETON}`],
    ["noyée dans un texte", `Cliquez ici : ${LIEN} merci`],
  ])("🔴 toute valeur contenant /signer/ est masquée sous une clé quelconque (%s)", (_n, v) => {
    const out = sanitizeJobData({ lienQuelconque: v, liste: [v] });
    expect(JSON.stringify(out)).not.toContain(JETON);
  });

  it("contre-témoin : une URL sans /signer/ et une clé voisine restent lisibles", () => {
    const out = sanitizeJobData({ url: "https://axion-ia.com/fr/formations", jobId: "abc" });
    expect(out?.["url"]).toBe("https://axion-ia.com/fr/formations");
    expect(out?.["jobId"]).toBe("abc");
  });

  it("🔴 captureWorkerError n'envoie jamais le lien (jobData, failedReason, extra entier)", () => {
    const job = {
      id: "1",
      name: "devis-envoi",
      attemptsMade: 1,
      timestamp: 0,
      failedReason: `SMTP refusé pour ${LIEN}`,
      data: { to: "marie@exemple.fr", payload: { signatureUrl: LIEN, numero: "DEV-1" } },
    };
    captureWorkerError("email", "emails", job as never, new Error("SMTP refusé"));
    expect(captureExceptionMock).toHaveBeenCalledOnce();
    const hint = JSON.stringify(captureExceptionMock.mock.calls[0]![1]);
    expect(hint).not.toContain(JETON);
    expect(hint).toContain("DEV-1"); // contre-témoin : le reste du contexte survit
  });
});
