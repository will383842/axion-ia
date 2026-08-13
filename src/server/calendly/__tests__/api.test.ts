// Tests du client API Calendly v2 (ADR 0036).
//
// Ce module porte deux risques qui justifient une couverture serrée :
//   1. il envoie un Personal Access Token à une URL issue d'un postMessage —
//      donc d'une source non fiable : le filtrage d'hôte est une barrière SSRF,
//      pas une validation cosmétique ;
//   2. il est le seul chemin par lequel un nom et un email peuvent entrer dans
//      la base sans ressaisie humaine : une régression y serait silencieuse.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCalendlyInvitee, isCalendlyApiConfigured } from "../api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.CALENDLY_API_TOKEN = "pat_test_token";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

const INVITEE_URI = "https://api.calendly.com/scheduled_events/EVT/invitees/INV";
const EVENT_URI = "https://api.calendly.com/scheduled_events/EVT";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("isCalendlyApiConfigured", () => {
  it("faux sans jeton, faux si le jeton n'est que des espaces", () => {
    delete process.env.CALENDLY_API_TOKEN;
    expect(isCalendlyApiConfigured()).toBe(false);
    process.env.CALENDLY_API_TOKEN = "   ";
    expect(isCalendlyApiConfigured()).toBe(false);
  });

  it("vrai avec un jeton", () => {
    expect(isCalendlyApiConfigured()).toBe(true);
  });
});

describe("fetchCalendlyInvitee — garde-fous", () => {
  it("sans jeton : ne touche pas au réseau", async () => {
    delete process.env.CALENDLY_API_TOKEN;
    const res = await fetchCalendlyInvitee(INVITEE_URI, EVENT_URI);
    expect(res).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Le cœur de la protection SSRF : le jeton part dans l'en-tête Authorization,
  // donc toute URI acceptée hors api.calendly.com le fuiterait.
  it.each([
    ["hôte voisin", "https://api.calendly.com.attacker.test/scheduled_events/X/invitees/Y"],
    ["sous-domaine forgé", "https://evil.com/api.calendly.com/invitees/Y"],
    ["HTTP en clair", "http://api.calendly.com/scheduled_events/X/invitees/Y"],
    ["IP interne", "https://169.254.169.254/latest/meta-data"],
    ["chaîne vide", ""],
    ["URI non absolue", "/scheduled_events/X/invitees/Y"],
  ])("refuse une URI hostile (%s) sans émettre de requête", async (_label, uri) => {
    const res = await fetchCalendlyInvitee(uri, EVENT_URI);
    expect(res).toEqual({ ok: false, reason: "bad_uri" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuse aussi une URI d'event hostile, sans perdre les données invitee", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ resource: { name: "Jean", email: "j@x.fr" } }));
    const res = await fetchCalendlyInvitee(INVITEE_URI, "https://evil.test/scheduled_events/X");
    expect(res.ok).toBe(true);
    // Un seul appel : l'URI d'event a été écartée avant tout fetch.
    expect(fetchMock).toHaveBeenCalledOnce();
    if (res.ok) expect(res.data.inviteeName).toBe("Jean");
  });
});

describe("fetchCalendlyInvitee — résolution", () => {
  it("assemble invitee + event en un seul view-model", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonRes({
          resource: {
            name: "Jean Dupont",
            email: "jean@example.com",
            timezone: "Europe/Paris",
            status: "active",
            cancel_url: "https://calendly.com/cancellations/abc",
            reschedule_url: "https://calendly.com/reschedulings/abc",
            questions_and_answers: [
              { question: "Votre société ?", answer: "ACME" },
              { question: "Numéro de téléphone", answer: "+33 6 12 34 56 78" },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonRes({
          resource: {
            name: "Premier contact — 30 min",
            start_time: "2026-08-03T09:00:00.000000Z",
            end_time: "2026-08-03T09:30:00.000000Z",
            location: { type: "google_conference", join_url: "https://meet.google.com/xyz" },
          },
        }),
      );

    const res = await fetchCalendlyInvitee(INVITEE_URI, EVENT_URI);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({
      inviteeName: "Jean Dupont",
      inviteeEmail: "jean@example.com",
      inviteePhone: "+33 6 12 34 56 78",
      timezone: "Europe/Paris",
      calendlyStatus: "active",
      location: "https://meet.google.com/xyz",
      eventTypeName: "Premier contact — 30 min",
      cancelUrl: "https://calendly.com/cancellations/abc",
    });
    expect(res.data.startTime?.toISOString()).toBe("2026-08-03T09:00:00.000Z");
    expect(res.data.endTime?.toISOString()).toBe("2026-08-03T09:30:00.000Z");
    // Réponses libres : la question téléphone est EXCLUE (déjà portée par
    // `inviteePhone` — sinon le numéro apparaît deux fois dans la notif).
    expect(res.data.answersText).toBe("Votre société ? : ACME");
  });

  it("envoie le jeton en Bearer et ne met pas la réponse en cache", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ resource: {} }));
    await fetchCalendlyInvitee(INVITEE_URI);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { cache?: string };
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer pat_test_token");
    expect(init.cache).toBe("no-store");
  });

  it("préfère text_reminder_number au balayage des questions", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonRes({
        resource: {
          text_reminder_number: "+33700000000",
          questions_and_answers: [{ question: "Téléphone", answer: "+33 6 99 99 99 99" }],
        },
      }),
    );
    const res = await fetchCalendlyInvitee(INVITEE_URI);
    if (!res.ok) throw new Error("attendu ok");
    expect(res.data.inviteePhone).toBe("+33700000000");
  });

  // Régression 2026-07-29 constatée en production : sur le type d'event réel
  // d'Axion-IA, Calendly range le numéro de l'invité dans `event.location`
  // (type `outbound_call`). Sans ce repli, la fiche affichait le numéro dans
  // « Lieu / URL Meet » et laissait « Téléphone » vide.
  it("récupère le numéro depuis le lieu quand l'event est un appel téléphonique", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ resource: { name: "Jean" } })).mockResolvedValueOnce(
      jsonRes({
        resource: { location: { type: "outbound_call", location: "+33 7 55 51 23 45" } },
      }),
    );
    const res = await fetchCalendlyInvitee(INVITEE_URI, EVENT_URI);
    if (!res.ok) throw new Error("attendu ok");
    expect(res.data.inviteePhone).toBe("+33 7 55 51 23 45");
  });

  // Garde-fou : une visio n'est pas un téléphone.
  it("ne recopie JAMAIS une URL de visio dans le champ téléphone", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ resource: { name: "Jean" } })).mockResolvedValueOnce(
      jsonRes({
        resource: {
          location: { type: "google_conference", join_url: "https://meet.google.com/xyz" },
        },
      }),
    );
    const res = await fetchCalendlyInvitee(INVITEE_URI, EVENT_URI);
    if (!res.ok) throw new Error("attendu ok");
    expect(res.data.inviteePhone).toBeNull();
    expect(res.data.location).toBe("https://meet.google.com/xyz");
  });

  it("une question dédiée prime sur le lieu", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonRes({
          resource: { questions_and_answers: [{ question: "Téléphone", answer: "+33600000000" }] },
        }),
      )
      .mockResolvedValueOnce(
        jsonRes({ resource: { location: { type: "outbound_call", location: "+33711111111" } } }),
      );
    const res = await fetchCalendlyInvitee(INVITEE_URI, EVENT_URI);
    if (!res.ok) throw new Error("attendu ok");
    expect(res.data.inviteePhone).toBe("+33600000000");
  });

  it("ignore une réponse vide à la question téléphone", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonRes({ resource: { questions_and_answers: [{ question: "Téléphone", answer: "  " }] } }),
    );
    const res = await fetchCalendlyInvitee(INVITEE_URI);
    if (!res.ok) throw new Error("attendu ok");
    expect(res.data.inviteePhone).toBeNull();
  });

  // Un échec de l'event (droits partiels, event purgé) ne doit pas faire perdre
  // le contact, qui est l'information la plus précieuse des deux.
  it("l'échec de l'appel event ne fait pas échouer la résolution", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes({ resource: { name: "Jean", email: "j@x.fr" } }))
      .mockResolvedValueOnce(jsonRes({ message: "not found" }, 404));
    const res = await fetchCalendlyInvitee(INVITEE_URI, EVENT_URI);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.inviteeName).toBe("Jean");
    expect(res.data.startTime).toBeNull();
  });

  it.each([
    [401, "forbidden"],
    [403, "forbidden"],
    [404, "not_found"],
    [500, "http_error"],
  ])("statut %i → reason %s", async (status, reason) => {
    fetchMock.mockResolvedValueOnce(jsonRes({}, status));
    const res = await fetchCalendlyInvitee(INVITEE_URI);
    expect(res).toMatchObject({ ok: false, reason });
  });

  it("timeout / DNS → network_error (jamais de throw)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("aborted"));
    const res = await fetchCalendlyInvitee(INVITEE_URI);
    expect(res).toEqual({ ok: false, reason: "network_error" });
  });

  it("corps non-JSON → http_error (jamais de throw)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>oops</html>", { status: 200 }));
    const res = await fetchCalendlyInvitee(INVITEE_URI);
    expect(res).toMatchObject({ ok: false, reason: "http_error" });
  });
});
