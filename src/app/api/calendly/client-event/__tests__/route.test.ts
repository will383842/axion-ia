// Tests POST /api/calendly/client-event (Sprint Notif Infra 2026-05-26 / Chantier 3).
//
// On mocke Prisma + rate-limit + notify + hashIp pour tester sans dependances.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mocks ---------------------------------------------------------------------

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

vi.mock("@/lib/security/ip-hash", () => ({
  hashIp: (ip: string | null | undefined) => (ip ? `hash-${ip}` : null),
}));

// 🔴 Mock MANQUANT depuis la PR 598 (lot L2 du chantier CRM), qui a ajoute
// (cite sans diese : check-anti-hex.sh prend un numero de PR a trois
//  chiffres pour une couleur hexadecimale a trois chiffres.)
// `syncCalendlyEventToCrm` a la route sans l'ajouter ici. Sans ce mock, la
// synchro partait POUR DE VRAI pendant le test : les deux cas ci-dessous
// expiraient a 5 s, et « rate limit depasse » rendait 200 au lieu de 429.
//
// Consequence : le hook de PRE-PUSH de ce depot (qui lance la suite complete)
// refusait TOUT push, pour tout le monde. Constate le 2026-08-17.
const syncCalendlyMock = vi.fn();
vi.mock("@/server/crm-sync", () => ({
  syncCalendlyEventToCrm: (...args: unknown[]) => syncCalendlyMock(...args),
}));

const notifyMock = vi.fn();
vi.mock("@/server/notifications", () => ({
  notify: (...args: unknown[]) => notifyMock(...args),
}));

const calendlyFindFirst = vi.fn();
const calendlyFindUnique = vi.fn();
const calendlyCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findFirst: (...args: unknown[]) => calendlyFindFirst(...args),
      findUnique: (...args: unknown[]) => calendlyFindUnique(...args),
      create: (...args: unknown[]) => calendlyCreate(...args),
    },
  },
}));

// ---------------------------------------------------------------------------

// 🔴 `origin` ET `host` sont désormais posés par défaut, et ce n'est pas du
// confort de test : depuis le 2026-08-27 la route exige une origine, avec
// `allowMissingOrigin: false`. Sans ces deux en-têtes, TOUS les cas de ce
// fichier rendraient 403 — c'est ce qui prouve que la garde mord.
//
// Les deux ensemble sont nécessaires : `requireSameOrigin` fait confiance à
// l'origine égale au HÔTE de la requête (`x-forwarded-host` ?? `host`), et un
// objet `Request` construit à la main ne porte pas d'en-tête `host`
// automatiquement. Poser l'un sans l'autre rejetterait.
function makeRequest(
  body: unknown,
  opts: { ip?: string; origin?: string | null } = {},
): NextRequest {
  const origin = opts.origin === undefined ? "https://test.local" : opts.origin;
  return new NextRequest("https://test.local/api/calendly/client-event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "test.local",
      "x-forwarded-proto": "https",
      ...(origin ? { origin } : {}),
      ...(opts.ip ? { "x-forwarded-for": opts.ip } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  eventName: "calendly.event_scheduled" as const,
  payload: { invitee: { name: "John Doe", email: "john@example.com" } },
  eventTypeSlug: "appel-decouverte",
  pageUrl: "https://axion-ia.com/fr/appel",
  utmSource: "linkedin",
};

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({
    allowed: true,
    count: 1,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  });
  calendlyFindFirst.mockResolvedValue(null);
  calendlyFindUnique.mockResolvedValue(null);
  calendlyCreate.mockResolvedValue({ id: "evt_abc" });
  notifyMock.mockResolvedValue({ ok: true, channels: {} });
  delete process.env.CALENDLY_API_TOKEN;
});

describe("POST /api/calendly/client-event", () => {
  it("happy path — 200 + event créé + notify appelé", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_PAYLOAD, { ip: "1.2.3.4" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, eventId: "evt_abc" });
    expect(calendlyCreate).toHaveBeenCalledOnce();
    expect(notifyMock).toHaveBeenCalledOnce();
    const call = notifyMock.mock.calls[0]?.[0] as { category: string };
    expect(call.category).toBe("CALENDLY_INVITEE_CREATED");
  });

  it("rate limit dépassé → 429", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      count: 6,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(429);
    expect(calendlyCreate).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("JSON invalide → 400 invalid_json", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest("not-json{{{"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_json");
  });

  it("payload invalide (eventName != event_scheduled) → 400 invalid_payload", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        ...VALID_PAYLOAD,
        eventName: "calendly.profile_page_viewed",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_payload");
  });

  it("dédup 60s → 200 deduped, pas de create ni notify", async () => {
    calendlyFindFirst.mockResolvedValueOnce({ id: "prev_evt" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_PAYLOAD, { ip: "5.6.7.8" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, deduped: true });
    expect(calendlyCreate).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("payload sans invitee.email → inviteeEmail/Name omis, event créé quand même", async () => {
    const { POST } = await import("../route");
    const payloadNoPii = {
      ...VALID_PAYLOAD,
      payload: { event: { uri: "..." } }, // pas d'invitee
    };
    const res = await POST(makeRequest(payloadNoPii));
    expect(res.status).toBe(200);
    expect(calendlyCreate).toHaveBeenCalledOnce();
    const createArgs = calendlyCreate.mock.calls[0]?.[0] as {
      data: { inviteeName?: string; inviteeEmail?: string };
    };
    expect(createArgs.data.inviteeName).toBeUndefined();
    expect(createArgs.data.inviteeEmail).toBeUndefined();
  });
});

// ── Capture des URI (ADR 0036) ──────────────────────────────────────────────
//
// Ce que Calendly envoie RÉELLEMENT en Embed JS : deux URI, rien d'autre. Le
// code d'origine ne lisait que `invitee.name` / `.email`, absents de ce
// payload — toutes les réservations arrivaient donc vides. Ces tests
// verrouillent l'extraction, car c'est la seule donnée exploitable dont on
// dispose et sa perte est silencieuse.

const REAL_EMBED_PAYLOAD = {
  eventName: "calendly.event_scheduled" as const,
  payload: {
    event: { uri: "https://api.calendly.com/scheduled_events/EVT-UUID" },
    invitee: { uri: "https://api.calendly.com/scheduled_events/EVT-UUID/invitees/INV-UUID" },
  },
  eventTypeSlug: "premier-contact",
  pageUrl: "https://axion-ia.com/fr/appel",
};

describe("capture des URI Calendly", () => {
  it("persiste event.uri et invitee.uri du payload réel", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest(REAL_EMBED_PAYLOAD, { ip: "1.2.3.4" }));
    expect(res.status).toBe(200);
    const createArgs = calendlyCreate.mock.calls[0]?.[0] as {
      data: { eventUri?: string; inviteeUri?: string };
    };
    expect(createArgs.data.eventUri).toBe("https://api.calendly.com/scheduled_events/EVT-UUID");
    expect(createArgs.data.inviteeUri).toBe(
      "https://api.calendly.com/scheduled_events/EVT-UUID/invitees/INV-UUID",
    );
  });

  it("rejette une URI qui n'est pas sur api.calendly.com", async () => {
    const { POST } = await import("../route");
    await POST(
      makeRequest({
        ...REAL_EMBED_PAYLOAD,
        payload: {
          event: { uri: "https://api.calendly.com.attacker.test/scheduled_events/X" },
          invitee: { uri: "http://api.calendly.com/scheduled_events/X/invitees/Y" },
        },
      }),
    );
    const createArgs = calendlyCreate.mock.calls[0]?.[0] as {
      data: { eventUri?: string; inviteeUri?: string };
    };
    expect(createArgs.data.eventUri).toBeUndefined();
    expect(createArgs.data.inviteeUri).toBeUndefined();
  });

  it("dédup par invitee.uri, sans passer par l'heuristique IP + 60 s", async () => {
    calendlyFindUnique.mockResolvedValueOnce({ id: "already_here" });
    const { POST } = await import("../route");
    const res = await POST(makeRequest(REAL_EMBED_PAYLOAD, { ip: "9.9.9.9" }));
    expect(await res.json()).toEqual({ ok: true, deduped: true });
    expect(calendlyCreate).not.toHaveBeenCalled();
    // L'heuristique de repli rejetait à tort deux réservations légitimes prises
    // coup sur coup depuis le même poste : elle ne doit plus être consultée dès
    // qu'une URI est disponible.
    expect(calendlyFindFirst).not.toHaveBeenCalled();
  });

  it("une violation d'unicité concurrente est un doublon, pas une 500", async () => {
    calendlyCreate.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    const { POST } = await import("../route");
    const res = await POST(makeRequest(REAL_EMBED_PAYLOAD));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deduped: true });
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("sans jeton API, aucun enrichissement n'est tenté", async () => {
    const { POST } = await import("../route");
    await POST(makeRequest(REAL_EMBED_PAYLOAD));
    // L'enrichissement relirait la ligne juste créée : aucune relecture ⇒ inerte.
    expect(calendlyFindUnique).toHaveBeenCalledTimes(1); // la dédup, uniquement
    const notifyArgs = notifyMock.mock.calls[0]?.[0] as {
      payload: { inviteeName: string; eventStartTime: string };
    };
    expect(notifyArgs.payload.inviteeName).toBe("(non communiqué)");
    expect(notifyArgs.payload.eventStartTime).toBe("(voir mail Calendly)");
  });
});

// ---------------------------------------------------------------------------
// La porte publique — ajouté le 2026-08-27 (constat N-2 de l'audit réservation).
//
// Cette route était une porte d'ÉCRITURE PUBLIQUE : aucune origine vérifiée,
// aucune borne sur les PII, et une clé de déduplication qui ne dédoublonnait
// rien. Chacun des quatre cas ci-dessous ÉCHOUE sur `origin/main` — c'est la
// seule chose qui donne de la valeur à ce bloc.
// ---------------------------------------------------------------------------

describe("POST /api/calendly/client-event — la porte est fermée", () => {
  it("refuse une origine étrangère en 403, sans rien écrire", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_PAYLOAD, { origin: "https://attaquant.example" }));
    expect(res.status).toBe(403);
    // Le point qui compte : aucune ligne, aucune fiche CRM, aucune alerte.
    expect(calendlyCreate).not.toHaveBeenCalled();
    expect(syncCalendlyMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("refuse une requête sans AUCUN en-tête de contexte", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_PAYLOAD, { origin: null }));
    // ⚠️ C'est le cœur du correctif. Le défaut de `requireSameOrigin` est
    // `allowMissingOrigin: true`, qui TOLÈRE ce cas : avec le défaut, cette
    // assertion rendrait 200 et la garde n'aurait rien gardé.
    expect(res.status).toBe(403);
    expect(calendlyCreate).not.toHaveBeenCalled();
  });

  it("TÉMOIN — un client qui POSE l'en-tête d'origine passe encore", async () => {
    // 🔴 CE TEST DOCUMENTE UN TROU, il ne célèbre pas une garde.
    //
    // `TRUSTED_ORIGINS` (`src/lib/same-origin.ts`) contient `axion-ia.com` en
    // dur : `curl -H 'Origin: https://axion-ia.com'` passe. Ce qui est fermé,
    // c'est le CSRF navigateur et le balayage nu — pas l'appel scripté informé.
    //
    // Le laisser vert est délibéré : le jour où il ROUGIT, c'est qu'on a durci
    // (jeton court-vécu émis par `/appel`), et c'est une bonne nouvelle qu'il
    // faut alors venir constater ici.
    const { POST } = await import("../route");
    const res = await POST(makeRequest(VALID_PAYLOAD, { origin: "https://axion-ia.com" }));
    expect(res.status).toBe(200);
  });

  it("un nom de 300 caractères est ÉCARTÉ, la réservation est enregistrée", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        ...VALID_PAYLOAD,
        payload: { invitee: { name: "x".repeat(300), email: "john@example.com" } },
      }),
    );
    // Avant : la valeur partait telle quelle dans un `@db.VarChar(255)`,
    // Postgres levait `22001`, que le `catch` n'interceptait pas (seul `P2002`
    // l'était) — la route rendait 500.
    //
    // ⚠️ Et le remède ne doit pas coûter la réservation : un champ facultatif
    // hors bornes est ABANDONNÉ, jamais tronqué, et surtout jamais fatal. Une
    // première version rendait 400 ici — elle perdait le lead pour sauver un nom.
    expect(res.status).toBe(200);
    expect(calendlyCreate).toHaveBeenCalledOnce();
    const data = (calendlyCreate.mock.calls[0]?.[0] as { data: { inviteeName?: string } }).data;
    expect(data.inviteeName).toBeUndefined();
  });

  it("une adresse malformée est écartée sans faire tomber la réservation", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        ...VALID_PAYLOAD,
        payload: { invitee: { name: "John Doe", email: "pas-une-adresse" } },
      }),
    );
    expect(res.status).toBe(200);
    const data = (calendlyCreate.mock.calls[0]?.[0] as { data: { inviteeEmail?: string } }).data;
    expect(data.inviteeEmail).toBeUndefined();
    // Sans adresse exploitable, aucune fiche CRM ne doit être fabriquée : on
    // n'invente pas une personne à partir d'une chaîne invalide.
    expect(syncCalendlyMock).not.toHaveBeenCalled();
  });

  it("une chaîne VIDE ne fait pas perdre la réservation", async () => {
    // 🔴 LE TÉMOIN QUI MANQUAIT. Le formulaire Calendly produit `""` quand un
    // champ facultatif n'est pas rempli. La première version du correctif rendait
    // 400 dessus : elle perdait la ligne, la synchro CRM et l'alerte, sur la
    // seule route qui capte des prospects. Plus grave que le 500 qu'elle corrigeait.
    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({ ...VALID_PAYLOAD, payload: { invitee: { name: "", email: "" } } }),
    );
    expect(res.status).toBe(200);
    expect(calendlyCreate).toHaveBeenCalledOnce();
  });

  it("un corps trop gros est refusé — même SANS content-length", async () => {
    // 🔴 Le second cas est celui qui rougissait : le contrôle d'en-tête seul est
    // sauté quand `content-length` est absent, et `req.json()` lisait alors le
    // corps entier, qui finit dans la colonne `raw_payload` (non bornée).
    const { POST } = await import("../route");
    const enorme = {
      ...VALID_PAYLOAD,
      payload: { invitee: { name: "John" }, bourrage: "x".repeat(200_000) },
    };
    const res = await POST(makeRequest(enorme));
    expect(res.status).toBe(413);
    expect(calendlyCreate).not.toHaveBeenCalled();
  });

  it("la clé de déduplication de l'alerte est dérivée du FAIT, pas de la ligne créée", async () => {
    const { POST } = await import("../route");

    // Deux appels, deux lignes différentes en base, MÊME réservation.
    calendlyCreate.mockResolvedValueOnce({ id: "ligne-1" });
    await POST(makeRequest(VALID_PAYLOAD));
    calendlyCreate.mockResolvedValueOnce({ id: "ligne-2" });
    await POST(makeRequest(VALID_PAYLOAD));

    const cles = notifyMock.mock.calls.map((c) => (c[0] as { dedupKey?: string }).dedupKey);
    expect(cles).toHaveLength(2);
    // Avant : `dedupKey: event.id` → "ligne-1" puis "ligne-2", donc deux clés
    // distinctes, donc deux alertes. Le hub ne pouvait rien dédoublonner.
    expect(cles[0]).toBe(cles[1]);
    expect(cles[0]).not.toBe("ligne-1");
  });
});
