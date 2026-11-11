/**
 * R7 — les canaux MACHINE ne servent aucun montant, sauf la Journée IA (1 490 € HT).
 *
 * Ordre de Williams du 08/11/2026 : « il ne faut plus de prix affichés pour les
 * formations, les audits ou autres. La seule chose à mettre en avant est la journée
 * audit à 1490 €. » Les moteurs de réponse lisent ces canaux AVANT les pages : un
 * montant oublié dans un `llms.txt` ou un `Offer` JSON-LD est relu, cité et recopié.
 *
 * Deux familles sont gardées ici :
 *   1. le TEXTE servi aux robots (llms.txt, llms-full.txt, flux FAQ, markdown) : aucun
 *      montant en euros autre que 1 490 ;
 *   2. les DONNÉES STRUCTURÉES émises par les générateurs (seo.ts, extended-schemas,
 *      ville-service-jsonld, service-binding) : parcours récursif, aucun champ de prix
 *      (`price`, `lowPrice`, `highPrice`, `minPrice`, `maxPrice`, `estimatedCost`) autre
 *      que 1 490, aucun `priceRange` chiffré, aucun montant dans une chaîne.
 *
 * La valeur 0 (« gratuit » : guide PDF, calculateur) n'est pas un prix : elle reste admise.
 */

import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync, type Dirent } from "node:fs";
import path from "node:path";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    articleTranslation: { findFirst: async () => null },
    caseStudyTranslation: { findFirst: async () => null },
    helpArticleTranslation: { findFirst: async () => null },
    fAQ: { findFirst: async () => null, findMany: async () => [] },
    knowledgeEntry: { findMany: async () => [] },
  },
}));

import { GET as getLlms } from "./llms.txt/route";
import { GET as getLlmsFull } from "./llms-full.txt/route";
import { GET as getFaqFeed } from "./[locale]/faq/feed.xml/route";
import { GET as getMarkdown } from "./api/markdown/[type]/[slug]/route";
import {
  buildCourseJsonLd,
  buildHowToJsonLd,
  buildServiceJsonLd,
  buildLocalBusinessJsonLd,
} from "@/lib/seo";
import { buildSoftwareApplicationJsonLd } from "@/lib/seo/extended-schemas";
import { buildVilleServiceJsonLdGraph } from "@/lib/seo/ville-service-jsonld";
import { buildServiceOfferJsonLd, getServiceCta } from "@/lib/knowledge/service-binding";
import { listGlossaryTermSlugs } from "@/content/glossary-extension";
import { getAllSlugs as getAllCaseSlugs } from "@/content/case-studies";
import { FAQ_GLOBAL, HELP_ARTICLES } from "@/content/transversal";
import { JOURNEE_IA_TIER, prixAffichable } from "@/content/pricing";

// ─── Détecteurs ─────────────────────────────────────────────────────────────

const ESPACE = "[\\s\\u00a0\\u202f]";
/** Un montant écrit avec son unité : « 1 900 € », « 1,9 k€ », « 990 euros », « € 490 », « 1490 EUR ». */
const MONTANT = new RegExp(
  `\\d[\\d${ESPACE.slice(1, -1)}.,]*${ESPACE}?(?:[kKM]?€|EUR\\b|euros?\\b)|€${ESPACE}?\\d[\\d.,]*|\\bEUR${ESPACE}?\\d(?:[\\d.,]|${ESPACE}(?=\\d))*`,
  "gi",
);

/** Un ordre de grandeur en toutes lettres : « quelques centaines d'euros », « a few thousand euros ». */
const ORDRE_DE_GRANDEUR = /(?:centaines|milliers)\s+d['’]euros|(?:hundred|thousand)\s+euros/gi;

/** Montants en euros présents dans un texte, hors 1 490 (Journée IA). */
function montantsInterdits(texte: string): string[] {
  const chiffres = (texte.match(MONTANT) ?? []).filter((m) => {
    const n = m
      .replace(/[^\d.,]/g, "")
      .replace(/[.,]\d{1,2}$/, "")
      .replace(/[.,]/g, "");
    return n !== "1490";
  });
  return [...chiffres, ...(texte.match(ORDRE_DE_GRANDEUR) ?? [])];
}

const CHAMPS_PRIX = new Set(["price", "lowPrice", "highPrice", "minPrice", "maxPrice"]);

/** Parcours récursif d'un JSON-LD : retourne chaque violation sous forme de chemin lisible. */
function violationsJsonLd(noeud: unknown, chemin = "$"): string[] {
  if (Array.isArray(noeud)) return noeud.flatMap((n, i) => violationsJsonLd(n, `${chemin}[${i}]`));
  if (typeof noeud === "string") {
    return montantsInterdits(noeud).map((m) => `${chemin} : montant « ${m} » dans le texte`);
  }
  if (noeud === null || typeof noeud !== "object") return [];
  const out: string[] = [];
  for (const [cle, valeur] of Object.entries(noeud as Record<string, unknown>)) {
    const ici = `${chemin}.${cle}`;
    if (CHAMPS_PRIX.has(cle)) {
      const n = Number(valeur);
      if (n !== 1490 && n !== 0) out.push(`${ici} = ${String(valeur)}`);
      continue;
    }
    if (cle === "estimatedCost") {
      out.push(`${ici} = ${JSON.stringify(valeur)}`);
      continue;
    }
    if (cle === "priceRange" && /\d/.test(String(valeur))) {
      out.push(`${ici} = ${String(valeur)} (fourchette chiffrée)`);
      continue;
    }
    out.push(...violationsJsonLd(valeur, ici));
  }
  return out;
}

describe("garde R7 — les détecteurs voient ce qu'ils doivent voir (anti-test-vide)", () => {
  it("le détecteur de texte repère les formes courantes et épargne 1 490", () => {
    expect(montantsInterdits("dès 1 900 € HT, ou 990 euros, ou 2,5 k€, ou 490 EUR")).toHaveLength(
      4,
    );
    expect(montantsInterdits("La Journée IA : 1 490 € HT, 1490 €, 1 490 €")).toEqual([]);
    expect(montantsInterdits("from a few hundred euros to several thousand euros")).toHaveLength(2);
    expect(montantsInterdits("EUR 1 900, puis 1 M€, puis 1 900 € HT")).toHaveLength(3);
    expect(montantsInterdits("EUR 1 490")).toEqual([]);
  });

  it("le parcours JSON-LD repère un prix imbriqué et épargne 1 490 et 0", () => {
    const faute = { offers: [{ price: "1900" }, { priceSpecification: { minPrice: 490 } }] };
    expect(violationsJsonLd(faute)).toHaveLength(2);
    expect(violationsJsonLd({ offers: { price: "1490" }, autre: { price: "0" } })).toEqual([]);
    expect(violationsJsonLd({ priceRange: "€20-€200" })).toHaveLength(1);
    expect(violationsJsonLd({ priceRange: "€€" })).toEqual([]);
  });
});

// ─── 1. Texte servi aux robots ───────────────────────────────────────────────

/**
 * Montants qui ne sont PAS des prix d'Axion-IA, admis nommément (ressource → montants exacts) :
 * tarifs publics d'API ou de matériel de TIERS cités par le glossaire, un exemple de commande
 * vocale, un seuil de validation dans un cas client. Tout autre montant fait rougir.
 */
const EXEMPTIONS: Record<string, readonly string[]> = {
  // Exemption « cas-concrets/industrie-comptabilite : 5000 € » RETIRÉE (PR 1871) : les cas concrets
  // sont éteints (CAS_CONCRETS_AFFICHES = false, retrait juridique du 2026-11-08) ; /api/markdown
  // répond 404, donc plus aucun corps ne peut servir ce montant. Si les cas reviennent, la
  // ré-ajouter (seuil de validation des factures du client).
  "glossaire/fine-tuning": ["50 k€"], // coût marché d'un fine-tuning
  "glossaire/vectorisation": ["5 €"], // coût d'API d'embeddings (tiers)
  "glossaire/tokens": ["0,75 €"], // coût d'API au million de jetons (tiers)
  "glossaire/function-calling": ["200 €"], // exemple : « envoie 200 € à Marie »
  "glossaire/sonnet-model": ["3 €"], // tarif d'API Anthropic
  "glossaire/opus-model": ["15 €"], // tarif d'API Anthropic
  "glossaire/haiku-model": ["0,25 €", "5 €"], // tarif d'API Anthropic
  "glossaire/on-premise-ai": ["50 K€"], // coût de 2 GPU H100 par an
};

async function markdown(type: string, slug: string): Promise<string> {
  const res = await getMarkdown(
    new Request(`https://axion-ia.com/api/markdown/${type}/${slug}`) as never,
    { params: Promise.resolve({ type, slug }) },
  );
  return res.text();
}

describe("garde R7 — texte des canaux machine", () => {
  it("llms.txt ne sert aucun montant hors Journée IA", async () => {
    const corps = await (await getLlms()).text();
    expect(montantsInterdits(corps)).toEqual([]);
  });

  it("llms-full.txt ne sert aucun montant hors Journée IA", async () => {
    const corps = await (await getLlmsFull()).text();
    expect(montantsInterdits(corps)).toEqual([]);
    // La Journée IA, elle, est nommée avec son prix.
    expect(corps).toContain("/fr/journee-ia");
    expect(corps).toMatch(/1[\s  ]?490[\s  ]?€/);
    expect(corps).not.toContain("\u0000");
  });

  it("le flux FAQ (fr et en) ne sert aucun montant hors Journée IA", async () => {
    for (const locale of ["fr", "en"]) {
      const res = await getFaqFeed(new Request(`https://axion-ia.com/${locale}/faq/feed.xml`), {
        params: Promise.resolve({ locale }),
      });
      expect(montantsInterdits(await res.text()), `flux ${locale}`).toEqual([]);
    }
  });

  it("le markdown des ressources adossées à un fichier ne sert aucun montant", async () => {
    const cibles: Array<[string, string]> = [
      ...FAQ_GLOBAL.map((f): [string, string] => ["faq", f.id]),
      ...getAllCaseSlugs().map((s): [string, string] => ["cas-concrets", s]),
      ...HELP_ARTICLES.map((a): [string, string] => ["centre-aide", a.slug]),
      ...listGlossaryTermSlugs().map((s): [string, string] => ["glossaire", s]),
    ];
    expect(cibles.length).toBeGreaterThan(20);
    const fautes: string[] = [];
    const exemptionsVues = new Set<string>();
    for (const [type, slug] of cibles) {
      const admis = EXEMPTIONS[`${type}/${slug}`] ?? [];
      for (const m of montantsInterdits(await markdown(type, slug))) {
        if (admis.includes(m)) exemptionsVues.add(`${type}/${slug} : ${m}`);
        else fautes.push(`${type}/${slug} : ${m}`);
      }
    }
    expect(fautes).toEqual([]);
    // Une exemption qui ne correspond plus à rien doit être retirée de la liste.
    const attendues = Object.entries(EXEMPTIONS).flatMap(([cle, ms]) =>
      ms.map((m) => `${cle} : ${m}`),
    );
    expect([...exemptionsVues].sort()).toEqual(attendues.sort());
  });
});

// ─── 2. Données structurées ──────────────────────────────────────────────────

describe("garde R7 — générateurs JSON-LD", () => {
  it("buildServiceJsonLd n'émet aucun prix pour un service ordinaire", () => {
    const ld = buildServiceJsonLd({
      locale: "fr",
      path: "/audit",
      name: "Audit IA",
      description: "Audit IA en entreprise.",
      priceEur: 1900,
    });
    expect(violationsJsonLd(ld)).toEqual([]);
  });

  it("buildServiceJsonLd garde l'Offer de la Journée IA (1 490 €, EUR)", () => {
    const ld = buildServiceJsonLd({
      locale: "fr",
      path: "/journee-ia",
      name: "La Journée IA",
      description: "Une journée dans votre entreprise.",
      priceEur: JOURNEE_IA_TIER.priceFlat!,
      prixPublic: prixAffichable(JOURNEE_IA_TIER),
    }) as Record<string, unknown>;
    expect(ld.offers).toMatchObject({ "@type": "Offer", price: "1490", priceCurrency: "EUR" });
  });

  it("buildCourseJsonLd n'émet aucun prix", () => {
    const ld = buildCourseJsonLd({
      locale: "fr",
      path: "/formations/ia-generative",
      name: "Formation IA générative",
      description: "Formation.",
      priceEurHt: 1200,
    } as Parameters<typeof buildCourseJsonLd>[0]);
    expect(violationsJsonLd(ld)).toEqual([]);
  });

  it("buildHowToJsonLd n'émet aucun coût estimé chiffré", () => {
    const ld = buildHowToJsonLd({
      locale: "fr",
      path: "/methodologie",
      name: "Méthode",
      description: "Méthode.",
      estimatedCost: { currency: "EUR", value: "1900" },
      steps: [
        { name: "a", text: "a" },
        { name: "b", text: "b" },
        { name: "c", text: "c" },
      ],
    } as Parameters<typeof buildHowToJsonLd>[0]);
    expect(violationsJsonLd(ld)).toEqual([]);
  });

  it("buildLocalBusinessJsonLd ne relaie aucune fourchette chiffrée", () => {
    const ld = buildLocalBusinessJsonLd({
      locale: "fr",
      path: "/implantations/ile-de-france",
      name: "Axion-IA",
      description: "Axion-IA.",
      areaServed: { type: "AdministrativeArea", name: "Île-de-France" },
      priceRange: "490 € - 9 900 €",
    });
    expect(violationsJsonLd(ld)).toEqual([]);
  });

  it("buildSoftwareApplicationJsonLd n'émet que la gratuité", () => {
    const payant = buildSoftwareApplicationJsonLd({
      name: "Outil",
      description: "Outil.",
      url: "https://axion-ia.com/fr/roi",
      applicationCategory: "BusinessApplication",
      price: "490",
    });
    expect(violationsJsonLd(payant)).toEqual([]);
    const gratuit = buildSoftwareApplicationJsonLd({
      name: "Outil",
      description: "Outil.",
      url: "https://axion-ia.com/fr/roi",
      applicationCategory: "BusinessApplication",
      price: "0",
    }) as Record<string, unknown>;
    expect(gratuit.offers).toMatchObject({ price: "0" });
  });

  it("buildVilleServiceJsonLdGraph (Lyon × audit) n'émet aucun prix", () => {
    const graphe = buildVilleServiceJsonLdGraph({
      locale: "fr",
      isFr: true,
      service: "audit",
      serviceNameFr: "Audit IA",
      serviceNameEn: "AI audit",
      serviceCanonical: "/audit",
      servicePathFr: "/audit/par-ville",
      ville: { slug: "lyon", nameFr: "Lyon", region: "auvergne-rhone-alpes" },
      region: { slug: "auvergne-rhone-alpes", nameFr: "Auvergne-Rhône-Alpes" },
      hero: "Audit IA à Lyon.",
      directAnswer: "Audit IA à Lyon.",
      faqItems: [],
      methodologySteps: [
        { step: "a", detail: "a" },
        { step: "b", detail: "b" },
        { step: "c", detail: "c" },
      ],
      nearbyVilles: [],
      priceEur: 1900,
    } as unknown as Parameters<typeof buildVilleServiceJsonLdGraph>[0]);
    expect(graphe.length).toBeGreaterThan(2);
    expect(violationsJsonLd(graphe)).toEqual([]);
  });

  it("service-binding : aucune Offer chiffrée, aucun « dès X € » dans le CTA", () => {
    for (const slug of [
      "audit",
      "interventions-formations",
      "implementation",
      "un-a-un",
    ] as const) {
      const offre = buildServiceOfferJsonLd(slug as never);
      expect(violationsJsonLd(offre), slug).toEqual([]);
      expect(getServiceCta(slug as never)?.fromLabelFr ?? null, slug).toBeNull();
    }
  });
});

// ─── 3. JSON-LD inline des pages (lecture du source) ─────────────────────────

/**
 * Un champ de prix écrit à la main dans un objet : `AggregateOffer`, `lowPrice:`,
 * `highPrice:`, `price:` (sauf la gratuité `price: "0"` et les jetons `{{price:…}}`).
 *
 * ⚠️ `formatAmount(` n'est PAS cherché ici : dans une page, il sert surtout le rendu
 * VISIBLE, que traite le lot `fix/prix-pages-offres`. Les FAQPage JSON-LD tirées de ces
 * chaînes visibles (a-propos l.199/274, formations/page.tsx l.1430,
 * formations/entreprise l.440 via FaqAccordion) relèvent de ce lot et ne sont pas lues ici.
 */
const CHAMP_PRIX_SOURCE = /"AggregateOffer"|\blowPrice:|\bhighPrice:|(?<!\{\{)\bprice:(?!\s*"0")/;

/**
 * Fichiers où `price:` n'appartient PAS à un JSON-LD (propriété d'une carte visible) :
 * hors de ce lot, rendu traité par `fix/prix-pages-offres`.
 */
const HORS_JSON_LD: ReadonlySet<string> = new Set([
  "[locale]/page.tsx", // accueil : `price:` des 5 lignes de la grille visible des services
]);

/**
 * Parcours tolérant de l'arbre : d'autres suites (ex. `route-admin-sans-entree-de-menu`)
 * créent puis retirent un dossier témoin sous `src/app` PENDANT que cette garde lit.
 * Un dossier ou un fichier disparu entre la liste et la lecture est ignoré (ENOENT).
 */
function listerSources(racine: string, sous = ""): string[] {
  let entrees: Dirent[];
  try {
    entrees = readdirSync(path.join(racine, sous), { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const out: string[] = [];
  for (const d of entrees) {
    const rel = sous ? path.join(sous, d.name) : d.name;
    if (d.isDirectory()) out.push(...listerSources(racine, rel));
    else out.push(rel);
  }
  return out;
}

function lireSiPresent(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

describe("garde R7 — JSON-LD inline des pages", () => {
  it("toute page qui écrit un champ de prix dans un JSON-LD le conditionne à l'interrupteur", () => {
    const racines = ["src/app", "src/components"].map((r) => path.resolve(process.cwd(), r));
    const fautes: string[] = [];
    let lus = 0;
    for (const racine of racines) {
      for (const rel of listerSources(racine)) {
        if (!/\.tsx?$/.test(rel) || /\.(spec|test)\.tsx?$/.test(rel)) continue;
        if (rel.includes("(admin)") || rel.includes("tour-france-ia")) continue;
        if (HORS_JSON_LD.has(rel)) continue;
        const source = lireSiPresent(path.join(racine, rel));
        if (source === null) continue;
        lus++;
        if (!source.includes('"@type"')) continue; // pas de JSON-LD dans ce fichier
        const lignes = source
          .split("\n")
          .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && CHAMP_PRIX_SOURCE.test(l));
        if (lignes.length === 0) continue;
        if (!/PRIX_PUBLICS_AFFICHES|prixAffichable\(/.test(source)) fautes.push(rel);
      }
    }
    expect(lus).toBeGreaterThan(100);
    expect(fautes).toEqual([]);
  });

  it("le motif de source repère un prix et épargne la gratuité et les jetons", () => {
    expect(CHAMP_PRIX_SOURCE.test("        price: auditFlashPrice,")).toBe(true);
    expect(CHAMP_PRIX_SOURCE.test("    lowPrice: 490,")).toBe(true);
    expect(CHAMP_PRIX_SOURCE.test('      price: "0",')).toBe(false);
    expect(CHAMP_PRIX_SOURCE.test("`{{price:audit-flash|flat}}`")).toBe(false);
  });
});
