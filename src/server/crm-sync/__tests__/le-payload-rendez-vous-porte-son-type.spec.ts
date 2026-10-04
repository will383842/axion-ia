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
      reponses: [],
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

describe("les réponses du questionnaire (L5b) — diagnostic et échange projet seulement", () => {
  const longue = "x".repeat(500);

  it("diagnostic : les réponses partent, bornées (10 entrées, 120 / 300 caractères)", async () => {
    const reponses = Array.from({ length: 14 }, (_, i) => ({
      question: `Question ${i} ${longue}`,
      reponse: `Réponse ${i} ${longue}`,
    }));
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:7",
      person: personne,
      payload: { eventTypeName: "Diagnostic IA", typeRendezVous: "diagnostic", reponses },
    });
    const emises = payloadEmis()["reponses"] as Array<{ question: string; reponse: string }>;
    expect(emises).toHaveLength(10);
    expect(emises[0]?.question.length).toBeLessThanOrEqual(120);
    expect(emises[0]?.reponse.length).toBeLessThanOrEqual(300);
    expect(emises[0]?.question.startsWith("Question 0")).toBe(true);
  });

  it("échange projet : une entrée illisible est écartée, les autres restent", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:8",
      person: personne,
      payload: {
        eventTypeName: "Échange projet",
        typeRendezVous: "echange_projet",
        reponses: [
          { question: "Quel service vous intéresse ?", reponse: "Formation" },
          { question: 42, reponse: "x" },
          { question: "Vide", reponse: "   " },
        ],
      },
    });
    expect(payloadEmis()["reponses"]).toEqual([
      { question: "Quel service vous intéresse ?", reponse: "Formation" },
    ]);
  });

  it("🔴 salon et autre : aucune réponse ne part, même si l'appelant en fournit", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:9",
      person: personne,
      payload: {
        eventTypeName: "Rencontre salon GOFAB",
        typeRendezVous: "salon",
        reponses: [{ question: "Q", reponse: "R" }],
      },
    });
    expect(payloadEmis()).not.toHaveProperty("reponses");
  });
});

describe("🔴 une coupe ne casse jamais un emoji (relecture A09)", () => {
  // Un surrogate orphelin rend le JSON invalide pour le CRM : 422, refus
  // définitif, et TOUT le rendez-vous est perdu pour le CRM.
  const SURROGATE_ISOLE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
  // `JSON.stringify` écrit un surrogate isolé en `\udXXX` (6 caractères
  // ASCII) : on cherche donc AUSSI cette forme échappée.
  const SURROGATE_ECHAPPE = /\ud[89a-f][0-9a-f]{2}/i;
  const surrogateIsole = (v: unknown): boolean => {
    const json = JSON.stringify(v);
    return SURROGATE_ISOLE.test(json) || SURROGATE_ECHAPPE.test(json);
  };
  const emoji = "\u{1F600}"; // 2 unités UTF-16

  it("réponse et question : emoji pile à la limite → aucun surrogate isolé", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:10",
      person: personne,
      payload: {
        eventTypeName: "Diagnostic IA",
        typeRendezVous: "diagnostic",
        reponses: [{ question: "q".repeat(119) + emoji, reponse: "r".repeat(299) + emoji }],
      },
    });
    expect(surrogateIsole(payloadEmis())).toBe(false);
  });

  it("besoin : emoji pile à la limite → aucun surrogate isolé", async () => {
    await syncCalendlyEventToCrm({
      kind: "booked",
      subjectRef: "site:calendly_event:11",
      person: personne,
      payload: {
        eventTypeName: "Échange projet",
        typeRendezVous: "echange_projet",
        besoin: "b".repeat(299) + emoji + "suite",
      },
    });
    expect(surrogateIsole(payloadEmis())).toBe(false);
    expect((payloadEmis()["besoin"] as string).length).toBeLessThanOrEqual(300);
  });
});
