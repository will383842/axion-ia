// 🔴 2026-10-08 (décision de Will) — les anciennes formules « Essentielle » 2 450 €,
// « Gagner du temps » 2 450 €, « Approfondie » 3 250 € et « Intervention Claude » 2 650 €
// étaient des PRIX ERRONÉS. Le seul prix de formation est celui de FORMATION_PRICE_MATRIX
// (pages /fr/formations). Cette garde verrouille quatre choses :
//   1. le registre des prix (d'où dérivent TOUS les JSON-LD : Offer.price, HowTo, AggregateOffer)
//      ne porte plus aucun de ces montants, et chaque prix de formation vient de la matrice ;
//   2. les SORTIES RÉELLES des surfaces lues par les moteurs (/llms-full.txt, /faq/feed.xml,
//      /api/markdown/faq/*) n'en contiennent aucun ;
//   3. un ancien jeton déjà stocké en base ({{price:intervention-essentielle}}) se résout vers
//      le prix de la matrice, jamais vers l'ancien ;
//   4. aucun fichier source affiché au public ne réécrit ces montants ou ces noms en dur.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

// Le client Prisma du BUILD (stub) : les routes lisent alors le corpus éditorial seul, comme au
// SSG. Contrat « stub.invalid » de l'AGENTS.md — ne pas changer la chaîne.
process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
process.env.REDIS_URL = "redis://stub.invalid:6379";
process.env.SKIP_ENV_VALIDATION = "true";

const MONTANTS = [2450, 2650, 3250];
/** « 2 450 € », « 2450 € », avec espace fine ou insécable. */
const MONTANT_TEXTE = /\b(?:2[\s  ]?450|2[\s  ]?650|3[\s  ]?250)[\s  ]?(?:€|EUR|euros?)/;
const NOMS = /\b(?:Essentielle|Approfondie|Intervention Claude)\b/;

function sansMontantErrone(nom: string, texte: string): void {
  const m = MONTANT_TEXTE.exec(texte);
  const extrait = m ? texte.slice(Math.max(0, m.index - 60), m.index + 20) : null;
  expect(extrait ? `${nom} : « …${extrait}… »` : null).toBeNull();
}

describe("1. le registre des prix — source de tous les JSON-LD", () => {
  it("aucun palier ni sous-palier ne vaut 2 450, 2 650 ou 3 250 €", async () => {
    const { PRICE_TOKEN_REGISTRY } = await import("@/content/pricing-tokens");
    const fautes: string[] = [];
    for (const [id, e] of PRICE_TOKEN_REGISTRY) {
      const prix =
        e.kind === "subTier"
          ? [e.subTier.priceFlat]
          : [e.tier.priceFlat, e.tier.priceMin, e.tier.priceMax];
      for (const p of prix)
        if (typeof p === "number" && MONTANTS.includes(p)) fautes.push(`${id}=${p}`);
    }
    expect(fautes).toEqual([]);
  });

  it("chaque palier de formation (1 et 2 jours) porte le prix de la matrice", async () => {
    const { INTERVENTION_TIERS, FORMATION_PRICE_MATRIX } = await import("@/content/pricing");
    const formations = INTERVENTION_TIERS.filter((t) => t.id.startsWith("formation-"));
    expect(formations.map((t) => t.id).sort()).toEqual(
      [
        "formation-generale-1j",
        "formation-generale-2j",
        "formation-metier-1j",
        "formation-metier-2j",
        "formation-secteur-1j",
        "formation-secteur-2j",
      ].sort(),
    );
    for (const t of formations) {
      const m = /^formation-(generale|metier|secteur)-(1j|2j)$/.exec(t.id)!;
      const cat = m[1] as "generale" | "metier" | "secteur";
      const duree = m[2] as "1j" | "2j";
      expect(t.priceFlat, t.id).toBe(FORMATION_PRICE_MATRIX[cat][duree]);
    }
    const quatreH = INTERVENTION_TIERS.find((t) => t.id === "intervention-4h");
    expect(quatreH?.priceFlat).toBe(FORMATION_PRICE_MATRIX.generale["4h"]);
  });

  it("le prix d'entrée des formations (home, implantations, connaissances) vient de la matrice", async () => {
    const { INTERVENTION_TIERS, FORMATION_PRICE_MATRIX, getEntryPriceEur } =
      await import("@/content/pricing");
    expect(getEntryPriceEur(INTERVENTION_TIERS)).toBe(FORMATION_PRICE_MATRIX.generale["4h"]);
  });
});

describe("2. les surfaces lues par les moteurs de réponse", () => {
  let faqSlugs: string[] = [];
  beforeAll(async () => {
    const { FAQ_GLOBAL } = await import("@/content/transversal");
    faqSlugs = FAQ_GLOBAL.map((f) => f.id);
  });

  it("/llms-full.txt", async () => {
    const { GET } = await import("@/app/llms-full.txt/route");
    const texte = await GET().text();
    expect(texte.length).toBeGreaterThan(1000);
    sansMontantErrone("/llms-full.txt", texte);
    expect(NOMS.exec(texte)?.[0] ?? null).toBeNull();
  });

  it("/fr/faq/feed.xml", async () => {
    const { GET } = await import("@/app/[locale]/faq/feed.xml/route");
    const r = await GET(new Request("https://axion-ia.com/fr/faq/feed.xml"), {
      params: Promise.resolve({ locale: "fr" }),
    });
    const texte = await r.text();
    expect(texte).toContain("<item>");
    sansMontantErrone("feed.xml", texte);
  });

  it("/api/markdown/faq/* — toutes les fiches FAQ éditoriales", async () => {
    const { GET } = await import("@/app/api/markdown/[type]/[slug]/route");
    let lues = 0;
    for (const slug of faqSlugs) {
      const r = await GET({} as never, { params: Promise.resolve({ type: "faq", slug }) } as never);
      if (r.status !== 200) continue;
      lues++;
      sansMontantErrone(`/api/markdown/faq/${slug}`, await r.text());
    }
    expect(lues).toBeGreaterThan(10);
  }, 60_000);
});

describe("3. les anciens jetons déjà stockés en base", () => {
  it.each([
    ["intervention-essentielle", "1j"],
    ["intervention-temps", "1j"],
    ["intervention-claude", "1j"],
    ["intervention-approfondie", "2j"],
  ] as const)("{{price:%s}} → le prix de la matrice", async (ancien, duree) => {
    const { resolvePriceTokens } = await import("@/content/pricing-tokens");
    const { FORMATION_PRICE_MATRIX, formatAmount } = await import("@/content/pricing");
    const rendu = resolvePriceTokens(`Prix : {{price:${ancien}|flat}}.`, "fr");
    expect(rendu).not.toContain("{{price:");
    expect(rendu).toContain(formatAmount(FORMATION_PRICE_MATRIX.generale[duree]!, "fr"));
    sansMontantErrone(ancien, rendu);
  });
});

describe("4. aucun montant ni nom erroné réécrit en dur dans le code affiché", () => {
  const RACINE = join(__dirname, "..", "..", "..");
  const DOSSIERS = ["src/app", "src/components", "src/content", "src/lib", "src/server"];
  /**
   * Fichiers qui ont le DROIT de citer les anciens identifiants : la table de correspondance et
   * les redirections d'URL (les slugs survivent pour les 301), jamais du texte affiché.
   */
  const PERMIS = new Set([
    "src/content/pricing.ts",
    "src/lib/intervention-type.ts",
    "src/lib/legacy-redirects.ts",
    "src/lib/i18n/en-to-fr-redirect.ts",
  ]);
  function fichiers(dir: string): string[] {
    const out: string[] = [];
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) {
        if (n === "__tests__" || n === "node_modules") continue;
        out.push(...fichiers(p));
      } else if (/\.(ts|tsx)$/.test(n) && !/\.(test|spec)\.tsx?$/.test(n)) out.push(p);
    }
    return out;
  }
  /** Le code SANS ses commentaires (ils racontent l'histoire, ils ne s'affichent pas). */
  const sansCommentaires = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

  it("ni « 2 450 € », « 2 650 € », « 3 250 € », ni « Essentielle / Approfondie / Intervention Claude »", () => {
    const fautes: string[] = [];
    for (const d of DOSSIERS) {
      for (const f of fichiers(join(RACINE, d))) {
        const rel = relative(RACINE, f).split(sep).join("/");
        if (PERMIS.has(rel)) continue;
        const code = sansCommentaires(readFileSync(f, "utf8"));
        const m = MONTANT_TEXTE.exec(code) ?? NOMS.exec(code);
        if (m) fautes.push(`${rel} : « ${m[0]} »`);
        if (/\{\{price:intervention-(?:essentielle|temps|approfondie|claude)\b/.test(code))
          fautes.push(`${rel} : ancien jeton de prix`);
      }
    }
    expect(fautes).toEqual([]);
  });
});
