/**
 * Verrou — la réservation prise depuis /appel n'atteint le CRM qu'UNE fois, et
 * cette fois-là porte le téléphone et le format.
 *
 * ## Ce que ce témoin a servi à corriger
 *
 * L'envoi CRM se faisait AVANT l'enrichissement API, en s'appuyant sur une
 * phrase écrite dans le code : « le passage `discover` portera alors
 * l'événement ». Elle est fausse pour ce chemin-ci. `discover.ts` commence sa
 * boucle par `if (known) continue;` — une ligne déjà créée par cette route
 * n'est donc jamais reprise. L'événement émis ici était le SEUL, et il partait
 * sans le téléphone que l'enrichissement venait juste de récupérer, et sans le
 * format du rendez-vous.
 *
 * ## Pourquoi déplacer, et pas émettre deux fois
 *
 * `dispatch` (crm-sync) fabrique un `event_id` neuf à chaque appel : deux
 * envois feraient apparaître DEUX réservations au CRM pour un seul rendez-vous.
 * Le déplacement est la seule forme qui enrichisse sans dupliquer — d'où le
 * test « une seule fois » ci-dessous, qui est la contrepartie du déplacement.
 *
 * ## Ce qu'aucun test existant ne voyait
 *
 * `route.test.ts` mocke bien `syncCalendlyEventToCrm`, mais ne s'en sert que
 * pour deux assertions NÉGATIVES (`not.toHaveBeenCalled`). Le contenu de
 * l'événement n'était regardé nulle part : la route pouvait émettre n'importe
 * quoi et rester verte.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const checkRateLimitMock = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));
vi.mock("@/lib/security/ip-hash", () => ({
  hashIp: (ip: string | null) => (ip ? `h-${ip}` : null),
}));

const syncCalendlyMock = vi.fn();
vi.mock("@/server/crm-sync", () => ({
  syncCalendlyEventToCrm: (...args: unknown[]) => syncCalendlyMock(...args),
}));

const notifyMock = vi.fn();
vi.mock("@/server/notifications", () => ({ notify: (...args: unknown[]) => notifyMock(...args) }));

// L'enrichissement est le pivot de ce test : c'est lui qui apporte le téléphone
// et le lieu. On le déclare réussi, et on fait répondre la relecture.
const enrichMock = vi.fn();
vi.mock("@/server/calendly/enrich", () => ({
  enrichCalendlyEvent: (...args: unknown[]) => enrichMock(...args),
}));
vi.mock("@/server/calendly/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isCalendlyApiConfigured: () => true,
}));

// La coloration Google est hors sujet ici, et ne doit surtout pas partir.
const colorerMock = vi.fn();
vi.mock("@/server/google-calendar/events", () => ({
  colorerReservationCalendly: (...args: unknown[]) => colorerMock(...args),
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

function requete(body: unknown): NextRequest {
  return new NextRequest("https://test.local/api/calendly/client-event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "test.local",
      "x-forwarded-proto": "https",
      origin: "https://test.local",
    },
    body: JSON.stringify(body),
  });
}

const RESERVATION = {
  eventName: "calendly.event_scheduled" as const,
  payload: { invitee: { name: "Camille Prospect", email: "camille@exemple.test" } },
  eventTypeSlug: "appel-decouverte",
  pageUrl: "https://axion-ia.com/fr/appel",
};

/** La ligne telle que l'enrichissement vient de la remplir. */
const APRES_ENRICHISSEMENT = {
  inviteeName: "Camille Prospect",
  inviteeEmail: "camille@exemple.test",
  inviteePhone: "+33 6 12 34 56 78",
  startTime: new Date("2026-09-25T09:30:00.000Z"),
  location: "+33 6 12 34 56 78",
  rawPayload: { event: { location: { type: "outbound_call" } } },
};

/** L'événement CRM effectivement émis. */
function evenementCrm(): Record<string, unknown> {
  return syncCalendlyMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({
    allowed: true,
    count: 1,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  });
  calendlyFindFirst.mockResolvedValue(null);
  calendlyCreate.mockResolvedValue({ id: "evt_abc" });
  notifyMock.mockResolvedValue({ ok: true, channels: {} });
  enrichMock.mockResolvedValue({ ok: true });
  calendlyFindUnique.mockResolvedValue(APRES_ENRICHISSEMENT);
  colorerMock.mockResolvedValue(false);
});

describe("l'événement CRM d'une réservation prise sur /appel", () => {
  it("🔴 n'est émis qu'UNE seule fois", async () => {
    // Contrepartie du déplacement : si quelqu'un remettait un envoi avant
    // l'enrichissement sans retirer celui d'après, le CRM verrait deux
    // réservations pour un seul rendez-vous — et `dispatch` leur donnerait deux
    // `event_id` différents, donc rien ne les dédoublonnerait.
    const { POST } = await import("../route");
    const res = await POST(requete(RESERVATION));
    expect(res.status).toBe(200);
    expect(syncCalendlyMock).toHaveBeenCalledOnce();
  });

  it("🔴 porte le téléphone récupéré par l'enrichissement", async () => {
    const { POST } = await import("../route");
    await POST(requete(RESERVATION));
    const personne = evenementCrm()["person"] as Record<string, unknown>;
    expect(
      personne["phone"],
      "l'envoi part avant l'enrichissement : le CRM ne recevra jamais le numéro",
    ).toBe("+33 6 12 34 56 78");
  });

  it("🔴 porte le format, et DANS `payload`", async () => {
    const { POST } = await import("../route");
    await POST(requete(RESERVATION));
    const evenement = evenementCrm();
    const charge = evenement["payload"] as Record<string, unknown>;
    expect(charge["format"]).toBe("telephone");
    // 🔑 Le validateur du CRM ne filtre que la RACINE : une clé inconnue posée
    // là vaut 422 définitif, c'est-à-dire un lead perdu sans rattrapage.
    expect(
      Object.keys(evenement),
      "le format ne doit JAMAIS remonter à la racine de l'événement",
    ).not.toContain("format");
  });

  it("une visio est transmise comme telle", async () => {
    calendlyFindUnique.mockResolvedValue({
      ...APRES_ENRICHISSEMENT,
      location: "https://meet.google.com/abc-defg-hij",
      rawPayload: { event: { location: { type: "google_conference" } } },
    });
    const { POST } = await import("../route");
    await POST(requete(RESERVATION));
    expect((evenementCrm()["payload"] as Record<string, unknown>)["format"]).toBe("visio");
  });

  it("🔑 CONTRE-TÉMOIN : un format indéterminé n'est pas transmis du tout", async () => {
    // Plutôt qu'un « inconnu » que le CRM devrait interpréter. Une clé absente
    // se lit sans ambiguïté ; une valeur fourre-tout finit par être traitée
    // comme une vraie modalité.
    calendlyFindUnique.mockResolvedValue({
      ...APRES_ENRICHISSEMENT,
      location: "chez le client",
      rawPayload: { event: {} },
    });
    const { POST } = await import("../route");
    await POST(requete(RESERVATION));
    const charge = evenementCrm()["payload"] as Record<string, unknown>;
    expect(Object.keys(charge)).not.toContain("format");
  });

  it("🔑 CONTRE-TÉMOIN : sans enrichissement, l'envoi part quand même", async () => {
    // Le déplacement ne doit pas transformer un enrichissement raté en lead
    // perdu : l'adresse vient déjà du postMessage, elle suffit à émettre.
    enrichMock.mockResolvedValue({ ok: false, reason: "api_error" });
    calendlyFindUnique.mockResolvedValue(null);
    const { POST } = await import("../route");
    const res = await POST(requete(RESERVATION));
    expect(res.status).toBe(200);
    expect(syncCalendlyMock).toHaveBeenCalledOnce();
    const personne = evenementCrm()["person"] as Record<string, unknown>;
    expect(personne["email"]).toBe("camille@exemple.test");
    expect(personne["phone"], "aucun numéro connu : la clé doit être absente").toBeUndefined();
  });
});
