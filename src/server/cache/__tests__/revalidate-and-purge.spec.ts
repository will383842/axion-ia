// @vitest-environment node
//
// Environnement `node` : le module lit `process.env` et appelle `fetch`.

/**
 * Verrou GEO-120 — aucune publication ne purgeait le cache edge
 * (audit GEO/AEO du 2026-08-14, lot 19).
 *
 * ## Le défaut mesuré
 *
 * `revalidatePath()` n'invalide que le cache de l'ORIGINE. Cloudflare, lui,
 * continue de servir sa copie jusqu'à expiration du `s-maxage` — 1 h sur les
 * hubs, 24 h sur les pages éditoriales. Résultat : publier un article le rendait
 * frais à l'origine et **périmé pour le public et pour les crawlers** pendant
 * tout ce délai. Une seule occurrence de `purge_cache` existait dans tout `src/`,
 * dans le worker observatoire, sur deux URLs codées en dur.
 *
 * ## Ce que cette garde protège
 *
 * 1. **L'ordre.** Origine d'abord, edge ensuite. L'inversion n'est pas un détail
 *    de style : purger l'edge en premier fait recharger à Cloudflare la page
 *    périmée qu'on cherchait à chasser, et la refait vivre pour un `s-maxage`
 *    entier. Une purge inversée est pire que pas de purge.
 * 2. **Le plafond bavard.** Tronquer à 30 URLs est un choix (quota CF Free) ;
 *    tronquer en silence se lirait comme « tout a été purgé ».
 * 3. **Non configuré ≠ en panne.** Sans secrets CF, il n'y a pas d'edge à purger
 *    (dev, tests, build stub) : ce n'est pas un échec.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_URLS_PAR_PURGE,
  edgePurgeDisponible,
  purgerEdge,
  revalidateAndPurge,
} from "@/server/cache/revalidate-and-purge";

const SAUVEGARDE = {
  token: process.env["CLOUDFLARE_API_TOKEN"],
  zone: process.env["CLOUDFLARE_ZONE_ID"],
  site: process.env["NEXT_PUBLIC_SITE_URL"],
};

function restaurer(cle: string, valeur: string | undefined): void {
  if (valeur === undefined) delete process.env[cle];
  else process.env[cle] = valeur;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restaurer("CLOUDFLARE_API_TOKEN", SAUVEGARDE.token);
  restaurer("CLOUDFLARE_ZONE_ID", SAUVEGARDE.zone);
  restaurer("NEXT_PUBLIC_SITE_URL", SAUVEGARDE.site);
});

describe("edge non configuré ≠ edge en panne", () => {
  beforeEach(() => {
    delete process.env["CLOUDFLARE_API_TOKEN"];
    delete process.env["CLOUDFLARE_ZONE_ID"];
  });

  it("sans secrets, aucun appel réseau et l'origine est quand même revalidée", async () => {
    const appels: string[] = [];
    vi.stubGlobal("fetch", (u: string) => {
      appels.push(u);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const vus: string[] = [];

    const r = await revalidateAndPurge(["/fr/blog/x"], (c) => vus.push(c));

    expect(vus, "l'origine doit etre revalidee meme sans edge").toEqual(["/fr/blog/x"]);
    expect(appels, "aucun appel CF ne doit partir sans secrets").toEqual([]);
    expect(r.edgeConfigure).toBe(false);
    expect(r.urlsPurgees).toEqual([]);
  });

  it("`edgePurgeDisponible` reflète la présence des DEUX secrets", () => {
    expect(edgePurgeDisponible()).toBe(false);
    process.env["CLOUDFLARE_API_TOKEN"] = "t";
    expect(edgePurgeDisponible(), "un seul secret ne suffit pas").toBe(false);
    process.env["CLOUDFLARE_ZONE_ID"] = "z";
    expect(edgePurgeDisponible()).toBe(true);
  });
});

describe("chemin nominal", () => {
  beforeEach(() => {
    process.env["CLOUDFLARE_API_TOKEN"] = "jeton-de-test";
    process.env["CLOUDFLARE_ZONE_ID"] = "zone-de-test";
    process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
  });

  it("🔴 l'origine est revalidée AVANT que l'edge soit purgé", async () => {
    // 🔑 Le coeur de la garde. Purger l'edge en premier ferait recharger a
    // Cloudflare la page perimee : la purge deviendrait contre-productive.
    const chronologie: string[] = [];
    vi.stubGlobal("fetch", () => {
      chronologie.push("purge-edge");
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    await revalidateAndPurge(["/fr/blog/x"], () => chronologie.push("revalidate-origine"));

    expect(chronologie).toEqual(["revalidate-origine", "purge-edge"]);
  });

  it("purge des URLs absolues construites depuis le site, et dédupliquées", async () => {
    let corps: { files?: string[] } = {};
    vi.stubGlobal("fetch", (_u: string, init?: RequestInit) => {
      corps = JSON.parse(String(init?.body ?? "{}")) as { files?: string[] };
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const r = await revalidateAndPurge(["/fr/blog/x", "/fr/blog", "/fr/blog/x"], () => {});

    expect(corps.files).toEqual(["https://axion-ia.com/fr/blog/x", "https://axion-ia.com/fr/blog"]);
    expect(r.urlsPurgees).toHaveLength(2);
  });

  it("ignore les entrées qui ne sont pas des chemins absolus", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("{}", { status: 200 })));
    const vus: string[] = [];
    const r = await revalidateAndPurge(
      ["/fr/ok", "https://ailleurs.test/x", "sans-slash", ""],
      (c) => vus.push(c),
    );
    expect(vus).toEqual(["/fr/ok"]);
    expect(r.cheminsRevalides).toEqual(["/fr/ok"]);
  });

  it("🔴 au-delà du plafond, ce qui est écarté est COMPTÉ et JOURNALISÉ", async () => {
    // Une troncature silencieuse se lit comme « tout a ete purge ».
    const avertissements: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
      avertissements.push(a.map(String).join(" "));
    });
    vi.stubGlobal("fetch", (_u: string, init?: RequestInit) => {
      const b = JSON.parse(String(init?.body ?? "{}")) as { files: string[] };
      expect(b.files).toHaveLength(MAX_URLS_PAR_PURGE);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const trop = Array.from({ length: MAX_URLS_PAR_PURGE + 5 }, (_, i) => `/fr/p/${i}`);
    const r = await revalidateAndPurge(trop, () => {});

    expect(r.urlsEcartees).toBe(5);
    expect(
      avertissements.some((m) => m.includes("NE SONT PAS purgees")),
      "l'ecart doit etre visible dans les journaux, pas seulement dans la valeur de retour",
    ).toBe(true);
  });

  it("un refus HTTP de Cloudflare ne fait pas échouer la publication", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("quota", { status: 429 })));
    const r = await purgerEdge(["https://axion-ia.com/fr"]);
    expect(r.configure).toBe(true);
    expect(r.purgees).toEqual([]);
  });

  it("une panne réseau est absorbée de la même façon", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", () => Promise.reject(new Error("ECONNRESET")));
    const r = await purgerEdge(["https://axion-ia.com/fr"]);
    expect(r.configure).toBe(true);
    expect(r.purgees).toEqual([]);
  });

  it("un `revalidatePath` qui throw n'empêche pas les chemins suivants", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("{}", { status: 200 })));
    const r = await revalidateAndPurge(["/fr/casse", "/fr/ok"], (c) => {
      if (c === "/fr/casse") throw new Error("hors contexte de requete");
    });
    expect(r.cheminsRevalides, "seul le chemin sain est retenu").toEqual(["/fr/ok"]);
    expect(r.urlsPurgees).toEqual(["https://axion-ia.com/fr/ok"]);
  });

  it("une liste vide ne déclenche aucun appel", async () => {
    const appels: string[] = [];
    vi.stubGlobal("fetch", (u: string) => {
      appels.push(u);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const r = await revalidateAndPurge([], () => {});
    expect(appels).toEqual([]);
    expect(r.urlsPurgees).toEqual([]);
  });
});
