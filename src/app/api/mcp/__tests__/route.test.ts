import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ⚠️ **CE QUE CETTE GARDE MESURE, ET CE QU'ELLE NE MESURE PAS.**
 *
 * Elle exerce le handler **en processus**, avec de vraies `Request`. Elle ne
 * prouve donc PAS que la route est injoignable depuis l'extérieur — le critère
 * de fin du lot 4a l'exige « vérifié depuis un autre réseau », ce qui est une
 * mesure d'exploitation, pas un test unitaire. Ce fichier ferme l'autre moitié :
 * qu'aucun chemin de code ne serve quoi que ce soit sans secret.
 */

const limiteAtteinte = vi.hoisted(() => ({ valeur: false }));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: !limiteAtteinte.valeur,
    remaining: 0,
    resetAt: 0,
  })),
}));

// `@/auth` (next-auth) est tiré par la couche service que le registre importe ;
// hors sujet ici, et next-auth exige un `next/server` que vitest ne résout pas.
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));

const SECRET = "un-secret-de-garde-sans-valeur-reelle";

// L'exécuteur d'outil est simulé : cette garde mesure la ROUTE (serrure,
// enveloppe, correspondance des codes), pas les outils — ils ont leurs gardes
// sous `src/server/mcp/__tests__/`.
const appelMock = vi.hoisted(() => ({ executerAppel: vi.fn() }));
vi.mock("@/server/mcp/appel", () => ({
  executerAppel: (...a: unknown[]) => appelMock.executerAppel(...a),
}));

/** Fabrique un appel JSON-RPC. Le secret est OPTIONNEL — c'est tout l'objet. */
function appel(corps: unknown, options: { secret?: string; entete?: string } = {}): Request {
  const entetes: Record<string, string> = { "content-type": "application/json" };
  if (options.secret !== undefined) {
    entetes[options.entete ?? "x-mcp-secret"] = options.secret;
  }
  return new Request("https://exemple.test/api/mcp", {
    method: "POST",
    headers: entetes,
    body: typeof corps === "string" ? corps : JSON.stringify(corps),
  });
}

async function charger() {
  vi.resetModules();
  return import("../route");
}

beforeEach(() => {
  limiteAtteinte.valeur = false;
  process.env.DATABASE_URL = "postgresql://reel:reel@localhost:5432/reel";
  process.env.MCP_SHARED_SECRET = SECRET;
});

describe("la route ne sert RIEN sans secret — et le prouve par quatre chemins distincts", () => {
  it("rend 503 quand le build hors-ligne est détecté, AVANT toute autre lecture", async () => {
    // ⚠️ Le contrat de l'ADR 0026. On sort en tête de handler : au SSG, la route
    //    ne doit ni lire un secret, ni toucher la base, ni compter un appel.
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    delete process.env.MCP_SHARED_SECRET;

    const { POST } = await charger();
    const res = await POST(appel({ jsonrpc: "2.0", id: 1, method: "ping" }) as never);

    console.info(`[mcp] build hors-ligne → ${String(res.status)} ${await res.clone().text()}`);
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("build_stub");
  });

  it("rend 503 — pas 200 — quand la variable de secret est ABSENTE de la configuration", async () => {
    // Le piège que ce test ferme : une route qui se dégraderait en « ouverte »
    // le jour d'un déploiement incomplet.
    delete process.env.MCP_SHARED_SECRET;

    const { POST } = await charger();
    const res = await POST(
      appel({ jsonrpc: "2.0", id: 1, method: "ping" }, { secret: SECRET }) as never,
    );

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("mcp_secret_missing");
  });

  it("rend 401 sans en-tête, avec un secret faux, et avec le BON secret au MAUVAIS en-tête", async () => {
    const { POST } = await charger();

    const temoins: readonly [string, Request][] = [
      ["aucun en-tête", appel({ jsonrpc: "2.0", id: 1, method: "ping" })],
      ["secret faux", appel({ jsonrpc: "2.0", id: 1, method: "ping" }, { secret: `${SECRET}x` })],
      ["secret vide", appel({ jsonrpc: "2.0", id: 1, method: "ping" }, { secret: "" })],
      // ⚠️ Le bon secret, mais présenté sous un AUTRE nom d'en-tête. Une garde
      //    qui lirait « le premier en-tête qui ressemble » passerait ici.
      [
        "bon secret, mauvais en-tête",
        appel(
          { jsonrpc: "2.0", id: 1, method: "ping" },
          {
            secret: SECRET,
            entete: "authorization",
          },
        ),
      ],
    ];

    for (const [nom, req] of temoins) {
      const res = await POST(req as never);
      expect(res.status, `« ${nom} » devait rendre 401`).toBe(401);
    }
    console.info(`[mcp] ${String(temoins.length)} témoin(s) de refus, tous à 401`);
  });

  it("limite le débit AVANT de comparer le secret — sinon la route est un oracle", async () => {
    // ⚠️ Placer la limitation APRÈS la comparaison ferait de chaque tentative un
    //    simple hash : la force brute deviendrait gratuite. Ce test le verrouille
    //    en n'envoyant AUCUN secret : si le 429 ne sort pas, c'est que le 401 est
    //    passé devant.
    limiteAtteinte.valeur = true;

    const { POST } = await charger();
    const res = await POST(appel({ jsonrpc: "2.0", id: 1, method: "ping" }) as never);

    expect(res.status).toBe(429);
  });
});

describe("avec le bon secret, elle parle JSON-RPC 2.0 — et dit ce qu'elle n'a pas", () => {
  it("répond à initialize en annonçant UNE seule primitive", async () => {
    const { POST, VERSION_DU_PROTOCOLE } = await charger();
    const res = await POST(
      appel({ jsonrpc: "2.0", id: 7, method: "initialize" }, { secret: SECRET }) as never,
    );
    const corps = (await res.json()) as {
      id: number;
      result: { protocolVersion: string; capabilities: Record<string, unknown> };
    };

    console.info(
      `[mcp] initialize → protocole ${corps.result.protocolVersion} · ` +
        `capacités [${Object.keys(corps.result.capabilities).join(", ")}]`,
    );

    expect(res.status).toBe(200);
    expect(corps.id).toBe(7);
    expect(corps.result.protocolVersion).toBe(VERSION_DU_PROTOCOLE);
    // `resources` et `prompts` sont HORS PÉRIMÈTRE. Les annoncer sans les livrer
    // ferait échouer le socle plus loin, sur un symptôme qui ne les nomme pas.
    expect(Object.keys(corps.result.capabilities)).toEqual(["tools"]);
  });

  it("publie les six outils du registre, chacun avec son schéma d'entrée FERMÉ", async () => {
    const { POST } = await charger();
    const res = await POST(
      appel({ jsonrpc: "2.0", id: 8, method: "tools/list" }, { secret: SECRET }) as never,
    );
    const corps = (await res.json()) as {
      result: {
        tools: {
          name: string;
          inputSchema: { additionalProperties?: unknown };
          annotations: { readOnlyHint: boolean };
        }[];
      };
    };

    const noms = corps.result.tools.map((t) => t.name).sort();
    console.info(`[mcp] tools/list → ${String(noms.length)} outil(s) : ${noms.join(", ")}`);
    expect(noms).toEqual([
      "axionia.agenda.jour",
      "axionia.agenda.semaine",
      "axionia.inbox.recent",
      "axionia.pilotage.alertes",
      "axionia.qualiopi.conformite",
      "axionia.rendezvous.list",
    ]);
    for (const outil of corps.result.tools) {
      expect(outil.inputSchema.additionalProperties, outil.name).toBe(false);
      expect(outil.annotations.readOnlyHint, outil.name).toBe(true);
    }
  });

  it("rend le manifeste sur axionia/manifest — derrière la même serrure", async () => {
    const { POST } = await charger();
    const res = await POST(
      appel({ jsonrpc: "2.0", id: 10, method: "axionia/manifest" }, { secret: SECRET }) as never,
    );
    const corps = (await res.json()) as {
      result: { manifest: { id: string; mode: string; tools: unknown[] } };
    };
    expect(corps.result.manifest.id).toBe("axionia");
    expect(corps.result.manifest.mode).toBe("fédéré");
    expect(corps.result.manifest.tools).toHaveLength(6);

    const sans = await POST(appel({ jsonrpc: "2.0", id: 11, method: "axionia/manifest" }) as never);
    expect(sans.status).toBe(401);
  });

  it("refuse une méthode inconnue avec -32601, et NOMME la méthode reçue", async () => {
    const { POST } = await charger();
    const res = await POST(
      appel({ jsonrpc: "2.0", id: 9, method: "prompts/list" }, { secret: SECRET }) as never,
    );
    const corps = (await res.json()) as { error: { code: number; message: string } };

    expect(corps.error.code).toBe(-32601);
    // Un refus qui ne nomme pas ce qu'il a reçu se paie en quart d'heure perdu.
    expect(corps.error.message).toContain("prompts/list");
  });

  it("refuse une enveloppe mal formée, chacune par son code propre", async () => {
    const { POST } = await charger();

    const cas: readonly [string, unknown, number][] = [
      ["JSON illisible", "{ ceci n est pas du json", -32700],
      ["jsonrpc absent", { id: 1, method: "ping" }, -32600],
      ["jsonrpc en 1.0", { jsonrpc: "1.0", id: 1, method: "ping" }, -32600],
      ["method absente", { jsonrpc: "2.0", id: 1 }, -32600],
    ];

    const codes = new Set<number>();
    for (const [nom, corps, attendu] of cas) {
      const res = await POST(appel(corps, { secret: SECRET }) as never);
      const recu = (await res.json()) as { error: { code: number } };
      expect(recu.error.code, `« ${nom} »`).toBe(attendu);
      codes.add(recu.error.code);
    }
    console.info(`[mcp] ${String(cas.length)} enveloppe(s) mal formée(s) refusée(s)`);
    // Deux familles distinctes : analyse impossible vs requête invalide.
    expect(codes.size).toBe(2);
  });
});

describe("tools/call — la forme MCP, et deux familles de refus bien distinctes", () => {
  it("passe name, arguments et les identifiants de _meta à l'exécuteur, et rend structuredContent", async () => {
    appelMock.executerAppel.mockResolvedValue({
      ok: true,
      sortie: { items: [{ id: "1" }], meta: { returned: 1 } },
      returned: 1,
      octets: 42,
    });
    const { POST } = await charger();
    const res = await POST(
      appel(
        {
          jsonrpc: "2.0",
          id: 12,
          method: "tools/call",
          params: {
            name: "axionia.inbox.recent",
            arguments: { limite: 5 },
            _meta: { "ops/requestId": "req-7", "ops/principal": "socle-test" },
          },
        },
        { secret: SECRET },
      ) as never,
    );
    const corps = (await res.json()) as {
      result: {
        isError: boolean;
        structuredContent: { items: unknown[] };
        content: { type: string; text: string }[];
      };
    };
    expect(corps.result.isError).toBe(false);
    expect(corps.result.structuredContent.items).toHaveLength(1);
    expect(JSON.parse(corps.result.content[0]?.text ?? "{}")).toEqual(
      corps.result.structuredContent,
    );
    expect(appelMock.executerAppel).toHaveBeenCalledWith(
      "axionia.inbox.recent",
      { limite: 5 },
      { requestId: "req-7", principal: "socle-test" },
    );
  });

  it("outil inconnu et entrée hors schéma sont des erreurs de PROTOCOLE (-32602, avec le code)", async () => {
    appelMock.executerAppel.mockResolvedValue({
      ok: false,
      code: "invalid_input",
      message: "l'entrée ne respecte pas le schéma",
      details: [{ chemin: "limite", probleme: "trop grand" }],
    });
    const { POST } = await charger();
    const res = await POST(
      appel(
        {
          jsonrpc: "2.0",
          id: 13,
          method: "tools/call",
          params: { name: "axionia.inbox.recent", arguments: {} },
        },
        { secret: SECRET },
      ) as never,
    );
    const corps = (await res.json()) as {
      error: { code: number; data: { code: string; details: unknown[] } };
    };
    expect(corps.error.code).toBe(-32602);
    expect(corps.error.data.code).toBe("invalid_input");
    expect(corps.error.data.details).toHaveLength(1);
  });

  it("une source en panne est une erreur d'EXÉCUTION : résultat isError, pas erreur JSON-RPC", async () => {
    appelMock.executerAppel.mockResolvedValue({
      ok: false,
      code: "upstream_unavailable",
      message: "la source n'a pas répondu",
    });
    const { POST } = await charger();
    const res = await POST(
      appel(
        {
          jsonrpc: "2.0",
          id: 14,
          method: "tools/call",
          params: { name: "axionia.agenda.jour", arguments: { jour: "2026-09-02" } },
        },
        { secret: SECRET },
      ) as never,
    );
    const corps = (await res.json()) as {
      error?: unknown;
      result: { isError: boolean; structuredContent: { code: string } };
    };
    expect(corps.error).toBeUndefined();
    expect(corps.result.isError).toBe(true);
    expect(corps.result.structuredContent.code).toBe("upstream_unavailable");
  });

  it("refuse des params absents ou sans name, sans même appeler l'exécuteur", async () => {
    appelMock.executerAppel.mockClear();
    const { POST } = await charger();
    for (const params of [undefined, [], { arguments: {} }, { name: "" }]) {
      const res = await POST(
        appel(
          { jsonrpc: "2.0", id: 15, method: "tools/call", params },
          { secret: SECRET },
        ) as never,
      );
      const corps = (await res.json()) as { error: { code: number } };
      expect(corps.error.code).toBe(-32602);
    }
    expect(appelMock.executerAppel).not.toHaveBeenCalled();
  });
});

describe("les verbes autres que POST", () => {
  it("rendent 405 en annonçant le verbe admis", async () => {
    // ⚠️ Un verbe manquant qui rend 405 a déjà coûté un webhook dans ce dépôt
    //    (PR 917) : personne ne voyait POURQUOI. Ici le 405 est explicite et porte
    //    son en-tête `Allow`.
    const { GET } = await charger();
    const res = GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
