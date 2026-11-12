// R7 — ce que l'IA DIT au public : chatbot, base de connaissance, prompts de génération.
//
// Ordre de Williams du 08/11/2026 : plus aucun montant au public, sauf la Journée IA
// (1 490 € HT). Pour toute autre offre, le chatbot et les contenus générés disent « sur
// devis, parlons-en lors du rendez-vous gratuit de 45 minutes ».
//
// La garde centrale (`src/content/__tests__/prix-publics-masques.spec.ts`) verrouille
// l'interrupteur et les jetons `{{price:…}}`. Celle-ci verrouille ce qui passe AUTOUR :
//   - le prompt système du chatbot (règles codées ET prompt versionné) ;
//   - les cartes d'offre que le chatbot affiche (`offers-catalog` → `rechercher_offres`) ;
//   - le garde-fou de sortie du chatbot (`output-guard`) et le price-gate des contenus ;
//   - les consignes de prix des prompts de génération (brand-voice, générateurs) ;
//   - les fiches de la base de connaissance (faits KB, fiches sectorielles, seed Prisma).
//
// Un montant de MARCHÉ (statistique tierce, seuil légal, coût d'un poste) n'est pas un
// tarif Axion-IA : il reste permis, mais seulement s'il est déclaré comme tel (marqueur
// `price-exempt` sur la ligne, ou liste d'exemptions motivées ci-dessous).

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolvePriceTokens } from "@/content/pricing-tokens";
import { OFFERS } from "@/content/offers-catalog";
import { ALL_SECTOR_KB_ENTRIES } from "@/content/knowledge/sector-entries";
import { assembleSystemPrompt } from "@/server/chatbot/generation/system-prompt";
import { DEFAULT_TENANT_SETTINGS } from "@/server/chatbot/constants";
import type { ResolvedTenant } from "@/server/chatbot/tenant";
import { toOfferResult, searchOffers } from "@/server/chatbot/tools/rechercher-offres";
import { verifyOutput } from "@/server/chatbot/security/output-guard";
import { chatbotTools } from "@/server/chatbot/tools/registry";
import { gatherKbFactSources } from "@/server/chatbot/ingestion/seed-sources";
import { injectBrandVoiceForType } from "@/server/content-gen/brand/brand-voice";
import { findNonSsotPrices } from "@/server/content-gen/quality/price-gate";

const RACINE = process.cwd();

/** Un montant en euros : « 1 900 € », « 790 € HT », « 2 k€ », « 8-50 K€ », « €490 », « 300 euros ». */
const MONTANT_EUR = /(?:\d[\d\s  .,]*\s?[kKM]?€|€\s?\d|\d[\d\s  .,]*\s?euros?\b|\d\s?EUR\b)/g;
/** Le seul montant permis au public : la Journée IA. */
const JOURNEE = /1[\s  .]?490[\s  ]?(?:€|euros?\b|EUR\b)/g;

function montantsInterdits(texte: string): string[] {
  return texte.replace(JOURNEE, "").match(MONTANT_EUR) ?? [];
}

/** Jeton prix d'une offre autre que la Journée IA (il ne doit plus être proposé au LLM). */
const JETON_AUTRE_OFFRE = /\{\{price:(?!journee-ia\b)[^}]*\}\}/g;

const tenant: ResolvedTenant = {
  id: "t1",
  cle: "axion-ia",
  nom: "Axion-IA",
  domaine: null,
  actif: true,
  settings: DEFAULT_TENANT_SETTINGS,
};

/** La consigne que le chatbot et les rédacteurs doivent recevoir. */
function porteLaConsigneSurDevis(prompt: string): boolean {
  return /sur devis/i.test(prompt) && /rendez-vous gratuit de 45 minutes/i.test(prompt);
}

describe("R7 — chatbot : prompt système", () => {
  const variantes = {
    "règles codées": assembleSystemPrompt({ tenant }),
    "prompt versionné en base": assembleSystemPrompt({
      tenant,
      promptOverride: "Tu es l'assistant d'Axion-IA.",
    }),
  };

  for (const [nom, prompt] of Object.entries(variantes)) {
    it(`${nom} : aucun montant hors Journée IA, une fois les jetons résolus`, () => {
      expect(montantsInterdits(resolvePriceTokens(prompt, "fr"))).toEqual([]);
    });

    it(`${nom} : ne propose aucun jeton prix d'une autre offre que la Journée IA`, () => {
      expect(prompt.match(JETON_AUTRE_OFFRE) ?? []).toEqual([]);
    });

    it(`${nom} : impose « sur devis » et le rendez-vous gratuit de 45 minutes`, () => {
      expect(porteLaConsigneSurDevis(prompt)).toBe(true);
    });
  }

  it("la description de l'outil de recherche n'annonce plus de « prix exact » ni de budget en €", () => {
    for (const { name, description } of chatbotTools.list()) {
      expect(description, name).not.toMatch(/prix exact/i);
      expect(description, name).not.toMatch(/\d\s?€|X et Y €/);
    }
  });
});

describe("R7 — chatbot : cartes d'offre", () => {
  it("aucune carte n'affiche de montant hors Journée IA", () => {
    const fautives = OFFERS.map(toOfferResult)
      .filter((r) => montantsInterdits(`${r.prix} ${r.titre} ${r.dureeFr ?? ""}`).length > 0)
      .map((r) => `${r.id} → ${r.prix}`);
    expect(fautives).toEqual([]);
  });

  it("aucune carte ne transmet de prix chiffré au widget (prixMinNum)", () => {
    const fautives = OFFERS.map(toOfferResult)
      .filter((r) => r.prixMinNum !== undefined && r.prixMinNum !== 1490)
      .map((r) => r.id);
    expect(fautives).toEqual([]);
  });

  it("une recherche par budget ne trie ni ne filtre sur des montants masqués", () => {
    // « formations entre 2 000 et 3 000 € » : répondre par une liste filtrée sur des
    // prix qu'on ne montre pas reviendrait à les révéler. Aucune offre masquée ne sort.
    const r = searchOffers({ prixMin: 2000, prixMax: 3000 });
    expect(r.map((o) => o.id)).toEqual([]);
  });

  it("la Journée IA est au catalogue du chatbot, à 1 490 € HT, avec son lien", () => {
    const journee = OFFERS.find((o) => o.id === "journee-ia");
    expect(journee).toBeDefined();
    const carte = toOfferResult(journee!);
    expect(carte.onQuote).toBe(false);
    expect(carte.prix).toMatch(/^1[\s  ]?490[\s  ]?€ HT$/);
    expect(carte.urlFR).toBe("/fr/journee-ia");
    expect(journee!.audienceSizes).toEqual(["tpe", "pme"]);
  });

  it("rechercher_offres renvoie la Journée IA (formation, et pour un budget de 2 000 €)", () => {
    expect(searchOffers({ vertical: "formation" }).map((o) => o.id)).toContain("journee-ia");
    expect(searchOffers({ prixMax: 2000 }).map((o) => o.id)).toEqual(["journee-ia"]);
  });
});

describe("R7 — chatbot : garde-fou de sortie", () => {
  it("bloque tout montant cité hors Journée IA, même s'il figure dans la grille interne", () => {
    expect(verifyOutput("La formation d'une journée est à 1 200 € HT.").ok).toBe(false);
    expect(verifyOutput("Le coaching régulier est à 790 € HT la session.").ok).toBe(false);
  });

  it("laisse passer la Journée IA à 1 490 € HT", () => {
    expect(verifyOutput("La Journée IA est à 1 490 € HT.").ok).toBe(true);
  });

  it("bloque aussi les formes abrégées ou devise en tête (K€, k€, M€, €490)", () => {
    for (const texte of [
      "L'IA custom coûte 8-50 K€.",
      "Le coaching est à €490 HT.",
      "Comptez 5k€ pour démarrer.",
      "Un programme de 1,2 M€.",
    ]) {
      const r = verifyOutput(texte);
      expect(r.ok, texte).toBe(false);
      expect(
        r.violations.some((v) => v.type === "price" && /R7/.test(v.reason)),
        texte,
      ).toBe(true);
    }
  });
});

describe("R7 — génération de contenu : consignes de prix", () => {
  it("le brand-voice impose « sur devis » et ne propose que le jeton Journée IA", () => {
    const p = injectBrandVoiceForType("Rédige un article.", "blog_article");
    expect(p.match(JETON_AUTRE_OFFRE) ?? []).toEqual([]);
    expect(porteLaConsigneSurDevis(p)).toBe(true);
    expect(montantsInterdits(resolvePriceTokens(p, "fr"))).toEqual([]);
  });

  it("aucun générateur ne propose de jeton prix d'une autre offre ni n'injecte un montant", () => {
    const dossiers = ["generators", "brand", "shared"].map((d) =>
      path.join(RACINE, "src/server/content-gen", d),
    );
    const fautes: string[] = [];
    for (const fichier of fichiersTs(dossiers)) {
      const source = readFileSync(fichier, "utf8");
      const rel = path.relative(RACINE, fichier);
      for (const [i, ligne] of source.split("\n").entries()) {
        if (/^\s*(\/\/|\*|\/\*)/.test(ligne)) continue; // commentaires
        if (JETON_AUTRE_OFFRE.test(ligne) || /\{\{price:</.test(ligne))
          fautes.push(`${rel}:${i + 1} jeton`);
        JETON_AUTRE_OFFRE.lastIndex = 0;
      }
      if (
        /import\s*\{[^}]*\b(formatAmount|formatPrice|formatAmountRange|getEntryPriceEur)\b[^}]*\}\s*from\s*"@\/content\/pricing"/.test(
          source,
        )
      )
        fautes.push(`${rel} importe un formateur de montant brut`);
    }
    expect(fautes).toEqual([]);
  });

  it("le price-gate refuse tout montant hors Journée IA, même présent dans la grille interne", () => {
    expect(findNonSsotPrices("Formation d'une journée : 1 200 € HT").map((v) => v.value)).toEqual([
      1200,
    ]);
    expect(findNonSsotPrices("Audit Flash 490 € HT").map((v) => v.value)).toEqual([490]);
    expect(findNonSsotPrices("La Journée IA : 1 490 € HT")).toEqual([]);
  });
});

describe("R7 — base de connaissance", () => {
  const sourcesKb = fichiersTs([path.join(RACINE, "src/server/content-gen/kb")])
    .map((f) => readFileSync(f, "utf8"))
    .join("\n")
    .split("\n");

  it("faits KB (ingérés par le chatbot et seedés en KnowledgeEntry) : aucun tarif Axion-IA", () => {
    const fautes: string[] = [];
    for (const s of gatherKbFactSources()) {
      const texte = `${s.contenu}\n${s.contexte ?? ""}`;
      if (/grille tarifaire|prix public|tarif public/i.test(texte))
        fautes.push(`${s.sourceRef} : grille/prix public`);
      if (montantsInterdits(s.contenu).length === 0) continue;
      // Montant de marché : permis s'il est déclaré `price-exempt` sur sa ligne source.
      const debut = s.contenu.slice(0, 50);
      const ligne = sourcesKb.find((l) => l.includes(debut));
      if (!ligne?.includes("price-exempt"))
        fautes.push(`${s.sourceRef} : ${montantsInterdits(s.contenu).join(", ")}`);
    }
    expect(fautes).toEqual([]);
  });

  it("un fait KB décrit la Journée IA avec son prix (jeton résolu : 1 490 € HT)", () => {
    const fait = gatherKbFactSources().find((s) => /Journée IA/.test(s.contenu));
    expect(fait).toBeDefined();
    expect(fait!.contenu).toMatch(/1[\s  ]?490[\s  ]?€ HT/);
    expect(fait!.contenu).not.toMatch(/rembours|garanti/i);
  });

  it("fiches sectorielles : aucun tarif Axion-IA (montants de marché listés et motivés)", () => {
    const fautes: string[] = [];
    for (const e of ALL_SECTOR_KB_ENTRIES) {
      const texte = [e.titleFr, e.summaryFr, e.bodyMarkdownFr].join("\n");
      for (const ligne of texte.split("\n")) {
        const m = montantsInterdits(ligne);
        if (m.length === 0) continue;
        if (
          MONTANTS_DE_MARCHE_SECTORIELS.some((x) => x.slug === e.slug && ligne.includes(x.extrait))
        )
          continue;
        fautes.push(`${e.slug} : ${ligne.trim().slice(0, 110)}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it("seed Prisma (FAQ, articles, cas, aide) : aucun tarif Axion-IA", () => {
    const fautes: string[] = [];
    const source = readFileSync(path.join(RACINE, "prisma/seed.ts"), "utf8");
    for (const [i, ligne] of source.split("\n").entries()) {
      if (/^\s*(\/\/|\*|\/\*)/.test(ligne) || ligne.includes("price-exempt")) continue;
      if (montantsInterdits(ligne).length > 0) fautes.push(`prisma/seed.ts:${i + 1}`);
    }
    expect(fautes).toEqual([]);
  });
});

/**
 * Montants des fiches sectorielles qui ne sont PAS des tarifs Axion-IA. Un bloc de texte
 * Markdown ne peut pas porter de commentaire `price-exempt` : chaque exemption est donc
 * listée ici, avec sa raison. Toute autre ligne chiffrée en € fait échouer la garde.
 */
const MONTANTS_DE_MARCHE_SECTORIELS: ReadonlyArray<{
  slug: string;
  extrait: string;
  raison: string;
}> = [
  ...[
    "les systèmes de vision industrielle de précision représentent typiquement",
    "à 5 € la pièce représente 25 000 €",
  ].map((extrait) => ({
    slug: "secteur-brief-mecanique-precision",
    extrait,
    raison: "coût d'équipement marché et économie client illustrée, pas un tarif Axion-IA",
  })),
  {
    slug: "cas-typique-implementation-pharma",
    extrait: "Chiffre d'affaires : ~120 M€",
    raison: "chiffre d'affaires du client type",
  },
  {
    slug: "methodologie-intervention-ia-pme-industrielle",
    extrait: "Une PME industrielle alloue rarement plus de 50 000 à 100 000 €",
    raison: "budget observé côté client, pas un tarif Axion-IA",
  },
  {
    slug: "secteur-brief-enseignement-recherche",
    extrait: "Budget annuel ~260 M€",
    raison: "budget public de l'Inria",
  },
  {
    slug: "secteur-brief-enseignement-recherche",
    extrait: "MAPA au-dessus de 40 k€ HT",
    raison: "seuil légal de la commande publique",
  },
  // Calculateur ROI : valeurs d'exemple CÔTÉ CLIENT (salaires, abonnements, pénalités,
  // gains). Le coût de l'audit Axion-IA y est « sur devis » depuis R7.
  ...[
    "3 j × 500 € = 1 500 €",
    "**[coût de l'audit] + 1 500 €**",
    "3 600 €/an",
    "**10 800 € HT/an**",
    "150 000 € | **22 500 €**",
    "55 €/h | **11 440 €/an**",
    "38 €/h | **5 928 €/an**",
    "**17 368 €/an** (exemple)",
    "~80 000 € selon les études Ponemon/IBM 2023",
    "[coût de l'audit, sur devis] + 1 500 €",
    "| Économies logicielles année 1 | 10 800 € |",
    "| Évitement pénalités (valeur espérée) | 22 500 € |",
    "| Gains productivité année 1 | 17 368 € |",
    "**50 668 €**",
  ].map((extrait) => ({
    slug: "roi-calculator-template-audit-ia",
    extrait,
    raison: "valeur d'exemple côté client (temps interne, abonnements, risques, gains)",
  })),
];

function fichiersTs(dossiers: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  const visite = (d: string) => {
    for (const nom of readdirSync(d)) {
      const p = path.join(d, nom);
      if (statSync(p).isDirectory()) {
        if (nom !== "__tests__") visite(p);
      } else if (/\.ts$/.test(nom) && !/\.(test|spec)\.ts$/.test(nom)) out.push(p);
    }
  };
  for (const d of dossiers) visite(d);
  return out;
}
