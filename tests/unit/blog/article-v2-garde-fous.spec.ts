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
    // socle + compléments + une feuille par gabarit (8) + actualité + guide pilier (vides)
    expect(FEUILLES).toHaveLength(12);
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
  let tampon = "";
  const blocs: string[] = [];
  for (const c of sans) {
    if (c === "{") {
      const t = tampon.trim();
      blocs.push(t);
      const dansKeyframes = blocs.slice(0, -1).some((b) => b.startsWith("@keyframes"));
      if (!t.startsWith("@") && !dansKeyframes) out.push(t);
      tampon = "";
    } else if (c === "}") {
      blocs.pop();
      tampon = "";
    } else tampon += c;
  }
  // Découpe aux virgules de premier niveau seulement (pas celles de :is(), :where(), :not()).
  const decoupe = (sel: string): string[] => {
    const parts: string[] = [];
    let prof = 0;
    let cur = "";
    for (const c of sel) {
      if (c === "(") prof++;
      if (c === ")") prof--;
      if (c === "," && prof === 0) {
        parts.push(cur.trim());
        cur = "";
      } else cur += c;
    }
    parts.push(cur.trim());
    return parts;
  };
  return out.flatMap(decoupe);
}

describe("feuilles de style : toute règle est bornée à [data-gabarit]", () => {
  it.each(FEUILLES)("%s", (f) => {
    for (const sel of selecteurs(lire(f))) {
      expect(sel, `${f} : ${sel}`).toMatch(/^((html|body):has\(\[data-gabarit\]\)|\[data-gabarit)/);
    }
  });

  it("le socle porte les règles globales bornées (scroll-padding, color-scheme, focus)", () => {
    const socle = lire("src/styles/article-v2/socle.css");
    expect(socle).toContain("html:has([data-gabarit])");
    expect(socle).toContain("scroll-padding-top");
    expect(socle).toContain("forced-colors: active");
    expect(socle).toContain("--focus-sombre");
    expect(socle).toContain(".sur-terracotta");
  });

  it("globals.css n'importe AUCUNE feuille d'article (PLAN §15.7) et n'a reçu aucun jeton", () => {
    const css = lire("src/app/globals.css");
    expect(css).not.toContain("article-v2");
    expect(css).not.toContain("--article-");
  });

  it("la feuille du socle est importée par l'aiguillage, et par lui seul", () => {
    expect(lire("src/components/article-v2/ArticleGabarit.tsx")).toContain(
      '"@/styles/article-v2/socle.css"',
    );
    for (const f of fichiers("src/app", /\.(css|tsx?)$/)) {
      expect(lire(f), f).not.toContain("styles/article-v2/socle.css");
    }
  });

  it("le socle ne reproduit ni l'en-tête du site ni les vestiges de maquette", () => {
    const socle = lire("src/styles/article-v2/socle.css");
    for (const interdit of [
      ".site-entete",
      ".site-nav",
      ".site-logo",
      ".bandeau-maquette",
      ".pied-site",
      "@font-face",
      ".v-anneau",
    ]) {
      expect(socle, interdit).not.toContain(interdit);
    }
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
    expect(fr.articleGabarits.commun.reponseDirecte).toBe("En bref");
    expect(en.articleGabarits.commun.reponseDirecte).toBe("In brief");
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
        if (ns.length === 0) continue; // espace de noms dynamique : contrôlé plus bas
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
    }
  });
});

describe("textes des gabarits : mots interdits et typographie", () => {
  const INTERDITS =
    /grenoble|prix|frais de déplacement|témoignage|avocat|réserv|€|\d\s?(euros?|eur)\b/i;
  const textes = (o: unknown): string[] =>
    typeof o === "string"
      ? [o]
      : Array.isArray(o)
        ? o.flatMap(textes)
        : o && typeof o === "object"
          ? Object.values(o).flatMap(textes)
          : [];
  it.each(["fr", "en"])("aucun mot interdit dans les messages (%s)", (langue) => {
    for (const code of CODES_MESSAGES_GABARITS) {
      const d = JSON.parse(lire(`src/messages/gabarits/${code}.${langue}.json`));
      for (const t of textes(d)) expect(t, `${code}.${langue}`).not.toMatch(INTERDITS);
    }
  });
  it("l'apostrophe est typographique (’) et l'espace avant « ? » est insécable en français", () => {
    for (const code of CODES_MESSAGES_GABARITS) {
      const d = JSON.parse(lire(`src/messages/gabarits/${code}.fr.json`));
      for (const t of textes(d)) {
        expect(t, t).not.toContain("'");
        expect(t, t).not.toMatch(/ [?!;:]/);
      }
    }
  });
});

describe("photos de repli", () => {
  it("chaque photo existe en .webp ET en .avif, sans infographie ni chiffre-vedette", async () => {
    const { PHOTOS_REPLI } = await import("@/lib/blog/photos-repli");
    expect(Object.keys(PHOTOS_REPLI).sort()).toEqual([...GABARITS_ARTICLE].sort());
    for (const { src, alt } of Object.values(PHOTOS_REPLI)) {
      expect(src).toMatch(/^\/images\/axion-ia-[a-z0-9-]+\.webp$/);
      expect(fs.existsSync(path.join(RACINE, "public", src))).toBe(true);
      expect(fs.existsSync(path.join(RACINE, "public", src.replace(/\.webp$/, ".avif")))).toBe(
        true,
      );
      expect(src).not.toMatch(/infographie|pourcent|-\d+-/);
      expect(alt).toBe(""); // décor : jamais une description inventée
    }
  });
});

describe("en-tête du site intact", () => {
  it("aucun fichier de src/components/nav/ modifié, sauf Breadcrumbs.tsx", async () => {
    const { execSync } = await import("node:child_process");
    let diff = "";
    try {
      diff = execSync("git diff --name-only origin/main...HEAD -- src/components/nav/", {
        encoding: "utf-8",
      });
    } catch {
      return; // pas de référence git (clone superficiel) : contrôlé par la revue
    }
    const touches = diff.split("\n").filter(Boolean);
    expect(touches.filter((f) => !f.endsWith("Breadcrumbs.tsx"))).toEqual([]);
  });
});
