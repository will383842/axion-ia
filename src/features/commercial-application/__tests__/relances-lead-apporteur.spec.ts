/**
 * Relances du premier contact — deux invariants :
 *   1. le `jobId` dérive du HASH de l'e-mail (jamais l'adresse) et ne porte
 *      pas de « : » (séparateur de clés BullMQ) ;
 *   2. `annuler` retire exactement les jobs d'une adresse — le kit du dossier
 *      commencé (2026-09-19) et les deux relances —, et se tait si la file est
 *      absente ou si le job est déjà parti.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const retirer = vi.fn(async (_id: string) => 1);
const enfiler = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));
const queueMock = vi.hoisted(() => ({ present: true }));

vi.mock("@/server/queue/queues", () => ({
  get emailsQueue() {
    return queueMock.present ? { remove: (id: string) => retirer(id) } : null;
  },
  enqueueEmail: (...a: unknown[]) => enfiler(...a),
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => (e ? `h-${e.replace(/[^a-z]/g, "")}` : null),
}));
const marquerAnnuleMock = vi.fn(async (_id: string, _motif: string) => 1);
vi.mock("@/server/email/email-log", () => ({
  marquerAnnule: (id: string, motif: string) => marquerAnnuleMock(id, motif),
}));

import {
  annulerRelancesLeadApporteur,
  jobIdKitDossierCommence,
  jobIdRelance,
  planifierKitDossierCommence,
  planifierRelancesLeadApporteur,
} from "../relances-lead-apporteur";
import {
  DELAI_KIT_DOSSIER_COMMENCE_MS,
  VARIANTE_DOSSIER_COMMENCE,
} from "@/lib/commercial-application/kit-apporteur";

beforeEach(() => {
  retirer.mockClear();
  enfiler.mockClear();
  marquerAnnuleMock.mockClear();
  marquerAnnuleMock.mockResolvedValue(1);
  queueMock.present = true;
});

describe("jobIdRelance", () => {
  it("porte le hash, pas l'adresse, et aucun « : »", () => {
    const id = jobIdRelance("j2", "h-nadiaexamplecom");
    expect(id).toBe("lead-apporteur-relance-j2-h-nadiaexamplecom");
    expect(id).not.toContain(":");
  });
});

describe("planifierRelancesLeadApporteur", () => {
  it("pose deux jobs retardés, identifiés par étape et hash", async () => {
    const n = await planifierRelancesLeadApporteur({
      email: "nadia@example.com",
      prenom: "Nadia",
      dossierUrl: "https://axion-ia.com/fr/devenir-commercial-ia/candidature",
      submissionId: "s-1",
    });
    expect(n).toBe(2);
    const ids = enfiler.mock.calls.map((c) => (c[4] as { jobId: string }).jobId);
    expect(ids).toEqual([
      "lead-apporteur-relance-j2-h-nadiaexamplecom",
      "lead-apporteur-relance-j7-h-nadiaexamplecom",
    ]);
    for (const c of enfiler.mock.calls) {
      expect(JSON.stringify(c[4])).not.toContain("nadia@");
    }
  });

  it("sans hash possible, ne pose rien", async () => {
    const n = await planifierRelancesLeadApporteur({
      email: "",
      prenom: "X",
      dossierUrl: "https://axion-ia.com/x",
      submissionId: "s-2",
    });
    expect(n).toBe(0);
    expect(enfiler).not.toHaveBeenCalled();
  });
});

describe("planifierKitDossierCommence — le kit de qui a quitté le dossier", () => {
  it("pose UN job retardé de 30 min : l'accusé, variante « dossier commencé », sans lien d'appel", async () => {
    const pose = await planifierKitDossierCommence({
      email: "nadia@example.com",
      prenom: "Nadia",
      dossierUrl: "https://axion-ia.com/fr/devenir-commercial-ia/candidature",
      submissionId: "s-1",
    });
    expect(pose).toBe(true);
    expect(enfiler).toHaveBeenCalledTimes(1);
    const [gabarit, , , payload, options] = enfiler.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
      { jobId: string; delayMs: number },
    ];
    expect(gabarit).toBe("lead-apporteur-recu");
    expect(payload["variante"]).toBe(VARIANTE_DOSSIER_COMMENCE);
    // ⛔ Le lien de réservation ne part jamais automatiquement (décision Will
    // 2026-09-19) : il saturerait l'agenda.
    expect(JSON.stringify(payload)).not.toMatch(/calendly|creneau/i);
    expect(options.delayMs).toBe(DELAI_KIT_DOSSIER_COMMENCE_MS);
    expect(options.jobId).toBe(jobIdKitDossierCommence("h-nadiaexamplecom"));
    expect(options.jobId).not.toContain(":");
    expect(JSON.stringify(options)).not.toContain("nadia@");
  });
});

describe("annulerRelancesLeadApporteur", () => {
  it("retire le kit ET les deux relances de l'adresse", async () => {
    const n = await annulerRelancesLeadApporteur("nadia@example.com");
    expect(n).toBe(3);
    expect(retirer.mock.calls.map((c) => c[0])).toEqual([
      "lead-apporteur-kit-h-nadiaexamplecom",
      "lead-apporteur-relance-j2-h-nadiaexamplecom",
      "lead-apporteur-relance-j7-h-nadiaexamplecom",
    ]);
  });

  it("file absente : 0, sans erreur", async () => {
    queueMock.present = false;
    await expect(annulerRelancesLeadApporteur("nadia@example.com")).resolves.toBe(0);
    expect(retirer).not.toHaveBeenCalled();
  });

  it("job déjà parti (remove throw ou 0) : on continue, on ne remonte rien", async () => {
    retirer.mockImplementationOnce(async () => {
      throw new Error("job not found");
    });
    retirer.mockImplementationOnce(async () => 0);
    retirer.mockImplementationOnce(async () => 0);
    await expect(annulerRelancesLeadApporteur("nadia@example.com")).resolves.toBe(0);
    expect(retirer).toHaveBeenCalledTimes(3);
  });
});

/**
 * 🔴 2026-09-09 — RETIRER LE JOB NE SUFFIT PAS.
 *
 * La ligne « en attente » posée à l'enfilage n'était refermée par personne : le
 * worker la clôt à l'exécution, et un job annulé n'est jamais exécuté. Elle
 * restait `pending` POUR TOUJOURS, et son échéance passée elle se présentait
 * comme un envoi bloqué — deux lignes dans cet état en production.
 */
describe("annulerRelancesLeadApporteur — le journal est refermé, pas seulement la file", () => {
  it("referme la ligne de CHAQUE job, avec le même identifiant que le job retiré", async () => {
    await annulerRelancesLeadApporteur("nadia@example.com");
    const idsRetires = retirer.mock.calls.map((c) => c[0]);
    const idsRefermes = marquerAnnuleMock.mock.calls.map((c) => c[0]);
    // Le témoin porte sur l'ÉGALITÉ des identifiants, pas sur leur nombre :
    // refermer deux lignes qui ne sont pas celles qu'on vient de retirer serait
    // vert sur un simple compte.
    expect(idsRefermes).toEqual(idsRetires);
    expect(idsRefermes).toEqual([
      "lead-apporteur-kit-h-nadiaexamplecom",
      "lead-apporteur-relance-j2-h-nadiaexamplecom",
      "lead-apporteur-relance-j7-h-nadiaexamplecom",
    ]);
  });

  it("referme la ligne MÊME si le job n'était plus dans la file", async () => {
    // `remove()` rend 0 pour « déjà retiré » comme pour « déjà parti ». La ligne
    // peut être restée ouverte dans le premier cas : ne refermer que sur un
    // retrait réussi laisserait précisément les lignes qu'on veut fermer.
    retirer.mockResolvedValue(0);
    await annulerRelancesLeadApporteur("nadia@example.com");
    expect(marquerAnnuleMock).toHaveBeenCalledTimes(3);
  });

  it("referme la ligne même si le retrait LÈVE", async () => {
    retirer.mockRejectedValue(new Error("redis indisponible"));
    await expect(annulerRelancesLeadApporteur("nadia@example.com")).resolves.toBe(0);
    expect(marquerAnnuleMock).toHaveBeenCalledTimes(3);
  });

  it("porte un motif lisible — le journal doit dire POURQUOI la ligne est close", async () => {
    await annulerRelancesLeadApporteur("nadia@example.com");
    const motif = marquerAnnuleMock.mock.calls[0]?.[1] ?? "";
    expect(motif).toMatch(/annul/i);
    expect(motif).toMatch(/dossier complet/i);
  });

  it("l'appelant peut dire un AUTRE motif — l'invitation envoyée depuis la console", async () => {
    await annulerRelancesLeadApporteur("nadia@example.com", "Envoi annulé : invitation envoyée.");
    expect(
      marquerAnnuleMock.mock.calls.every((c) => c[1] === "Envoi annulé : invitation envoyée."),
    ).toBe(true);
  });
});
