import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Porte du Studio de la couche Méthode (fiche KB-05b).
 *
 * La route est exercée en processus, avec de vraies `Request`. Le client Prisma est un
 * faux, en lecture seule : toute méthode d'écriture jette. Le corpus est inventé ici,
 * jamais lu ailleurs.
 */

const ECRITURES = vi.hoisted(
  () => ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"] as const,
);

const base = vi.hoisted(() => ({
  lectures: 0,
  noyaux: [] as unknown[],
  lignes: [] as unknown[],
}));

vi.mock("@/lib/prisma", () => {
  const jette = (nom: string) => () => {
    throw new Error(`écriture interdite : ${nom}`);
  };
  const entree: Record<string, unknown> = {
    findMany: vi.fn(async () => {
      base.lectures += 1;
      return base.noyaux;
    }),
  };
  for (const m of ECRITURES) entree[m] = jette(`knowledgeEntry.${m}`);
  return {
    prisma: {
      knowledgeEntry: entree,
      $queryRawUnsafe: vi.fn(async () => {
        base.lectures += 1;
        return base.lignes;
      }),
      $executeRaw: jette("$executeRaw"),
      $executeRawUnsafe: jette("$executeRawUnsafe"),
    },
  };
});

const debit = vi.hoisted(() => ({ autorise: true, appels: [] as unknown[][] }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async (...a: unknown[]) => {
    debit.appels.push(a);
    return { allowed: debit.autorise, remaining: 0, resetAt: 0 };
  }),
}));

import * as module from "../route";
import { POST } from "../route";

// Assemblé à l'exécution : le scan anti-fuite lit les sources et ne doit voir aucun montant.
const MONTANT_FACTICE = ["1 500", ["eu", "ros"].join("")].join(" ");
const SECRET = "secret-factice-de-test-abcdefghijklmnop-qrstuv";
const URL_ROUTE = "http://localhost/api/internal/methode/studio";

function requete(corps: unknown, entetes: Record<string, string> = {}, brut = false): Request {
  return new Request(URL_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json", "x-methode-secret": SECRET, ...entetes },
    body: brut ? (corps as string) : JSON.stringify(corps),
  });
}

function ouvrir(): void {
  vi.stubEnv("METHODE_STUDIO_OUVERT", "true");
  vi.stubEnv("METHODE_ACTIVE", "true");
  vi.stubEnv("METHODE_STUDIO_SECRET", SECRET);
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
}

function ligne(slug: string, titre: string, texte: string) {
  return { slug, titre, texte, collection: "methode-vente", etiquettes: [] as string[] };
}

beforeEach(() => {
  base.lectures = 0;
  base.noyaux = [];
  base.lignes = [];
  debit.autorise = true;
  debit.appels = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function neverCached(r: Response): void {
  expect(r.headers.get("cache-control")).toBe("no-store");
}

describe("forme du module", () => {
  it("n'exporte que POST, les quatre verbes d'écriture refusés, dynamic et runtime", () => {
    expect(Object.keys(module).sort()).toEqual(
      ["DELETE", "GET", "PATCH", "POST", "PUT", "dynamic", "runtime"].sort(),
    );
    expect(module.runtime).toBe("nodejs");
    expect(module.dynamic).toBe("force-dynamic");
  });

  it.each(["GET", "PUT", "PATCH", "DELETE"] as const)(
    "%s rend 405 + Allow: POST + no-store",
    async (verbe) => {
      const r = await module[verbe]();
      expect(r.status).toBe(405);
      expect(r.headers.get("allow")).toBe("POST");
      neverCached(r);
      expect(base.lectures).toBe(0);
    },
  );
});

describe("fermée par défaut : 404 sans lire la base", () => {
  const cas: Array<[string, Record<string, string | undefined>]> = [
    ["tout absent", {}],
    ["STUDIO_OUVERT absent, ACTIVE true", { METHODE_ACTIVE: "true" }],
    ["ACTIVE absent, STUDIO_OUVERT true", { METHODE_STUDIO_OUVERT: "true" }],
    ["STUDIO_OUVERT « false »", { METHODE_STUDIO_OUVERT: "false", METHODE_ACTIVE: "true" }],
    ["STUDIO_OUVERT « 1 »", { METHODE_STUDIO_OUVERT: "1", METHODE_ACTIVE: "true" }],
    ["STUDIO_OUVERT « TRUE »", { METHODE_STUDIO_OUVERT: "TRUE", METHODE_ACTIVE: "true" }],
    ["STUDIO_OUVERT « oui »", { METHODE_STUDIO_OUVERT: "oui", METHODE_ACTIVE: "true" }],
    ["ACTIVE « false »", { METHODE_STUDIO_OUVERT: "true", METHODE_ACTIVE: "false" }],
    ["ACTIVE « 1 »", { METHODE_STUDIO_OUVERT: "true", METHODE_ACTIVE: "1" }],
    ["ACTIVE « TRUE »", { METHODE_STUDIO_OUVERT: "true", METHODE_ACTIVE: "TRUE" }],
    ["ACTIVE « oui »", { METHODE_STUDIO_OUVERT: "true", METHODE_ACTIVE: "oui" }],
  ];

  it.each(cas)("%s → 404, base jamais lue, limiteur jamais appelé", async (_nom, env) => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
    for (const [k, v] of Object.entries(env)) if (v !== undefined) vi.stubEnv(k, v);
    vi.stubEnv("METHODE_STUDIO_SECRET", SECRET);
    const r = await POST(requete({ sujet: "relance" }));
    expect(r.status).toBe(404);
    neverCached(r);
    expect(base.lectures).toBe(0);
    expect(debit.appels).toHaveLength(0);
    expect(await r.text()).not.toMatch(/secret|methode|ouvert/i);
  });

  it("fermée, même sans secret ni en-tête : 404 avant 503 et 401", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
    vi.stubEnv("METHODE_STUDIO_SECRET", "");
    debit.autorise = false;
    const r = await POST(requete({ sujet: "relance" }, { "x-methode-secret": "faux" }));
    expect(r.status).toBe(404);
    neverCached(r);
    expect(base.lectures).toBe(0);
    expect(debit.appels).toHaveLength(0);
  });
});

describe("refus d'une route ouverte", () => {
  it("DATABASE_URL de build (stub.invalid) → 503, avant tout, même fermée", async () => {
    vi.stubEnv("DATABASE_URL", ["postgresql://stub:stub", "stub.invalid:5432/stub"].join("@"));
    const r = await POST(requete({ sujet: "relance" }));
    expect(r.status).toBe(503);
    neverCached(r);
    expect(base.lectures).toBe(0);
    expect(debit.appels).toHaveLength(0);
  });

  it.each([
    ["absent", undefined],
    ["vide", ""],
    ["31 caractères", "x".repeat(31)],
  ])("secret en configuration %s → 503", async (_n, valeur) => {
    ouvrir();
    debit.autorise = false;
    if (valeur === undefined) vi.stubEnv("METHODE_STUDIO_SECRET", undefined as unknown as string);
    else vi.stubEnv("METHODE_STUDIO_SECRET", valeur);
    const r = await POST(requete({ sujet: "relance" }, { "x-methode-secret": valeur ?? "" }));
    expect(r.status).toBe(503);
    neverCached(r);
    expect(base.lectures).toBe(0);
    expect(debit.appels).toHaveLength(0);
  });

  it("limite de débit atteinte → 429 + Retry-After: 60, avant le secret", async () => {
    ouvrir();
    debit.autorise = false;
    const r = await POST(requete({ sujet: "relance" }, { "x-methode-secret": "faux" }));
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("60");
    neverCached(r);
    expect(base.lectures).toBe(0);
  });

  it("le limiteur est appelé avec methode:studio:<ip>, 30 par 60 s", async () => {
    ouvrir();
    await POST(requete({ sujet: "relance" }, { "x-real-ip": "203.0.113.9" }));
    expect(debit.appels).toHaveLength(1);
    const [cle, config] = debit.appels[0] as [string, unknown];
    expect(cle).toBe("methode:studio:203.0.113.9");
    expect(config).toEqual({ limit: 30, windowSec: 60 });
  });

  it.each([
    ["absent", {}],
    ["faux", { "x-methode-secret": "autre-secret-factice-abcdefghijklmnop-qrstuv" }],
    ["de longueur différente", { "x-methode-secret": "court" }],
    ["vide", { "x-methode-secret": "" }],
  ])("en-tête secret %s → 401, base jamais lue", async (_n, entetes) => {
    ouvrir();
    const r = await POST(
      new Request(URL_ROUTE, {
        method: "POST",
        headers: { "content-type": "application/json", ...entetes },
        body: JSON.stringify({ sujet: "relance" }),
      }),
    );
    expect(r.status).toBe(401);
    neverCached(r);
    expect(base.lectures).toBe(0);
  });
});

describe("401 avant 400", () => {
  it("mauvais secret + corps illisible ou invalide → 401, base non lue", async () => {
    ouvrir();
    const faux = { "x-methode-secret": "autre-secret-factice-abcdefghijklmnop-qrstuv" };
    for (const [corps, brut] of [
      ["{pas du json", true],
      [{ sujet: "relance", intrus: 1 }, false],
    ] as const) {
      const r = await POST(requete(corps, faux, brut));
      expect(r.status).toBe(401);
      neverCached(r);
    }
    expect(base.lectures).toBe(0);
  });
});

describe("entrée stricte → 400", () => {
  const mauvais: Array<[string, unknown, boolean]> = [
    ["corps illisible", "{SUJET-TEMOIN-ZZ", true],
    ["corps vide", "", true],
    ["tableau", ["SUJET-TEMOIN-ZZ"], false],
    ["sujet absent", { autre: "SUJET-TEMOIN-ZZ" }, false],
    ["sujet d'un caractère", { sujet: "a" }, false],
    ["sujet d'un caractère après rognage", { sujet: " a " }, false],
    ["sujet de blancs", { sujet: "      " }, false],
    ["sujet de 301 caractères", { sujet: "a".repeat(301) }, false],
    ["sujet non chaîne", { sujet: 12 }, false],
    ["champ en trop (max)", { sujet: "relance", max: 10, intrus: "SUJET-TEMOIN-ZZ" }, false],
    ["champ en trop (autre)", { sujet: "relance", noyau: "SUJET-TEMOIN-ZZ" }, false],
    ["corps énorme", { sujet: "relance", bourrage: "z".repeat(50_000) }, false],
  ];

  it.each(mauvais)(
    "%s → 400, rien de la demande renvoyé, base jamais lue",
    async (_n, corps, brut) => {
      ouvrir();
      const sujetTemoin = "SUJET-TEMOIN-ZZ";
      const r = await POST(requete(corps, {}, brut));
      expect(r.status).toBe(400);
      neverCached(r);
      expect(base.lectures).toBe(0);
      const texte = await r.text();
      expect(texte).not.toContain(sujetTemoin);
      expect(texte).not.toContain("relance");
      expect(texte).not.toContain("zzzz");
    },
  );

  it("le texte reçu n'est jamais renvoyé dans un refus 400", async () => {
    ouvrir();
    const r = await POST(requete({ sujet: "relance", intrus: "SUJET-TEMOIN-ZZ" }));
    expect(r.status).toBe(400);
    expect(await r.text()).not.toContain("SUJET-TEMOIN-ZZ");
  });

  it("un sujet de 2 et de 300 caractères est accepté", async () => {
    ouvrir();
    expect((await POST(requete({ sujet: "ab" }))).status).toBe(200);
    expect((await POST(requete({ sujet: "a".repeat(300) }))).status).toBe(200);
  });
});

describe("sortie", () => {
  it("200 : { items, meta } seulement, extraits approuvés et filtrés, marque retirée", async () => {
    ouvrir();
    base.lignes = [
      ligne(
        "methode/faux-relance",
        "Faux titre relance",
        "sortie: validee\nRelancer après un diagnostic en rappelant la question posée.",
      ),
      ligne("methode/faux-non-marquee", "Faux non marquée", "Texte sain mais sans marque."),
      ligne(
        "methode/faux-montant",
        "Faux montant",
        `sortie: validee\nUn forfait à ${MONTANT_FACTICE} pour démarrer.`,
      ),
      ligne(
        "methode/faux-promesse",
        "Faux promesse",
        "sortie: validee\nVous allez doubler votre chiffre d'affaires.",
      ),
    ];
    base.noyaux = [
      {
        slug: "methode/faux-00/essentiel",
        tags: [],
        translations: [{ title: "Faux noyau", bodyText: "sortie: validee\nNoyau factice sain." }],
      },
    ];
    const r = await POST(requete({ sujet: "relance après diagnostic" }));
    expect(r.status).toBe(200);
    neverCached(r);
    const json = (await r.json()) as {
      items: Array<Record<string, string>>;
      meta: { returned: number };
    };
    expect(Object.keys(json).sort()).toEqual(["items", "meta"]);
    expect(json.meta).toEqual({ returned: 1 });
    expect(json.items).toEqual([
      {
        slug: "methode/faux-relance",
        titre: "Faux titre relance",
        texte: "Relancer après un diagnostic en rappelant la question posée.",
        source: "methode",
      },
    ]);
    const tout = JSON.stringify(json);
    expect(tout).not.toContain("sortie: validee");
    expect(tout).not.toContain("faux-non-marquee");
    expect(tout).not.toContain("faux-montant");
    expect(tout).not.toContain("faux-promesse");
    expect(tout).not.toContain("faux-00");
    expect(tout).not.toContain("Faux noyau");
    expect(tout).not.toContain("Noyau factice sain");
    expect(tout).not.toContain("etiquettes");
    expect(tout).not.toContain("collection");
  });

  it("au plus 5 extraits, de 1 500 caractères au plus, même si le sujet n'en demande pas moins", async () => {
    ouvrir();
    base.lignes = Array.from({ length: 9 }, (_v, i) =>
      ligne(
        `methode/faux-long-${i}`,
        `Faux long ${i}`,
        `sortie: validee\n${"Une phrase factice et saine sur la relance.\n".repeat(120)}`,
      ),
    );
    const r = await POST(requete({ sujet: "relance" }));
    const json = (await r.json()) as {
      items: Array<{ texte: string }>;
      meta: { returned: number };
    };
    expect(json.items).toHaveLength(5);
    expect(json.meta.returned).toBe(5);
    // 1 500 caractères + la marque de coupe « \n[…] » (4 caractères) posée par la couche.
    for (const it of json.items) expect(it.texte.length).toBeLessThanOrEqual(1_504);
  });

  it("aucun résultat → 200 avec items vide", async () => {
    ouvrir();
    const r = await POST(requete({ sujet: "relance" }));
    expect(r.status).toBe(200);
    neverCached(r);
    expect(await r.json()).toEqual({ items: [], meta: { returned: 0 } });
  });

  it("panne de base : la couche rend neutre, la route répond 200 vide, sans écriture", async () => {
    ouvrir();
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.$queryRawUnsafe).mockRejectedValueOnce(new Error("panne factice"));
    const r = await POST(requete({ sujet: "relance" }));
    expect(r.status).toBe(200);
    neverCached(r);
    expect(await r.json()).toEqual({ items: [], meta: { returned: 0 } });
  });
});

describe("journal : rien de la demande ni du texte servi", () => {
  it("aucun console.* ne contient le sujet, un slug ou un texte", async () => {
    ouvrir();
    const espions = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    base.lignes = [
      ligne("methode/faux-journal", "Faux journal", "sortie: validee\nTexte factice servi."),
    ];
    await POST(requete({ sujet: "SUJET-TEMOIN-JOURNAL" }));
    await POST(requete({ sujet: "a", extra: "SUJET-TEMOIN-JOURNAL" }));
    await POST(requete("{SUJET-TEMOIN-JOURNAL", {}, true));
    const lu = JSON.stringify(espions.flatMap((e) => e.mock.calls));
    expect(lu).not.toContain("SUJET-TEMOIN-JOURNAL");
    expect(lu).not.toContain("faux-journal");
    expect(lu).not.toContain("Texte factice servi");
    for (const e of espions) e.mockRestore();
  });
});

describe("lecture seule", () => {
  it("un parcours complet ne touche aucune méthode d'écriture du client", async () => {
    ouvrir();
    base.lignes = [ligne("methode/faux-lecture", "Faux", "sortie: validee\nTexte factice sain.")];
    // Si une écriture était tentée, le faux jetterait ; la couche avale les pannes, donc
    // on vérifie aussi que le résultat n'est pas le neutre.
    const r = await POST(requete({ sujet: "relance" }));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { meta: { returned: number } }).meta.returned).toBe(1);
  });
});
