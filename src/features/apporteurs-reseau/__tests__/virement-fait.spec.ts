// « Votre commission est virée » : gabarit `apporteur-virement-fait`, clé d'idempotence
// et payload construit par `envoyerConfirmationVirement`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getJob, enqueueEmail } = vi.hoisted(() => ({
  getJob: vi.fn(async (..._a: unknown[]) => null),
  enqueueEmail: vi.fn(async (..._a: unknown[]) => ({ enqueued: true })),
}));
vi.mock("@/server/queue/queues", () => ({
  emailsQueue: { getJob: (...a: unknown[]) => getJob(...a) },
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));

import { renderEmailTemplate } from "@/lib/email/templates";

import { envoyerConfirmationVirement, jobIdVirementFait } from "../envois";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gabarit apporteur-virement-fait", () => {
  it("rend sujet, montant, numéro et date, sans « undefined »", async () => {
    const r = await renderEmailTemplate("apporteur-virement-fait", "fr", {
      contactName: "Claire Martin",
      montant: "1 200,00 €",
      numeros: "n° AXI-APP-2026-0003",
      dateVirement: "7 octobre 2026",
    });
    expect(r.subject).toBe("Votre commission est virée");
    expect(r.html).toContain("Bonjour Claire,");
    expect(r.html).toContain("1 200,00 €");
    expect(r.html).toContain("AXI-APP-2026-0003");
    expect(r.html).toContain("7 octobre 2026");
    expect(r.html).toContain("répondez simplement à ce message");
    expect(r.html).not.toContain("undefined");
  });

  it("payload vide : phrase propre, sans « undefined »", async () => {
    const r = await renderEmailTemplate("apporteur-virement-fait", "fr", {});
    expect(r.html).toContain("Bonjour,");
    expect(r.html).toContain("Le virement de votre commission est parti.");
    expect(r.html).not.toContain("undefined");
  });
});

describe("jobIdVirementFait", () => {
  it("trie les numéros : stable quel que soit l'ordre", () => {
    expect(jobIdVirementFait(["AXI-APP-2026-0004", "AXI-APP-2026-0003"])).toBe(
      "apporteur-virement-fait-AXI-APP-2026-0003-AXI-APP-2026-0004",
    );
    expect(jobIdVirementFait(["AXI-APP-2026-0003", "AXI-APP-2026-0004"])).toBe(
      jobIdVirementFait(["AXI-APP-2026-0004", "AXI-APP-2026-0003"]),
    );
  });
  it("ne modifie pas le tableau reçu", () => {
    const n = ["B", "A"];
    jobIdVirementFait(n);
    expect(n).toEqual(["B", "A"]);
  });
});

describe("envoyerConfirmationVirement", () => {
  const base = {
    apporteurId: "APP1",
    destinataire: "claire@exemple.invalid",
    contactName: "Claire Martin",
    montant: "1 200,00 €",
    dateVirement: "7 octobre 2026",
  };

  it("un numéro : « n° X », clé d'idempotence et traçabilité", async () => {
    const r = await envoyerConfirmationVirement({ ...base, numeros: ["AXI-APP-2026-0003"] });
    expect(r).toBe("envoye");
    const [gabarit, dest, , payload, opts] = enqueueEmail.mock.calls[0]! as [
      string,
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(gabarit).toBe("apporteur-virement-fait");
    expect(dest).toBe("claire@exemple.invalid");
    expect(payload).toEqual({
      contactName: "Claire Martin",
      montant: "1 200,00 €",
      numeros: "n° AXI-APP-2026-0003",
      dateVirement: "7 octobre 2026",
    });
    expect(opts).toMatchObject({
      entityType: "ApporteurReseau",
      entityId: "APP1",
      jobId: "apporteur-virement-fait-AXI-APP-2026-0003",
    });
  });

  it("plusieurs numéros : « n° A, n° B » ; aucun : champ absent", async () => {
    await envoyerConfirmationVirement({ ...base, numeros: ["A", "B"] });
    await envoyerConfirmationVirement({ ...base, numeros: [] });
    const p1 = enqueueEmail.mock.calls[0]![3] as Record<string, unknown>;
    const p2 = enqueueEmail.mock.calls[1]![3] as Record<string, unknown>;
    expect(p1["numeros"]).toBe("n° A, n° B");
    expect("numeros" in p2).toBe(false);
  });
});
