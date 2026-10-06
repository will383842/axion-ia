// Corrections de l'audit transversal : signalement fail-soft sous le worker, ré-enfilage d'un
// envoi échoué, en-têtes d'ouverture d'une pièce, CORP du logo d'e-mail, grammaire du mois,
// mise en forme WinAnsi du PDF du contrat.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: (...a: unknown[]) => capture(...a),
}));

const { getJob, enqueueEmail } = vi.hoisted(() => ({
  getJob: vi.fn(),
  enqueueEmail: vi.fn(),
}));
vi.mock("@/server/queue/queues", () => ({
  emailsQueue: { getJob: (...a: unknown[]) => getJob(...a) },
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));

import { moisAvecArticle } from "@/lib/email/templates/apporteur-demarrage";

import { pourPdf } from "../contrat-pdf";
import { entetesPiece } from "../entetes-piece";
import { envoyer, retirerEnvoiEchoue } from "../envois";
import { signalerErreurReseau } from "../signaler";

beforeEach(() => {
  vi.clearAllMocks();
  capture.mockReset();
});

describe("F1 : signalerErreurReseau", () => {
  it("passe par captureWorkerError avec le contexte en préfixe", () => {
    signalerErreurReseau("passage quotidien : x", new Error("boum"));
    const [worker, file, job, err] = capture.mock.calls[0]!;
    expect([worker, file, job]).toEqual(["apporteur-crons", "apporteur-crons", undefined]);
    expect((err as Error).message).toBe("[passage quotidien : x] boum");
  });
  it("ne lève jamais, même si la capture lève ou si l'erreur n'est pas une Error", () => {
    capture.mockImplementation(() => {
      throw new TypeError("captureException is not a function");
    });
    expect(() => signalerErreurReseau("c", "texte")).not.toThrow();
    expect(() => signalerErreurReseau("c", undefined)).not.toThrow();
  });
  it("plus aucun appel direct à Sentry dans les modules du worker", () => {
    for (const f of [
      "passage-quotidien.ts",
      "envois.ts",
      "alerte-vigilance.ts",
      "commissions.ts",
    ]) {
      const src = readFileSync(join(__dirname, "..", f), "utf-8");
      expect(src, f).not.toMatch(/Sentry\.capture|@sentry\/nextjs/);
    }
  });
});

describe("F4 : un envoi échoué est retiré avant le ré-enfilage", () => {
  const envoi = {
    gabarit: "apporteur-vigilance",
    destinataire: "a@b.fr",
    payload: {},
    entityType: "ApporteurReseau",
    entityId: "x",
    jobId: "apporteur:vigilance:1",
  } as unknown as Parameters<typeof envoyer>[0];

  it("job échoué : supprimé, puis enfilé avec le même identifiant", async () => {
    const remove = vi.fn();
    getJob.mockResolvedValue({ isFailed: async () => true, remove });
    enqueueEmail.mockResolvedValue({ enqueued: true });
    expect(await envoyer(envoi)).toBe("envoye");
    expect(getJob).toHaveBeenCalledWith("apporteur-vigilance-1");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(enqueueEmail.mock.calls[0]![4]).toMatchObject({ jobId: "apporteur-vigilance-1" });
  });
  it("job terminé, actif ou en attente : jamais supprimé", async () => {
    const remove = vi.fn();
    getJob.mockResolvedValue({ isFailed: async () => false, remove });
    enqueueEmail.mockResolvedValue({ enqueued: true });
    await envoyer(envoi);
    expect(remove).not.toHaveBeenCalled();
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });
  it("fail-soft : getJob qui lève n'empêche pas l'envoi", async () => {
    getJob.mockRejectedValue(new Error("redis"));
    enqueueEmail.mockResolvedValue({ enqueued: true });
    await expect(retirerEnvoiEchoue("x")).resolves.toBeUndefined();
    expect(await envoyer(envoi)).toBe("envoye");
  });
  it("sans jobId : on ne touche pas à la file", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: true });
    await envoyer({ ...envoi, jobId: undefined } as unknown as typeof envoi);
    expect(getJob).not.toHaveBeenCalled();
  });
});

describe("F2 : en-têtes d'ouverture d'une pièce", () => {
  it("PDF : en ligne, SANS sandbox ni CSP", () => {
    const h = entetesPiece("application/pdf", "rib é.pdf", 12);
    expect(h["Content-Security-Policy"]).toBeUndefined();
    expect(h["Content-Disposition"]).toBe('inline; filename="rib _.pdf"');
    expect(h["Cache-Control"]).toBe("private, no-store");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
  });
  it("image : CSP stricte conservée", () => {
    const h = entetesPiece("image/png", "cni.png", 12);
    expect(h["Content-Security-Policy"]).toContain("default-src 'none'");
    expect(h["Content-Security-Policy"]).toContain("sandbox");
  });
});

describe("F6 : logo d'e-mail lisible depuis l'aperçu", () => {
  it("next.config pose CORP cross-origin sur /email/:path*, APRÈS la règle globale", () => {
    const src = readFileSync(join(process.cwd(), "next.config.ts"), "utf-8");
    const globale = src.indexOf('source: "/:path*"');
    const email = src.indexOf('source: "/email/:path*"');
    expect(globale).toBeGreaterThan(-1);
    expect(email).toBeGreaterThan(globale);
    expect(src.slice(email, email + 200)).toContain(
      '{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }',
    );
  });
});

describe("F7 : grammaire du mois", () => {
  it.each([
    ["octobre 2026", "d'octobre 2026"],
    ["avril 2027", "d'avril 2027"],
    ["août 2026", "d'août 2026"],
    ["novembre 2026", "de novembre 2026"],
    ["décembre 2026", "de décembre 2026"],
  ])("%s -> %s", (m, attendu) => {
    expect(moisAvecArticle(m)).toBe(attendu);
  });
});

describe("F8e : PDF du contrat, alphabet WinAnsi", () => {
  it("remplace ł, ő… par l'ASCII le plus proche, garde é, œ, €, « »", () => {
    expect(pourPdf("Łukasz Győrfi, rue Świętokrzyska")).toBe("Lukasz Gyorfi, rue Swietokrzyska");
    expect(pourPdf("Éloïse – 5 € « œuvre » ’")).toBe("Éloïse – 5 € « œuvre » ’");
  });
  it("caractère sans équivalent : « ? » ; espaces fines : espace", () => {
    expect(pourPdf("a中b")).toBe("a?b");
    expect(pourPdf("1 000")).toBe("1 000");
    expect(pourPdf("l1\nl2")).toBe("l1\nl2");
  });
});
