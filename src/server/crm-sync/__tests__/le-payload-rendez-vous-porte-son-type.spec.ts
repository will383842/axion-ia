/**
 * Contrat CRM des rendez-vous (chantier « Types de rendez-vous », 2026-10-04).
 *
 * Le `payload` des événements `calendly_*` porte TOUJOURS `eventTypeName`,
 * `typeRendezVous` et `besoin`, quel que soit le chemin ; la garde
 * anti-apporteur lit le TYPE (repli nom).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const enfilerCrm = vi.fn(async (..._a: unknown[]) => "evt");
vi.mock("@/server/crm-sync/enqueue", () => ({
  enqueueCrmSyncEvent: (...a: unknown[]) => enfilerCrm(...a),
  newCrmEventId: () => "id-1",
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => (e ? `h-${e}` : null),
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
}));

import { syncCalendlyEventToCrm } from "@/server/crm-sync";

const personne = { email: "camille@exemple.test", fullName: "Camille", phone: null };

function payloadEmis(): Record<string, unknown> {
  const evt = enfilerCrm.mock.calls[0]?.[0] as { payload: Record<string, unknown> };
  return evt.payload;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRM_SYNC_ENABLED = "true";
});

describe("la garde anti-apporteur lit le type", () => {
  it("🔴 type « apporteur » au nom neutre : rien ne part", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:1",
      person: personne,
      payload: { eventTypeName: "Échange de 15 minutes", typeRendezVous: "apporteur" },
    });
    expect(enfilerCrm).not.toHaveBeenCalled();
  });

  it("🔴 chemin iframe (slug seul, sans type) : repli sur le slug, rien ne part", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:2",
      person: personne,
      payload: {
        eventTypeSlug: "echange-apporteur-affaires",
        pageUrl: "https://axion-ia.com/fr/appel",
      },
    });
    expect(enfilerCrm).not.toHaveBeenCalled();
  });

  it("TÉMOIN — un échange projet part", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:3",
      person: personne,
      payload: { eventTypeName: "Échange projet", typeRendezVous: "echange_projet" },
    });
    expect(enfilerCrm).toHaveBeenCalledTimes(1);
  });
});

describe("le payload porte toujours les trois champs du contrat", () => {
  it("sondage : type et besoin transmis tels quels", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:4",
      person: personne,
      payload: {
        eventTypeName: "Diagnostic IA",
        typeRendezVous: "diagnostic",
        besoin: null,
        source: "api_poll",
        format: "visio",
      },
    });
    expect(payloadEmis()).toEqual({
      eventTypeName: "Diagnostic IA",
      typeRendezVous: "diagnostic",
      besoin: null,
      source: "api_poll",
      format: "visio",
    });
  });

  it("🔴 iframe sans nom ni type : le nom vient du slug, le type est reclassé, besoin à null", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:5",
      person: personne,
      payload: { eventTypeSlug: "premier-contact", pageUrl: "https://axion-ia.com/fr/appel" },
    });
    expect(payloadEmis()).toMatchObject({
      eventTypeSlug: "premier-contact",
      eventTypeName: "premier-contact",
      typeRendezVous: "echange_projet",
      besoin: null,
    });
  });

  it("un type illisible est reclassé par le nom", async () => {
    await syncCalendlyEventToCrm({
      kind: "canceled",
      subjectRef: "site:calendly_event:6",
      person: personne,
      payload: { eventTypeName: "Rencontre salon GOFAB", typeRendezVous: "n'importe quoi" },
    });
    expect(payloadEmis()["typeRendezVous"]).toBe("salon");
  });
});
