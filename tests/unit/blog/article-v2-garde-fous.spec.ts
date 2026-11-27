/** PR S2 — garde-fous statiques : serveur seulement, aucun hexadécimal, CSS bornée, messages alignés. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GABARITS_ARTICLE } from "@/server/content-gen/blog/gabarits";
import { CODES_MESSAGES_GABARITS, chargerMessagesGabarits } from "@/i18n/messages-gabarits";

const RACINE = process.cwd();
const lire = (rel: string) => fs.readFileSync(path.join(RACINE, rel), "utf-8");

function fichiers(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiers(rel, ext));
    else if (ext.test(e.name)) out.push(rel);
  }
  return out;
}

const SOURCES = fichiers("src/components/article-v2", /\.tsx?$/);
const FEUILLES = fichiers("src/styles/article-v2", /\.css$/);

describe("composants article-v2 : serveur seulement", () => {
  it("aucun « use client » dans article-v2/", () => {
    expect(SOURCES.length).toBeGreaterThan(15);
    for (const f of SOURCES) expect(lire(f), f).not.toMatch(/["']use client["']/);
  });

  it("aucune importation de hook d'état ou d'effet côté client", () => {
    for (const f of SOURCES) {
      expect(lire(f), f).not.toMatch(/\buse(State|Effect|LayoutEffect|Reducer)\b/);
    }
  });

  it("les huit gabarits ont chacun leur fichier", () => {
    const noms = (code: string) => code.charAt(0).toUpperCase() + code.slice(1);
    for (const code of GABARITS_ARTICLE) {
      expect(
        fs.existsSync(
          path.join(RACINE, `src/components/article-v2/gabarits/Gabarit${noms(code)}.tsx`),
        ),
      ).toBe(true);
      expect(fs.existsSync(path.join(RACINE, `src/styles/article-v2/${code}.css`))).toBe(true);
    }
    expect(FEUILLES).toHaveLength(9);
  });

  it("aucun hexadécimal (sources et feuilles)", () => {
    const hex = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;
    for (const f of [...SOURCES, ...FEUILLES]) expect(lire(f), f).not.toMatch(hex);
  });
});

/** Sélecteurs de premier niveau d'une feuille (descend dans les `@media`). */
function selecteurs(css: string): string[] {
  const sans = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  let profondeur = 0;
  let tampon = "";
  const blocs: string[] = [];
  for (const c of sans) {
    if (c === "{") {
      const t = tampon.trim();
      blocs.push(t);
      if (!t.startsWith("@")) out.push(t);
      profondeur++;
      tampon = "";
    } else if (c === "}") {
      profondeur--;
      blocs.pop();
      tampon = "";
    } else tampon += c;
  }
  return out.flatMap((s) => s.split(",").map((x) => x.trim()));
}

describe("feuilles de style : toute règle est bornée à [data-gabarit]", () => {
  it.each(FEUILLES)("%s", (f) => {
    for (const sel of selecteurs(lire(f))) {
      expect(sel, `${f} : ${sel}`).toMatch(/^(html:has\(\[data-gabarit\]\)|\[data-gabarit)/);
    }
  });

  it("la feuille commune porte les règles globales bornées (scroll-padding, color-scheme, focus)", () => {
    const base = lire("src/styles/article-v2/base.css");
    expect(base).toContain("html:has([data-gabarit])");
    expect(base).toContain("scroll-padding-top");
    expect(base).toContain("color-scheme: light");
    expect(base).toContain("--focus-ring");
    expect(base).toContain("forced-colors: active");
  });

  it("globals.css : un seul ajout (jetons fluides + neuf @import), rien d'autre", () => {
    const css = lire("src/app/globals.css");
    const imports = [...css.matchAll(/@import "\.\.\/styles\/article-v2\/([a-z]+)\.css";/g)].map(
      (m) => m[1],
    );
    expect(imports.sort()).toEqual(["base", ...GABARITS_ARTICLE].sort());
    for (const jeton of ["h1", "chapo", "h2", "h3", "corps", "espace-h2"]) {
      expect(css).toContain(`--article-${jeton}:`);
    }
    // Les @import viennent avant toute autre règle (hors @import tailwindcss).
    const premiereRegle = css.search(/@source|@theme|@font-face|@layer/);
    const dernierImport = css.lastIndexOf('@import "../styles/article-v2/');
    expect(dernierImport).toBeLessThan(premiereRegle);
  });
});

type Json = Record<string, unknown>;
function aplatir(o: Json, prefixe = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? aplatir(v as Json, `${prefixe}${k}.`)
      : [`${prefixe}${k}`],
  );
}

describe("messages des gabarits", () => {
  it("un couple fr/en par code, mêmes clés", () => {
    expect(CODES_MESSAGES_GABARITS).toEqual(["commun", ...GABARITS_ARTICLE]);
    for (const code of CODES_MESSAGES_GABARITS) {
      const fr = JSON.parse(lire(`src/messages/gabarits/${code}.fr.json`)) as Json;
      const en = JSON.parse(lire(`src/messages/gabarits/${code}.en.json`)) as Json;
      expect(aplatir(en).sort(), code).toEqual(aplatir(fr).sort());
    }
  });

  it("le chargeur fusionne tous les fichiers sous articleGabarits, par langue", async () => {
    for (const langue of ["fr", "en"]) {
      const m = (await chargerMessagesGabarits(langue)) as { articleGabarits: Json };
      expect(Object.keys(m.articleGabarits).sort()).toEqual([...CODES_MESSAGES_GABARITS].sort());
    }
    const fr = (await chargerMessagesGabarits("fr")) as { articleGabarits: { commun: Json } };
    const en = (await chargerMessagesGabarits("en")) as { articleGabarits: { commun: Json } };
    expect(fr.articleGabarits.commun.reponseDirecte).toBe("Réponse directe");
    expect(en.articleGabarits.commun.reponseDirecte).toBe("Direct answer");
  });

  it("chaque clé littérale utilisée par les composants existe en FR et en EN", () => {
    const resolveur = (msgs: Json, chemin: string) =>
      chemin.split(".").reduce<unknown>((n, k) => (n as Json | undefined)?.[k], msgs);
    for (const langue of ["fr", "en"] as const) {
      const base = JSON.parse(lire(`src/messages/${langue}.json`)) as Json;
      const gabarits: Json = {};
      for (const code of CODES_MESSAGES_GABARITS) {
        gabarits[code] = JSON.parse(lire(`src/messages/gabarits/${code}.${langue}.json`));
      }
      const tous: Json = { ...base, articleGabarits: gabarits };
      for (const f of SOURCES.filter((x) => x.endsWith(".tsx"))) {
        const src = lire(f);
        const ns = [...src.matchAll(/useTranslations\("([^"]+)"\)/g)].map((m) => m[1]!);
        if (ns.length === 0) continue; // espace de noms dynamique (CtaGabarit) : contrôlé plus bas
        // Premier espace de noms ; articleV2 (S1) est le second de GabaritAnalyse : on teste les deux.
        for (const m of src.matchAll(/\b(?:t|c)(?:\.rich)?\("([^"$]+)"/g)) {
          const cle = m[1]!;
          const trouve = ns.some((n) => resolveur(tous, `${n}.${cle}`) !== undefined);
          expect(trouve, `${f} : « ${cle} » (${langue})`).toBe(true);
        }
      }
      for (const code of GABARITS_ARTICLE) {
        expect(resolveur(tous, `articleGabarits.commun.surtitre.${code}`)).toBeTruthy();
      }
      for (const v of ["audit", "journeeIa", "rdv"]) {
        for (const k of ["titre", "description", "bouton"]) {
          expect(resolveur(tous, `articleGabarits.commun.cta.${v}.${k}`)).toBeTruthy();
        }
      }
    }
  });
});
