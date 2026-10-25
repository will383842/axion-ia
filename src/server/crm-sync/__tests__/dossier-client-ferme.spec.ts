/**
 * Le type `dossier_client_synchro` n'écrit RIEN dans l'outbox tant que
 * `CRM_SYNC_DOSSIER_ENABLED` n'est pas exactement « true » — même si le
 * drapeau maître est ouvert (25/10/2026).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const creer = vi.hoisted(() => vi.fn(async () => ({ id: "ligne-1" })));
vi.mock("@/lib/prisma", () => ({ prisma: { crmSyncOutbox: { create: creer } } }));
vi.mock("@/server/queue/queues", () => ({ crmSyncQueue: null }));

import { enqueueCrmSyncEvent } from "@/server/crm-sync/enqueue";
import { evenementDossierClient } from "@/server/crm-sync/instantane-dossier";

const evenement = evenementDossierClient(
  {
    clientId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    numero: "AXI-CLI-004",
    raisonSociale: "Société Fictive",
    siren: null,
    adresseRue: null,
    adresseCodePostal: null,
    adresseVille: null,
    telephone: null,
    effectif: null,
    factureEmise: false,
    urlConsole: null,
    questionnaire: null,
    contacts: [],
  },
  1,
  new Date("2026-10-25T10:00:00Z"),
);

afterEach(() => {
  vi.unstubAllEnvs();
  creer.mockClear();
});

describe("flux dossier client : verrou d'inertie", () => {
  it("drapeau maître fermé : rien", async () => {
    vi.stubEnv("CRM_SYNC_ENABLED", "false");
    vi.stubEnv("CRM_SYNC_DOSSIER_ENABLED", "true");
    expect(await enqueueCrmSyncEvent(evenement)).toBeNull();
    expect(creer).not.toHaveBeenCalled();
  });

  it("drapeau maître ouvert, drapeau dossier fermé : rien", async () => {
    vi.stubEnv("CRM_SYNC_ENABLED", "true");
    vi.stubEnv("CRM_SYNC_DOSSIER_ENABLED", "false");
    expect(await enqueueCrmSyncEvent(evenement)).toBeNull();
    expect(creer).not.toHaveBeenCalled();
  });

  it("les deux ouverts : une ligne, sans personne ni consentement", async () => {
    vi.stubEnv("CRM_SYNC_ENABLED", "true");
    vi.stubEnv("CRM_SYNC_DOSSIER_ENABLED", "true");
    expect(await enqueueCrmSyncEvent(evenement)).toBe("ligne-1");
    expect(creer).toHaveBeenCalledTimes(1);
  });
});
