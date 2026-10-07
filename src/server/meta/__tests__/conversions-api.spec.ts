/**
 * API Conversions Meta — trois garanties, testées sans réseau :
 *   1. rien ne part sans consentement, même jeton configuré ;
 *   2. rien ne part en clair : e-mail, téléphone, prénom, ville hachés au
 *      format Meta (normalisation puis SHA-256) ;
 *   3. un refus ou une panne ne remonte jamais — la candidature est déjà en base.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const envMock = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_META_PIXEL_ID: "123456789",
    META_CAPI_ACCESS_TOKEN: "jeton-de-test",
    META_CAPI_TEST_EVENT_CODE: undefined as string | undefined,
  },
}));
vi.mock("@/env", () => envMock);
vi.mock("@sentry/nextjs", () => ({
  captureException: () => undefined,
  captureMessage: () => undefined,
}));

import {
  construireEvenementLead,
  construireEvenementMeta,
  envoyerEvenementMeta,
  envoyerLeadMeta,
  type EvenementMetaInput,
  normaliserTelephoneMeta,
  normaliserTexteMeta,
  type LeadMetaInput,
} from "../conversions-api";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

const input: LeadMetaInput = {
  submissionId: "11111111-1111-4111-8111-111111111111",
  email: "  Nadia.Dupont@Example.com ",
  telephone: "06 12 34 56 78",
  prenom: "Nadia-Élise",
  ville: "Saint-Étienne",
  ip: "203.0.113.7",
  userAgent: "vitest",
  fbp: "fb.1.1725000000000.123456",
  fbclid: "IwAR0abcdefghijklmnop",
  sourceUrl: "https://axion-ia.com/fr/apporteur-affaires",
  at: new Date("2026-09-03T10:00:00Z"),
};

describe("normalisation Meta", () => {
  it("téléphone français → indicatif 33 sans le zéro, chiffres seuls", () => {
    expect(normaliserTelephoneMeta("06 12 34 56 78")).toBe("33612345678");
    expect(normaliserTelephoneMeta("+33 6 12 34 56 78")).toBe("33612345678");
    expect(normaliserTelephoneMeta("0033612345678")).toBe("33612345678");
    expect(normaliserTelephoneMeta("12")).toBeNull();
  });

  it("texte : minuscules, sans accents ni ponctuation", () => {
    expect(normaliserTexteMeta("Nadia-Élise")).toBe("nadiaelise");
    expect(normaliserTexteMeta(" Saint-Étienne ")).toBe("saintetienne");
  });
});

describe("construireEvenementLead", () => {
  it("hache chaque donnée personnelle et ne transmet rien en clair", () => {
    const ev = construireEvenementLead(input);
    expect(ev.event_name).toBe("Lead");
    expect(ev.event_id).toBe(input.submissionId);
    expect(ev.action_source).toBe("website");
    expect(ev.event_time).toBe(Math.floor(input.at.getTime() / 1000));
    expect(ev.user_data.em).toEqual([sha("nadia.dupont@example.com")]);
    expect(ev.user_data.ph).toEqual([sha("33612345678")]);
    expect(ev.user_data.fn).toEqual([sha("nadiaelise")]);
    expect(ev.user_data.ct).toEqual([sha("saintetienne")]);
    const brut = JSON.stringify(ev);
    expect(brut).not.toContain("nadia");
    expect(brut).not.toContain("0612");
    expect(brut).not.toContain("tienne");
  });

  it("porte fbp tel quel et construit fbc depuis le fbclid", () => {
    const ev = construireEvenementLead(input);
    expect(ev.user_data.fbp).toBe(input.fbp);
    expect(ev.user_data.fbc).toBe(`fb.1.${input.at.getTime()}.${input.fbclid}`);
  });

  it("omet fbp/fbc/ip/ua quand ils manquent — jamais une chaîne vide", () => {
    const ev = construireEvenementLead({
      ...input,
      fbp: null,
      fbclid: null,
      ip: null,
      userAgent: null,
    });
    expect(ev.user_data).not.toHaveProperty("fbp");
    expect(ev.user_data).not.toHaveProperty("fbc");
    expect(ev.user_data).not.toHaveProperty("client_ip_address");
    expect(ev.user_data).not.toHaveProperty("client_user_agent");
  });
});

describe("envoyerLeadMeta", () => {
  beforeEach(() => {
    envMock.env.NEXT_PUBLIC_META_PIXEL_ID = "123456789";
    envMock.env.META_CAPI_ACCESS_TOKEN = "jeton-de-test";
    envMock.env.META_CAPI_TEST_EVENT_CODE = undefined;
  });

  it("ne part PAS sans consentement, même jeton configuré", async () => {
    const fetchImpl = vi.fn();
    const r = await envoyerLeadMeta(input, {
      consentPub: "declined",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ envoye: false, motif: "sans_consentement" });
    expect(fetchImpl).not.toHaveBeenCalled();
    const r2 = await envoyerLeadMeta(input, {
      consentPub: undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r2.envoye).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("ne part pas sans jeton ni identifiant de pixel", async () => {
    envMock.env.META_CAPI_ACCESS_TOKEN = undefined as unknown as string;
    const fetchImpl = vi.fn();
    const r = await envoyerLeadMeta(input, {
      consentPub: "accepted",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ envoye: false, motif: "non_configure" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("avec consentement : POST vers graph.facebook.com, jeton dans le corps, pas dans l'URL", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await envoyerLeadMeta(input, {
      consentPub: "accepted",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ envoye: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/123456789/events");
    expect(url).not.toContain("jeton-de-test");
    const corps = JSON.parse(String(init.body)) as {
      access_token: string;
      data: unknown[];
      test_event_code?: string;
    };
    expect(corps.access_token).toBe("jeton-de-test");
    expect(corps.data).toHaveLength(1);
    expect(corps.test_event_code).toBeUndefined();
  });

  it("porte le code d'événement de test quand il est posé", async () => {
    envMock.env.META_CAPI_TEST_EVENT_CODE = "TEST123";
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await envoyerLeadMeta(input, {
      consentPub: "accepted",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((JSON.parse(String(init.body)) as { test_event_code?: string }).test_event_code).toBe(
      "TEST123",
    );
  });

  it("un refus 4xx ou une panne réseau rendent { envoye: false } sans jamais throw", async () => {
    const refus = vi.fn(async () => new Response("bad", { status: 400 }));
    await expect(
      envoyerLeadMeta(input, {
        consentPub: "accepted",
        fetchImpl: refus as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ envoye: false, motif: "refus" });

    const panne = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    await expect(
      envoyerLeadMeta(input, {
        consentPub: "accepted",
        fetchImpl: panne as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ envoye: false, motif: "reseau" });
  });
});

describe("envoyerEvenementMeta — l'événement est un paramètre (lot 5, 2026-10-05)", () => {
  const evt: EvenementMetaInput = {
    eventId: "lead:11111111-1111-4111-8111-111111111111",
    email: "Nadia@Example.com",
    prenom: "Nadia",
    sourceUrl: "https://axion-ia.com/fr/apporteur-affaires/video",
    at: new Date("2026-10-05T10:00:00Z"),
  };

  beforeEach(() => {
    envMock.env.NEXT_PUBLIC_META_PIXEL_ID = "123456789";
    envMock.env.META_CAPI_ACCESS_TOKEN = "jeton-de-test";
    envMock.env.META_CAPI_TEST_EVENT_CODE = undefined;
  });

  it("le nom d'événement n'est plus codé en dur : Lead et Schedule", () => {
    expect(construireEvenementMeta("Lead", evt).event_name).toBe("Lead");
    expect(construireEvenementMeta("Schedule", evt).event_name).toBe("Schedule");
  });

  it("l'event_id est transmis TEL QUEL : c'est ce qui fait dédoublonner Meta avec le navigateur", () => {
    expect(construireEvenementMeta("Lead", evt).event_id).toBe(evt.eventId);
    expect(construireEvenementMeta("Schedule", { ...evt, eventId: "schedule:cm42" }).event_id).toBe(
      "schedule:cm42",
    );
  });

  it("à l'étape 1 (ni téléphone ni ville) : ces champs sont OMIS, jamais le hachage d'une chaîne vide", () => {
    const ev = construireEvenementMeta("Lead", evt);
    expect(ev.user_data.em).toEqual([sha("nadia@example.com")]);
    expect(ev.user_data.fn).toEqual([sha("nadia")]);
    expect(ev.user_data).not.toHaveProperty("ph");
    expect(ev.user_data).not.toHaveProperty("ct");
    expect(JSON.stringify(ev)).not.toContain(sha(""));
  });

  it("fbc : l'heure d'ARRIVÉE du clic quand on la connaît, sinon l'heure de l'événement", () => {
    const arrivee = new Date("2026-10-05T09:58:00Z");
    expect(
      construireEvenementMeta("Lead", {
        ...evt,
        fbclid: "IwAR0abcdefghijklmnop",
        fbcCreeLe: arrivee,
      }).user_data.fbc,
    ).toBe(`fb.1.${arrivee.getTime()}.IwAR0abcdefghijklmnop`);
    expect(
      construireEvenementMeta("Lead", { ...evt, fbclid: "IwAR0abcdefghijklmnop" }).user_data.fbc,
    ).toBe(`fb.1.${evt.at.getTime()}.IwAR0abcdefghijklmnop`);
  });

  it("LA RÈGLE DE REFUS EST CONSERVÉE POUR CHAQUE ÉVÉNEMENT : rien ne part sans « accepted »", async () => {
    for (const nom of ["Lead", "Schedule"] as const) {
      const fetchImpl = vi.fn();
      for (const consentPub of ["declined", "unknown", undefined] as const) {
        const r = await envoyerEvenementMeta(nom, evt, {
          consentPub,
          fetchImpl: fetchImpl as unknown as typeof fetch,
        });
        expect(r, `${nom} / ${String(consentPub)}`).toEqual({
          envoye: false,
          motif: "sans_consentement",
        });
      }
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("avec consentement, l'événement demandé part avec son event_id, jeton dans le corps", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await envoyerEvenementMeta(
      "Schedule",
      { ...evt, eventId: "schedule:cm42" },
      { consentPub: "accepted", fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(r).toEqual({ envoye: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("jeton-de-test");
    const corps = JSON.parse(String(init.body)) as {
      access_token: string;
      data: Array<{ event_name: string; event_id: string }>;
    };
    expect(corps.access_token).toBe("jeton-de-test");
    expect(corps.data[0]).toMatchObject({ event_name: "Schedule", event_id: "schedule:cm42" });
  });

  it("l'ancienne enveloppe `envoyerLeadMeta` envoie toujours `Lead` avec l'id de la candidature (page merci inchangée)", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await envoyerLeadMeta(input, {
      consentPub: "accepted",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const corps = JSON.parse(String(init.body)) as {
      data: Array<{ event_name: string; event_id: string }>;
    };
    expect(corps.data[0]).toMatchObject({ event_name: "Lead", event_id: input.submissionId });
  });
});
