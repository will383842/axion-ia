// Le sondage ne perd plus de réservations — deux trous mesurés le 2026-08-28.
//
// ## Pourquoi ces tests existent
//
// `discover` est le SEUL filet depuis ADR 0038 : cliquer un créneau ouvre
// calendly.com, plus aucun `postMessage` n'annonce la réservation. Ce que ce
// module ne voit pas n'existe pour personne — ni ligne en console, ni alerte,
// ni fiche CRM. La personne se présente à un appel dont Will ignore tout.
//
// Deux défauts le rendaient aveugle, et AUCUN des deux ne se voyait : la passe
// rendait `ok: true` dans les deux cas.
//
//   1. **La fenêtre arrière était un plafond de 2 h.** Elle porte sur
//      `start_time`, pas sur l'instant de réservation. Une réservation prise à
//      9 h pour 10 h sort donc du champ dès 12 h. Si le worker s'arrête de 9 h
//      à 13 h, ce rendez-vous n'est JAMAIS découvert — définitivement.
//
//   2. **Il n'y avait aucune pagination.** `count=50` + `sort=start_time:asc`,
//      et `pagination.next_page` n'était lu nulle part. Au-delà de 50
//      rendez-vous actifs, les plus LOINTAINS disparaissaient en silence.
//
// ## Ce que ces tests refusent, précisément
//
// Ils ne vérifient pas « la constante vaut 2 h » — un chiffre se change, et le
// test suivrait. Ils vérifient le COMPORTEMENT observable : l'URL réellement
// demandée à Calendly, et ce que la passe RAPPORTE d'elle-même.
//
// ⚠️ Piège de montage : `prisma.calendlyEvent.findFirst` sert DEUX usages
// distincts ici — la dérivation de profondeur (`select: { capturedAt }`) et le
// contrôle anti-doublon. Un mock unique les confondrait et rendrait le test
// vert pour la mauvaise raison. On route donc sur la forme de l'appel.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../enrich", () => ({ enrichCalendlyEvent: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/crm-sync", () => ({ syncCalendlyEventToCrm: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

/** Ce que rend la dérivation de profondeur : la dernière capture, ou rien. */
let derniereCapture: Date | null = null;
/** Ce que rend le contrôle anti-doublon : une ligne existante, ou rien. */
let dejaConnu: unknown = { id: "deja_la" };

const findFirstMock = vi.fn((args: { select?: Record<string, unknown> }) => {
  // La dérivation est le SEUL appel qui ne demande QUE `capturedAt`.
  if (args?.select && "capturedAt" in args.select) {
    return Promise.resolve(derniereCapture ? { capturedAt: derniereCapture } : null);
  }
  return Promise.resolve(dejaConnu);
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findFirst: (...a: unknown[]) => findFirstMock(...(a as [never])),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "row" }),
    },
  },
}));

import { discoverNewCalendlyEvents } from "../discover";

const USER_URI = "https://api.calendly.com/users/USER";
const fetchMock = vi.fn();

/** Les URL de liste réellement demandées, dans l'ordre. */
function urlsDeListe(): string[] {
  return fetchMock.mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes("/scheduled_events"));
}

/** Profondeur arrière demandée à Calendly, en minutes, lue dans l'URL. */
function profondeurDemandeeMinutes(nowMs: number): number {
  const url = urlsDeListe()[0];
  if (!url) throw new Error("aucune requête de liste — le test ne mesure rien");
  const min = new URL(url).searchParams.get("min_start_time");
  if (!min) throw new Error("min_start_time absent de l'URL");
  return Math.round((nowMs - new Date(min).getTime()) / 60_000);
}

function evenement(n: number) {
  return {
    uri: `https://api.calendly.com/scheduled_events/E${n}`,
    name: "Premier contact",
    start_time: "2026-08-28T07:00:00Z",
    end_time: "2026-08-28T07:45:00Z",
  };
}

function reponse(corps: unknown, statut = 200): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(corps), { status: statut }));
}

/** Répond comme Calendly, sur `pages` pages, en chaînant `next_page`. */
function servirPages(pages: number) {
  let servies = 0;
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/users/me")) return reponse({ resource: { uri: USER_URI } });
    if (url.includes("/scheduled_events")) {
      servies += 1;
      const encore = servies < pages;
      return reponse({
        collection: [evenement(servies)],
        pagination: encore
          ? { next_page: `https://api.calendly.com/scheduled_events?page_token=P${servies}` }
          : { next_page: null },
      });
    }
    return reponse({ collection: [] });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.CALENDLY_API_TOKEN = "pat_test";
  derniereCapture = null;
  dejaConnu = { id: "deja_la" };
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CALENDLY_API_TOKEN;
});

describe("la fenêtre arrière s'élargit autant que le silence a duré", () => {
  it("en régime normal (capture récente) elle reste au minimum de 2 h", async () => {
    const now = Date.now();
    derniereCapture = new Date(now - 10 * 60_000);
    servirPages(1);

    const res = await discoverNewCalendlyEvents();

    // 10 min de silence + 1 h de marge = 70 min, sous le plancher → plancher.
    expect(profondeurDemandeeMinutes(now)).toBeGreaterThanOrEqual(115);
    expect(profondeurDemandeeMinutes(now)).toBeLessThanOrEqual(125);
    expect(res.rattrapageMinutes).toBe(120);
  });

  it("🔴 LE DÉFAUT : après un arrêt de 6 h, elle couvre les 6 h — pas 2", async () => {
    const now = Date.now();
    derniereCapture = new Date(now - 6 * 3_600_000);
    servirPages(1);

    const res = await discoverNewCalendlyEvents();

    // Avant le correctif, cette valeur était CLOUÉE à 120 : le rendez-vous
    // réservé à 9 h pour 10 h pendant la panne n'était jamais découvert.
    expect(profondeurDemandeeMinutes(now)).toBeGreaterThan(240);
    expect(res.rattrapageMinutes).toBeGreaterThan(240);
    // 6 h de silence + 1 h de marge.
    expect(res.rattrapageMinutes).toBeLessThanOrEqual(7 * 60 + 5);
  });

  it("un silence de trois semaines est BORNÉ à sept jours", async () => {
    derniereCapture = new Date(Date.now() - 21 * 86_400_000);
    servirPages(1);

    const res = await discoverNewCalendlyEvents();

    // Sans plafond, la fenêtre demandée ferait exploser la pagination.
    expect(res.rattrapageMinutes).toBe(7 * 24 * 60);
  });

  it("base illisible : on retombe sur le minimum, la passe a quand même lieu", async () => {
    findFirstMock.mockImplementationOnce(() => Promise.reject(new Error("db down")));
    servirPages(1);

    const res = await discoverNewCalendlyEvents();

    // 🔑 Une passe étroite vaut infiniment mieux qu'une passe qui n'a pas lieu.
    expect(res.ok).toBe(true);
    expect(res.rattrapageMinutes).toBe(120);
  });

  it("aucune ligne en base (premier démarrage) : minimum, sans lever", async () => {
    derniereCapture = null;
    servirPages(1);

    const res = await discoverNewCalendlyEvents();

    expect(res.rattrapageMinutes).toBe(120);
  });
});

describe("la liste est paginée, et une troncature se DIT", () => {
  it("suit next_page jusqu'au bout et voit les rendez-vous des pages suivantes", async () => {
    servirPages(3);

    const res = await discoverNewCalendlyEvents();

    // 🔴 Avant : une seule requête, donc un seul événement vu sur trois pages.
    expect(urlsDeListe()).toHaveLength(3);
    expect(res.scanned).toBe(3);
    expect(res.pagesTronquees).toBeUndefined();
  });

  it("s'arrête à cinq pages ET LE DIT — jamais de troncature muette", async () => {
    servirPages(50);

    const res = await discoverNewCalendlyEvents();

    expect(urlsDeListe()).toHaveLength(5);
    expect(res.pagesTronquees).toBe(true);
    // La passe reste un succès : ce qu'elle a vu est bon, elle en manque juste.
    expect(res.ok).toBe(true);
  });

  it("une page suivante illisible garde ce qui a été collecté avant elle", async () => {
    let servies = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/users/me")) return reponse({ resource: { uri: USER_URI } });
      if (url.includes("/scheduled_events")) {
        servies += 1;
        if (servies === 2) return reponse({}, 500);
        return reponse({
          collection: [evenement(servies)],
          pagination: { next_page: "https://api.calendly.com/scheduled_events?page_token=P" },
        });
      }
      return reponse({ collection: [] });
    });

    const res = await discoverNewCalendlyEvents();

    // 🔑 Perdre la page 2 ne doit pas faire perdre la page 1 : la réservation
    // déjà vue vaut mieux que rien, et le passage suivant reverra le reste.
    expect(res.ok).toBe(true);
    expect(res.scanned).toBe(1);
  });

  it("🔴 TÉMOIN : un échec sur la PREMIÈRE page reste un échec déclaré", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/users/me")) return reponse({ resource: { uri: USER_URI } });
      return reponse({}, 500);
    });

    const res = await discoverNewCalendlyEvents();

    // Sans ce témoin, le test précédent passerait aussi si la fonction avalait
    // TOUTE erreur de liste en rendant un succès vide — le pire des deux mondes.
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("list_failed");
  });

  it("ne suit PAS une next_page qui pointe ailleurs que chez Calendly", async () => {
    let servies = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/users/me")) return reponse({ resource: { uri: USER_URI } });
      if (url.includes("/scheduled_events")) {
        servies += 1;
        return reponse({
          collection: [evenement(servies)],
          // 🔑 Le jeton part en en-tête `Authorization`. Suivre une URL fournie
          // par la réponse sans la vérifier l'enverrait à l'hôte de son choix.
          pagination: { next_page: "https://attaquant.example/scheduled_events?x=1" },
        });
      }
      return reponse({ collection: [] });
    });

    await discoverNewCalendlyEvents();

    expect(fetchMock.mock.calls.map((c) => String(c[0]))).not.toContain(
      "https://attaquant.example/scheduled_events?x=1",
    );
    expect(urlsDeListe()).toHaveLength(1);
  });
});
