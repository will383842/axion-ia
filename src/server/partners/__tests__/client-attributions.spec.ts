// @req REQ-INT-014
// @req REQ-INT-015
/**
 * Chantier Axion Partners — INT-T07-A : le client de l'API 1 de Partners, côté axion-ia.
 *
 * `GET <origine de Partners>/api/integrations/axionia/attributions?siren=`, porteur du jeton dédié
 * (`AXIONIA_API_TOKEN`) et de son kid (`kidDe`, REQ-QA-030 ; avenant A01 du 2026-09-30). Ce fichier
 * garde : l'appel exact ; le délai de 2 s ; le cache de 5 minutes, des seules réponses conformes ;
 * la réponse FERMÉE du contrat (INT-T07-P) ; l'ÉCHEC OUVERT : une panne ne lève jamais, elle rend un
 * motif et elle est signalée, sans SIREN ni nom ; l'inertie quand le canal est fermé ; et le kid qui
 * change quand le jeton tourne.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { kidDe } from "@/server/partners/enveloppe";

import {
  CACHE_ATTRIBUTIONS_MS,
  CHEMIN_API_ATTRIBUTIONS,
  DELAI_API_ATTRIBUTIONS_MS,
  TEXTES_DU_BANDEAU,
  bandeauPourLeRole,
  creerCacheAttributions,
  lireAttributionPartners,
  moisEnLettres,
  texteDuBandeau,
  type AttributionPartners,
} from "../client-attributions";

const JETON_A = "a".repeat(48);
const JETON_B = "b".repeat(48);
const SIREN = "552100554";
const REF = "0190f0f0-0000-7000-8000-0000000000a1";
const T0 = Date.UTC(2026, 9, 5, 12, 0, 0);

const ENV = { ...process.env };
beforeEach(() => {
  process.env.PARTNERS_SYNC_ENABLED = "true";
  process.env.PARTNERS_SYNC_URL = "https://partners.example.test/api/webhooks/axionia";
  process.env.AXIONIA_API_TOKEN = JETON_A;
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
});
afterEach(() => {
  process.env = { ...ENV };
  vi.useRealTimers();
});

type Appel = { url: string; init: RequestInit };

/** Un faux réseau : rend `reponse` et note chaque appel. */
function reseau(reponse: () => Response | Promise<Response>) {
  const appels: Appel[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), init: init ?? {} });
    return reponse();
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, appels };
}

const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "content-type": "application/json" },
  });

const ATTRIBUEE: AttributionPartners = {
  statut: "attribuee",
  until: "2027-04",
  apporteurRef: REF,
  nomAffichable: "Paul D.",
};

function lire(siren: string, r: ReturnType<typeof reseau>, o: { maintenant?: () => number } = {}) {
  const signales: string[] = [];
  const cache = creerCacheAttributions();
  const appeler = (s = siren) =>
    lireAttributionPartners(s, {
      fetch: r.fetch,
      maintenantMs: o.maintenant ?? (() => T0),
      signaler: (m) => void signales.push(m),
      cache,
    });
  return { appeler, signales };
}

describe("REQ-INT-014 — l'appel de l'API 1 : la cible, le jeton et son kid", () => {
  it("REQ-INT-014 : TÉMOIN — GET à l'origine de Partners, chemin du contrat, porteur du jeton et de son kid", async () => {
    const r = reseau(() => json(ATTRIBUEE));
    const { appeler } = lire(SIREN, r);
    expect(await appeler()).toEqual({ ok: true, attribution: ATTRIBUEE });
    expect(r.appels).toHaveLength(1);
    expect(r.appels[0]!.url).toBe(
      `https://partners.example.test${CHEMIN_API_ATTRIBUTIONS}?siren=${SIREN}`,
    );
    const entetes = new Headers(r.appels[0]!.init.headers);
    expect(r.appels[0]!.init.method).toBe("GET");
    expect(entetes.get("authorization")).toBe(`Bearer ${JETON_A}`);
    expect(entetes.get("x-axionia-kid")).toBe(kidDe(JETON_A));
  });

  it("REQ-INT-014 — TÉMOIN : le kid émis change quand le jeton tourne", async () => {
    const r = reseau(() => json(ATTRIBUEE));
    await lire(SIREN, r).appeler();
    process.env.AXIONIA_API_TOKEN = JETON_B;
    await lire(SIREN, r).appeler();
    const kids = r.appels.map((a) => new Headers(a.init.headers).get("x-axionia-kid"));
    expect(kids).toEqual([kidDe(JETON_A), kidDe(JETON_B)]);
    expect(kids[1]).not.toBe(kids[0]);
  });

  it("REQ-INT-014 : un SIREN mal formé n'appelle pas le réseau", async () => {
    const r = reseau(() => json(ATTRIBUEE));
    const { appeler, signales } = lire("12345", r);
    expect(await appeler()).toEqual({ ok: false, motif: "siren_invalide" });
    expect(r.appels).toEqual([]);
    expect(signales).toEqual([]);
  });

  it("REQ-INT-014 — TÉMOIN : canal fermé, jeton absent ou trop court : aucun appel, aucune alerte (inertie)", async () => {
    for (const [nom, poser] of [
      ["canal fermé", () => (process.env.PARTNERS_SYNC_ENABLED = "false")],
      ["jeton absent", () => delete process.env.AXIONIA_API_TOKEN],
      ["jeton trop court", () => (process.env.AXIONIA_API_TOKEN = "court")],
      ["url absente", () => delete process.env.PARTNERS_SYNC_URL],
    ] as const) {
      process.env.PARTNERS_SYNC_ENABLED = "true";
      process.env.PARTNERS_SYNC_URL = "https://partners.example.test/api/webhooks/axionia";
      process.env.AXIONIA_API_TOKEN = JETON_A;
      poser();
      const r = reseau(() => json(ATTRIBUEE));
      const { appeler, signales } = lire(SIREN, r);
      const lu = await appeler();
      expect(lu.ok, nom).toBe(false);
      expect(r.appels, nom).toEqual([]);
      expect(signales, nom).toEqual([]);
    }
  });
});

describe("REQ-INT-015 — l'échec ouvert : une panne ne bloque jamais le devis, et elle est signalée", () => {
  it("REQ-INT-015 — TÉMOIN : un refus (404), une panne (503), un réseau coupé : jamais une exception, un motif et un signal", async () => {
    for (const [reponse, motif] of [
      [() => new Response(null, { status: 404 }), "http_404"],
      [() => new Response(null, { status: 503 }), "http_503"],
      [
        () => {
          throw new TypeError("fetch failed");
        },
        "reseau",
      ],
    ] as const) {
      const r = reseau(reponse);
      const { appeler, signales } = lire(SIREN, r);
      await expect(appeler()).resolves.toEqual({ ok: false, motif });
      expect(signales).toEqual([motif]);
    }
  });

  it("REQ-INT-015 — TÉMOIN : une redirection (302, 301, 307, 308 ou opaque) n'est jamais suivie : le jeton ne part pas ailleurs, c'est une panne, jamais mise en cache", async () => {
    const vers = { location: "https://ailleurs.example.test/collecte" };
    for (const [nom, reponse] of [
      ["302", () => new Response(null, { status: 302, headers: vers })],
      ["301", () => new Response(null, { status: 301, headers: vers })],
      ["307", () => new Response(null, { status: 307, headers: vers })],
      ["308", () => new Response(null, { status: 308, headers: vers })],
      ["opaque", () => ({ type: "opaqueredirect", status: 0, ok: false }) as unknown as Response],
    ] as const) {
      const r = reseau(reponse);
      const { appeler, signales } = lire(SIREN, r);
      await expect(appeler(), nom).resolves.toEqual({ ok: false, motif: "redirection" });
      expect(r.appels[0]!.init.redirect, nom).toBe("manual");
      expect(signales, nom).toEqual(["redirection"]);
      await appeler();
      expect(r.appels, nom).toHaveLength(2);
      expect(
        r.appels.every((a) => a.url.startsWith("https://partners.example.test/")),
        nom,
      ).toBe(true);
    }
  });

  it("REQ-INT-015 — TÉMOIN À DEUX FACES : le délai de 2 s ; à 1 999 ms la réponse passe, à 2 000 ms l'appel est abandonné", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // Un réseau qui ne répond qu'au bout de `ms`, et que l'abandon interrompt.
    const lent = (ms: number) =>
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((resoudre, rejeter) => {
            const t = setTimeout(() => resoudre(json(ATTRIBUEE)), ms);
            init?.signal?.addEventListener("abort", () => {
              clearTimeout(t);
              rejeter(Object.assign(new Error("aborted"), { name: "AbortError" }));
            });
          }),
      ) as unknown as typeof globalThis.fetch;
    expect(DELAI_API_ATTRIBUTIONS_MS).toBe(2_000);

    const avant = lireAttributionPartners(SIREN, {
      fetch: lent(1_999),
      maintenantMs: () => T0,
      signaler: () => undefined,
      cache: creerCacheAttributions(),
    });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(await avant).toEqual({ ok: true, attribution: ATTRIBUEE });

    const signales: string[] = [];
    const apres = lireAttributionPartners(SIREN, {
      fetch: lent(2_000),
      maintenantMs: () => T0,
      signaler: (m) => void signales.push(m),
      cache: creerCacheAttributions(),
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await apres).toEqual({ ok: false, motif: "timeout" });
    expect(signales).toEqual(["timeout"]);
  });

  it("REQ-INT-015 — TÉMOIN : une réponse hors contrat est refusée, comme une panne, et le nom n'en sort pas", async () => {
    for (const corps of [
      { ...ATTRIBUEE, courriel: "paul@exemple.test" },
      { ...ATTRIBUEE, nomAffichable: "paul@exemple.test" },
      { ...ATTRIBUEE, nomAffichable: "Paul Dupont" },
      { ...ATTRIBUEE, apporteurRef: null },
      { statut: "libre", until: "2027-04", apporteurRef: null, nomAffichable: null },
      { statut: "cliente", until: "2027-04", apporteurRef: REF, nomAffichable: "Paul D." },
      { ...ATTRIBUEE, until: "2027-13" },
      { ...ATTRIBUEE, statut: "reservee" },
      "pas un objet",
    ]) {
      const r = reseau(() => json(corps));
      const { appeler, signales } = lire(SIREN, r);
      const lu = await appeler();
      expect(lu, JSON.stringify(corps)).toEqual({ ok: false, motif: "illisible" });
      expect(signales).toEqual(["illisible"]);
    }
  });

  it("REQ-INT-015 : les trois statuts conformes passent, nom nul compris", async () => {
    for (const a of [
      { statut: "libre", until: null, apporteurRef: null, nomAffichable: null },
      ATTRIBUEE,
      { ...ATTRIBUEE, until: null },
      { statut: "cliente", until: null, apporteurRef: REF, nomAffichable: "Élise M." },
      { statut: "cliente", until: null, apporteurRef: REF, nomAffichable: null },
    ] as const) {
      const r = reseau(() => json(a));
      expect(await lire(SIREN, r).appeler(), a.statut).toEqual({ ok: true, attribution: a });
    }
  });
});

describe("REQ-INT-015 — le cache de 5 minutes, et le nom qui ne vit que le temps du cache", () => {
  it("REQ-INT-015 — TÉMOIN À DEUX FACES : le même SIREN n'est relu qu'au bout de 5 minutes", async () => {
    expect(CACHE_ATTRIBUTIONS_MS).toBe(300_000);
    let maintenant = T0;
    const r = reseau(() => json(ATTRIBUEE));
    const { appeler } = lire(SIREN, r, { maintenant: () => maintenant });
    await appeler();
    maintenant = T0 + CACHE_ATTRIBUTIONS_MS - 1;
    await appeler();
    expect(r.appels).toHaveLength(1);
    maintenant = T0 + CACHE_ATTRIBUTIONS_MS;
    await appeler();
    expect(r.appels).toHaveLength(2);
  });

  it("REQ-INT-015 : un SIREN différent est appelé, et une panne n'est jamais gardée en cache", async () => {
    let premiere = true;
    const r = reseau(() => {
      if (premiere) {
        premiere = false;
        return new Response(null, { status: 503 });
      }
      return json(ATTRIBUEE);
    });
    const { appeler } = lire(SIREN, r);
    expect((await appeler()).ok).toBe(false);
    expect((await appeler()).ok).toBe(true);
    await appeler("732829320");
    expect(r.appels.map((a) => new URL(a.url).searchParams.get("siren"))).toEqual([
      SIREN,
      SIREN,
      "732829320",
    ]);
  });
});

describe("REQ-INT-015 — le nom n'entre dans aucun journal", () => {
  it("REQ-INT-015 — TÉMOIN : en panne comme en succès, rien n'est écrit sur la console qui porte le SIREN ou le nom", async () => {
    const ecrits: string[] = [];
    const espions = (["log", "info", "warn", "error", "debug"] as const).map((n) =>
      vi
        .spyOn(console, n)
        .mockImplementation((...a: unknown[]) => void ecrits.push(a.map(String).join(" "))),
    );
    try {
      for (const reponse of [() => json(ATTRIBUEE), () => new Response(null, { status: 503 })]) {
        // Sans `signaler` injecté : le signal par défaut est celui de la production.
        await lireAttributionPartners(SIREN, {
          fetch: reseau(reponse).fetch,
          maintenantMs: () => T0,
          cache: creerCacheAttributions(),
        });
      }
    } finally {
      for (const e of espions) e.mockRestore();
    }
    expect(ecrits.join("\n")).not.toContain(SIREN);
    expect(ecrits.join("\n")).not.toContain("Paul");
    expect(ecrits.some((l) => l.includes("http_503"))).toBe(true);
  });
});

describe("REQ-INT-014 — le bandeau : les textes de la juriste, mot pour mot", () => {
  const lu = (a: AttributionPartners) => ({ ok: true as const, attribution: a });

  it("REQ-INT-014 — TÉMOIN : réservée, déposée, cliente, avec le nom ; le mois en toutes lettres", () => {
    expect(texteDuBandeau(lu({ ...ATTRIBUEE, until: "2026-12" }))).toBe(
      TEXTES_DU_BANDEAU.reservee.replace("{nom}", "Paul D.").replace("{mois}", "décembre 2026"),
    );
    expect(texteDuBandeau(lu({ ...ATTRIBUEE, until: null }))).toBe(
      TEXTES_DU_BANDEAU.deposee.replace("{nom}", "Paul D."),
    );
    expect(
      texteDuBandeau(
        lu({ statut: "cliente", until: null, apporteurRef: REF, nomAffichable: "Paul D." }),
      ),
    ).toBe(TEXTES_DU_BANDEAU.cliente.replace("{nom}", "Paul D."));
    expect(moisEnLettres("2027-01")).toBe("janvier 2027");
  });

  it("REQ-INT-014 — TÉMOIN : le nom indisponible devient « un apporteur », et rien d'autre ne change", () => {
    const sans = texteDuBandeau(lu({ ...ATTRIBUEE, nomAffichable: null, until: null }));
    expect(sans).toBe(TEXTES_DU_BANDEAU.deposee.replace("{nom}", "un apporteur"));
    expect(sans).not.toMatch(/[0-9a-f]{8}-/);
  });

  it("REQ-INT-015 — TÉMOIN À DEUX FACES : libre, canal inerte ou client sans SIREN : aucun bandeau ; toute panne : le texte de la panne, jamais un bandeau vide", () => {
    expect(
      texteDuBandeau(lu({ statut: "libre", until: null, apporteurRef: null, nomAffichable: null })),
    ).toBeNull();
    expect(texteDuBandeau({ ok: false, motif: "inactif" })).toBeNull();
    expect(texteDuBandeau({ ok: false, motif: "siren_invalide" })).toBeNull();
    for (const motif of [
      "timeout",
      "http_503",
      "http_404",
      "illisible",
      "reseau",
      "redirection",
    ] as const)
      expect(texteDuBandeau({ ok: false, motif }), motif).toBe(TEXTES_DU_BANDEAU.panne);
  });
});

describe("REQ-INT-014 — le bandeau n'existe que pour un rôle qui crée un devis, jugé au serveur avant l'appel", () => {
  it("REQ-INT-014 — TÉMOIN À DEUX FACES : super_admin, admin, responsable_qualite, secretaire et editor voient le bandeau ; reader, une session sans rôle ou un rôle inconnu : ni bandeau, ni appel", async () => {
    for (const role of ["super_admin", "admin", "responsable_qualite", "secretaire", "editor"]) {
      const r = reseau(() => json(ATTRIBUEE));
      const texte = await bandeauPourLeRole(role, SIREN, {
        fetch: r.fetch,
        maintenantMs: () => T0,
        cache: creerCacheAttributions(),
      });
      expect(texte, role).toContain("Paul D.");
      expect(r.appels, role).toHaveLength(1);
    }
    for (const role of ["reader", null, undefined, "", "role_futur"]) {
      const r = reseau(() => json(ATTRIBUEE));
      const texte = await bandeauPourLeRole(role, SIREN, {
        fetch: r.fetch,
        maintenantMs: () => T0,
        cache: creerCacheAttributions(),
      });
      expect(texte, String(role)).toBeNull();
      expect(r.appels, String(role)).toEqual([]);
    }
  });

  it("REQ-INT-014 : un client sans SIREN n'appelle pas Partners", async () => {
    const r = reseau(() => json(ATTRIBUEE));
    expect(
      await bandeauPourLeRole("admin", null, { fetch: r.fetch, cache: creerCacheAttributions() }),
    ).toBeNull();
    expect(r.appels).toEqual([]);
  });
});
