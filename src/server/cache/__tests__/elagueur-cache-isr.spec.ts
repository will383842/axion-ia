// @vitest-environment node
//
// Environnement `node` : le module lit et supprime de vrais fichiers.

/**
 * Verrou du disque du VPS (incident du 2026-10-10, mesure du 2026-10-23) :
 * l'élagueur doit retirer les plus vieilles pages écrites à l'exécution, et
 * JAMAIS une page du build (rendue avec `stub.invalid`, elle servirait vide).
 */
import { mkdtemp, mkdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MARGE_BUILD_MS,
  cleDeFichier,
  clesDuManifeste,
  elaguerCacheIsr,
} from "../elagueur-cache-isr";

const BUILD = Date.parse("2026-10-21T06:10:44Z");
const KO = 1024;
const AUCUNE: ReadonlySet<string> = new Set();

let racine: string;

async function poser(relatif: string, octets: number, dateMs: number): Promise<void> {
  const complet = path.join(racine, relatif);
  await mkdir(path.dirname(complet), { recursive: true });
  await writeFile(complet, Buffer.alloc(octets));
  await utimes(complet, dateMs / 1000, dateMs / 1000);
}

/** Une page complète telle que `FileSystemCache.set` l'écrit. */
async function page(cle: string, dateMs: number): Promise<void> {
  await poser(`${cle}.html`, 40 * KO, dateMs);
  await poser(`${cle}.rsc`, 40 * KO, dateMs);
  await poser(`${cle}.meta`, 1 * KO, dateMs);
  await poser(`${cle}.segments/_tree.segment.rsc`, 4 * KO, dateMs);
}

const existe = async (relatif: string): Promise<boolean> =>
  stat(path.join(racine, relatif)).then(
    () => true,
    () => false,
  );

beforeEach(async () => {
  racine = await mkdtemp(path.join(tmpdir(), "elagueur-isr-"));
});
afterEach(async () => {
  await rm(racine, { recursive: true, force: true });
});

describe("cleDeFichier", () => {
  it("rattache .html, .rsc, .meta et les segments à la même clé", () => {
    expect(cleDeFichier("fr/faq/x.html")).toEqual({ cle: "fr/faq/x", principal: true });
    expect(cleDeFichier("fr/faq/x.rsc")).toEqual({ cle: "fr/faq/x", principal: false });
    expect(cleDeFichier("fr/faq/x.meta")).toEqual({ cle: "fr/faq/x", principal: false });
    expect(cleDeFichier("fr/faq/x.segments/_tree.segment.rsc")).toEqual({
      cle: "fr/faq/x",
      principal: false,
    });
    expect(cleDeFichier("api/x/route.body")).toEqual({ cle: "api/x/route", principal: true });
  });

  it("ignore le code du build (js, json, map)", () => {
    expect(cleDeFichier("fr/faq/[slug]/page.js")).toBeNull();
    expect(cleDeFichier("fr/faq/[slug]/page.js.nft.json")).toBeNull();
    expect(cleDeFichier("fr/faq/[slug]/page.js.map")).toBeNull();
  });
});

describe("clesDuManifeste", () => {
  it("rend les clés de fichier de Next (`/` → index, sans / initial)", () => {
    expect(clesDuManifeste({ routes: { "/": {}, "/fr": {}, "/fr/glossaire/x": {} } })).toEqual(
      new Set(["index", "fr", "fr/glossaire/x"]),
    );
  });

  it("refuse un manifeste sans routes (le tour est alors annulé, rien n'est supprimé)", () => {
    expect(() => clesDuManifeste({})).toThrow();
  });
});

describe("elaguerCacheIsr", () => {
  it("ne retire rien sous le budget", async () => {
    await page("fr/faq/a", BUILD + 3_600_000);
    const r = await elaguerCacheIsr({
      racine,
      dateBuildMs: BUILD,
      budgetOctets: 10 * 1024 * KO,
      routesProtegees: AUCUNE,
      pauseMs: 0,
    });
    expect(r.entreesSupprimees).toBe(0);
    expect(await existe("fr/faq/a.html")).toBe(true);
  });

  it("retire les plus vieilles pages d'abord, avec tous leurs fichiers, jusqu'à 80 % du budget", async () => {
    // 4 pages de 85 Ko : 340 Ko pour un budget de 220 Ko → cible 176 Ko → 2 restent (170 Ko).
    await page("fr/faq/la-plus-vieille", BUILD + 1 * 3_600_000);
    await page("fr/faq/vieille", BUILD + 2 * 3_600_000);
    await page("fr/faq/recente", BUILD + 3 * 3_600_000);
    await page("fr/faq/la-plus-recente", BUILD + 4 * 3_600_000);

    const r = await elaguerCacheIsr({
      racine,
      dateBuildMs: BUILD,
      budgetOctets: 220 * KO,
      routesProtegees: AUCUNE,
      pauseMs: 0,
    });

    expect(r.entreesSupprimees).toBe(2);
    expect(r.octetsAvant).toBe(4 * 85 * KO);
    for (const suffixe of [".html", ".rsc", ".meta", ".segments/_tree.segment.rsc"]) {
      expect(await existe(`fr/faq/la-plus-vieille${suffixe}`)).toBe(false);
      expect(await existe(`fr/faq/vieille${suffixe}`)).toBe(false);
      expect(await existe(`fr/faq/la-plus-recente${suffixe}`)).toBe(true);
    }
    expect(await existe("fr/faq/recente.html")).toBe(true);
    // Fichiers seulement : le dossier reste (une écriture concurrente y compte).
    expect(await existe("fr/faq/la-plus-vieille.segments")).toBe(true);
  });

  it("ne touche JAMAIS une page du build, même la plus vieille et même hors budget", async () => {
    await page("fr", BUILD); // build
    await page("fr/a-propos", BUILD + MARGE_BUILD_MS - 1_000); // dans la marge : build
    await poser("fr/faq/[slug]/page.js", 500 * KO, BUILD + 3_600_000); // code : jamais candidat
    await page("fr/faq/x", BUILD + 3_600_000);

    const r = await elaguerCacheIsr({
      racine,
      dateBuildMs: BUILD,
      budgetOctets: 1,
      routesProtegees: AUCUNE,
      pauseMs: 0,
    });

    expect(r.entreesSupprimees).toBe(1);
    expect(await existe("fr.html")).toBe(true);
    expect(await existe("fr/a-propos.html")).toBe(true);
    expect(await existe("fr/faq/[slug]/page.js")).toBe(true);
    expect(await existe("fr/faq/x.html")).toBe(false);
  });

  it.each([
    ["le .html récent, le .rsc du build", BUILD + 3_600_000, BUILD],
    ["le .html du build, le .rsc récent", BUILD, BUILD + 3_600_000],
  ])(
    "protège une entrée dont un seul fichier date du build, quel que soit l'ordre (%s)",
    async (_cas, dateHtml, dateRsc) => {
      await poser("fr/blog.html", 40 * KO, dateHtml);
      await poser("fr/blog.rsc", 40 * KO, dateRsc);
      const r = await elaguerCacheIsr({
        racine,
        dateBuildMs: BUILD,
        budgetOctets: 1,
        routesProtegees: AUCUNE,
        pauseMs: 0,
      });
      expect(r.entreesSupprimees).toBe(0);
      expect(await existe("fr/blog.html")).toBe(true);
      expect(await existe("fr/blog.rsc")).toBe(true);
    },
  );

  it("ne touche JAMAIS une route du prerender-manifest, même régénérée et hors budget (404 sinon)", async () => {
    // `dynamicParams = false` : sans entrée, Next rend 404 jusqu'au déploiement suivant.
    await page("fr/glossaire/agent-ia", BUILD + 3_600_000);
    await page("index", BUILD + 3_600_000);
    await page("fr/faq/a-la-demande", BUILD + 3_600_000);
    const routesProtegees = clesDuManifeste({
      routes: { "/": {}, "/fr/glossaire/agent-ia": {} },
    });

    const r = await elaguerCacheIsr({
      racine,
      dateBuildMs: BUILD,
      budgetOctets: 1,
      routesProtegees,
      pauseMs: 0,
    });

    expect(r.entreesSupprimees).toBe(1);
    expect(await existe("fr/glossaire/agent-ia.html")).toBe(true);
    expect(await existe("index.html")).toBe(true);
    expect(await existe("fr/faq/a-la-demande.html")).toBe(false);
  });

  it("garde les fichiers d'une page re-rendue pendant la pause", async () => {
    await page("fr/faq/x", BUILD + 3_600_000);
    const enCours = elaguerCacheIsr({
      racine,
      dateBuildMs: BUILD,
      budgetOctets: 1,
      routesProtegees: AUCUNE,
      pauseMs: 300,
    });
    // Pendant la pause, Next re-rend la page : nouveau .html, nouveau .rsc.
    await new Promise((r) => setTimeout(r, 100));
    await writeFile(path.join(racine, "fr/faq/x.html"), Buffer.alloc(KO));
    await writeFile(path.join(racine, "fr/faq/x.rsc"), Buffer.alloc(KO));
    const r = await enCours;
    expect(r.entreesSupprimees).toBe(0);
    expect(await existe("fr/faq/x.html")).toBe(true);
    expect(await existe("fr/faq/x.rsc")).toBe(true);
    expect(await existe("fr/faq/x.meta")).toBe(true);
  });

  it("garde un compagnon réécrit pendant la pause, même si le .html n'est pas revenu", async () => {
    await page("fr/faq/x", BUILD + 3_600_000);
    const enCours = elaguerCacheIsr({
      racine,
      dateBuildMs: BUILD,
      budgetOctets: 1,
      routesProtegees: AUCUNE,
      pauseMs: 300,
    });
    await new Promise((r) => setTimeout(r, 100));
    await writeFile(path.join(racine, "fr/faq/x.rsc"), Buffer.alloc(KO));
    const r = await enCours;
    expect(await existe("fr/faq/x.html")).toBe(false);
    expect(await existe("fr/faq/x.rsc")).toBe(true);
    expect(await existe("fr/faq/x.meta")).toBe(false);
    expect(r.entreesSupprimees).toBe(1);
  });

  it("tolère une racine absente (rien à faire, aucune erreur)", async () => {
    const r = await elaguerCacheIsr({
      racine: path.join(racine, "absent"),
      dateBuildMs: BUILD,
      budgetOctets: 1,
      routesProtegees: AUCUNE,
      pauseMs: 0,
    });
    expect(r).toEqual({ octetsAvant: 0, octetsSupprimes: 0, entreesSupprimees: 0 });
  });
});
