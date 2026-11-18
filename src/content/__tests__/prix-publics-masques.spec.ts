// R7 — ordre de Williams du 08/11/2026 : « il ne faut plus de prix affichés pour les
// formations, les audits ou autres. La seule chose à mettre en avant est la journée audit à
// 1 490 €. TOUT LE RESTE, IL NE FAUT PLUS RIEN AFFICHER NULLE PART. »
//
// Ce fichier verrouille la COUCHE CENTRALE : l'interrupteur de `pricing.ts`, les formateurs
// d'affichage et les jetons `{{price:…}}` de la prose (2 160 fichiers de copy villes, FAQ,
// fiches de la base de connaissance, chatbot). Les pages qui écrivent un montant à la main
// sont couvertes par leurs propres gardes.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  FORMATION_PRICE_MATRIX,
  IMPLEMENTATION_TIERS,
  JOURNEE_IA_TIER,
  MAINTENANCE_TIERS,
  PRICING_CATEGORIES,
  PRIX_PUBLICS_AFFICHES,
  UN_A_UN_RECURRING_TIER,
  UN_A_UN_TIERS,
  formatFormationPrice,
  formatPricePublic,
  formatSubTierPrice,
  formatTierPrice,
  getEntryLabel,
  getFromLabel,
  prixAffichable,
  type FormationCategorie,
  type FormationDuree,
  type PricingTier,
} from "@/content/pricing";
import { PRICE_TOKEN_REGISTRY, resolvePriceTokens } from "@/content/pricing-tokens";

/** Un montant en euros : « 1 900 € », « 790 € HT », « 2 k€ », « €490 ». */
const MONTANT_EUR = /(?:\d[\d\s  .,]*\s?k?€|€\s?\d)/;
/** Le seul montant permis au public. */
const JOURNEE = /1[\s  ]?490[\s  ]?€/g;

function montantsInterdits(texte: string): string[] {
  const sans = texte.replace(JOURNEE, "");
  const trouves = sans.match(new RegExp(MONTANT_EUR.source, "g")) ?? [];
  return trouves;
}

const TOUS_LES_PALIERS: PricingTier[] = [
  ...Object.values(PRICING_CATEGORIES).flat(),
  ...UN_A_UN_TIERS,
  UN_A_UN_RECURRING_TIER,
  ...MAINTENANCE_TIERS,
  ...IMPLEMENTATION_TIERS,
];

describe("R7 — interrupteur des prix publics", () => {
  it("est coupé : aucun prix public sauf la Journée IA", () => {
    expect(PRIX_PUBLICS_AFFICHES).toBe(false);
  });

  it("seule la Journée IA reste affichable, à 1 490 € HT", () => {
    expect(prixAffichable(JOURNEE_IA_TIER)).toBe(true);
    expect(formatTierPrice(JOURNEE_IA_TIER, "fr")).toMatch(/^1\s490 € HT$/);
    expect(resolvePriceTokens("{{price:journee-ia|flat}}")).toMatch(/^1\s490 € HT$/);
  });

  it.each(TOUS_LES_PALIERS.map((t) => [t.id, t] as const))(
    "palier %s : aucun montant dans les formateurs d'affichage",
    (_id, tier) => {
      expect(prixAffichable(tier)).toBe(false);
      for (const loc of ["fr", "en"] as const) {
        expect(montantsInterdits(formatTierPrice(tier, loc))).toEqual([]);
        expect(montantsInterdits(formatPricePublic(tier, loc))).toEqual([]);
        for (const sub of tier.subTiers ?? []) {
          expect(montantsInterdits(formatSubTierPrice(sub, loc))).toEqual([]);
        }
      }
    },
  );

  it("les libellés d'entrée de catégorie disent « Sur devis »", () => {
    for (const tiers of Object.values(PRICING_CATEGORIES)) {
      expect(getEntryLabel(tiers, "fr")).toBe("Sur devis");
      expect(getFromLabel(tiers, "fr")).toBe("Sur devis");
    }
  });

  it("la matrice des formations n'affiche aucun prix", () => {
    for (const [categorie, durees] of Object.entries(FORMATION_PRICE_MATRIX)) {
      for (const duree of Object.keys(durees)) {
        expect(
          formatFormationPrice(categorie as FormationCategorie, duree as FormationDuree, "fr"),
        ).toBe("Sur devis");
      }
    }
  });

  it.each([...PRICE_TOKEN_REGISTRY.keys()].filter((id) => id !== JOURNEE_IA_TIER.id))(
    "jeton {{price:%s}} : aucun montant, quel que soit le mode",
    (id) => {
      for (const mode of [
        "",
        "|flat",
        "|onsite",
        "|range",
        "|from",
        "|entry",
        "|compact",
        "|num",
      ]) {
        const rendu = resolvePriceTokens(`Le format démarre à {{price:${id}${mode}}}.`);
        expect(montantsInterdits(rendu)).toEqual([]);
        expect(rendu).not.toMatch(/\d/);
        expect(rendu).not.toContain("\u0000");
      }
    },
  );
});

describe("R7 — la prose recollée reste du français", () => {
  it.each([
    ["L'Audit sur place démarre à {{price:audit-flash|flat}}.", "L'Audit sur place est sur devis."],
    ["Audit sur place dès {{price:audit-flash|flat}}.", "Audit sur place sur devis."],
    [
      "Nos interventions (à partir de {{price:intervention-4h|flat}}) ciblent",
      "Nos interventions (sur devis) ciblent",
    ],
    ["À partir de {{price:intervention-dirigeants|flat}}", "Sur devis"],
    [
      "un budget compris entre {{price:audit-cible-solo|num}} et {{price:audit-cible-avance}}.",
      "un budget sur devis.",
    ],
    [
      "Les interventions débutent à {{price:intervention-4h|flat}}.",
      "Les interventions sont sur devis.",
    ],
    [
      "sont sur devis dès {{price:intervention-dirigeants|flat}} selon périmètre",
      "sont sur devis selon périmètre",
    ],
    [
      "Audit sur place {{price:audit-flash|flat}}, ROI chiffré.",
      "Audit sur place sur devis, ROI chiffré.",
    ],
    // Relecture Opus : bornes de mots (« départ », « guide », « jusqu'à ») et devises écrites.
    ["Au départ de {{price:audit-flash|flat}}.", "Au départ sur devis."],
    ["Le guide {{price:audit-flash|flat}}", "Le guide sur devis"],
    ["Coût {{price:audit-flash|num}} € HT.", "Coût sur devis."],
    ["« Dès {{price:audit-flash|flat}} »", "« Sur devis »"],
    // Une promesse de « tarifs publics » devient fausse : elle tombe.
    [
      "L'Audit sur place démarre à {{price:audit-flash|flat}}. Tarifs publics consultables sur notre site. Adapté aux TPE.",
      "L'Audit sur place est sur devis. Adapté aux TPE.",
    ],
    [
      "L'Audit sur place démarre à {{price:audit-flash|flat}}, tarifs publics et sans devis opaque. Suite.",
      "L'Audit sur place est sur devis. Suite.",
    ],
  ])("%s", (source, attendu) => {
    expect(resolvePriceTokens(source, "fr")).toBe(attendu);
  });
});

describe("R7 — copy des 2 160 pages villes", () => {
  const DOSSIER = join(process.cwd(), "src/content/villes/copy");
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".ts") && !f.startsWith("_"));

  it("aucun montant de nos offres et aucun recollage fautif une fois les jetons résolus", () => {
    const fautes: string[] = [];
    for (const f of fichiers) {
      const source = readFileSync(join(DOSSIER, f), "utf8");
      for (const brut of source.match(/"(?:[^"\\]|\\.)*"/g) ?? []) {
        if (!brut.includes("{{price")) continue;
        const rendu = resolvePriceTokens(JSON.parse(brut) as string, "fr");
        const mauvais =
          /\{\{price|\u0000|\d[\d\s\u00a0\u202f]*\s?€\s?HT|(?:(?:^|\s)(?:à|dès|de|partir))\s+sur devis|[\p{L}'’]sur devis|jusqu['’]sur|tarifs? publics?(?! identiques)/iu.exec(
            rendu,
          );
        if (mauvais)
          fautes.push(
            `${f} : …${rendu.slice(Math.max(0, mauvais.index - 50), mauvais.index + 40)}…`,
          );
      }
    }
    expect(fautes.slice(0, 20)).toEqual([]);
  });
});
