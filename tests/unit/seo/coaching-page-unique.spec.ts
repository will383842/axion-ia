// @vitest-environment node
/**
 * GEO V2-08 — une seule page de référence pour le coaching individuel : `/fr/un-a-un`.
 *
 * - les trois autres pages déclarent la référence comme canonique, n'émettent plus de `Service`
 *   ni de `WebPage`, et ne sont plus dans le sitemap ;
 * - la référence ouvre sur une définition autonome, porte déroulé, « pour qui », différence avec
 *   la Journée IA et la formation, un lien vers `/journee-ia`, et un seul `Service` rendu serveur ;
 * - aucune promesse contradictoire (« 20 min » contre l'échange de 45 min), aucun prix de coaching,
 *   aucun mot interdit.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  COACHING_DEFINITION_FR,
  COACHING_DEROULE_INTRO_FR,
  COACHING_PAGES_CANONIQUES_VERS_REFERENCE,
  COACHING_PROFILS_FR,
  COACHING_TITRES_FR,
  comparaisonCoachingFr,
} from "@/content/coaching-reference";
import { COACHING_1TO1_DEROULE } from "@/content/coaching-1to1";
import { routing } from "@/i18n/routing";
import { metadataCanoniqueVersCoaching } from "@/lib/seo/coaching-canonical";

const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const HUB = "src/app/[locale]/un-a-un/page.tsx";
const VISION = "src/app/[locale]/interventions/dirigeant-vision-strategique/page.tsx";
const SECONDAIRES = [
  "src/app/[locale]/interventions/individuel/page.tsx",
  "src/app/[locale]/interventions/dirigeants/page.tsx",
  VISION,
];
const INTERDITS =
  /Qualiopi|OPCO|prise en charge|financement|CPF|France Travail|Grenoble|Aucun gain garanti|formation obligatoire|Williams|Jullin/i;

/** Tout le texte de coaching que le module expose. */
const textesCoaching = () =>
  JSON.stringify([
    COACHING_DEFINITION_FR,
    COACHING_DEROULE_INTRO_FR,
    COACHING_TITRES_FR,
    COACHING_PROFILS_FR,
    comparaisonCoachingFr(),
    COACHING_1TO1_DEROULE,
  ]);

describe("V2-08 — pages secondaires : canonical vers la référence", () => {
  it("le canonical est /fr/un-a-un, sans hreflang, robots non touché", () => {
    const meta = metadataCanoniqueVersCoaching(
      {
        alternates: { canonical: "/fr/interventions/individuel", languages: { fr: "/fr/x" } },
        openGraph: { url: "https://axion-ia.com/fr/interventions/individuel" },
        robots: { index: true, follow: true },
      },
      "fr",
    );
    expect(meta.alternates).toEqual({ canonical: "/fr/un-a-un" });
    expect(meta.openGraph?.url).toMatch(/\/fr\/un-a-un$/);
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it.each(SECONDAIRES)("%s passe par metadataCanoniqueVersCoaching", (f) => {
    expect(lire(f)).toContain("metadataCanoniqueVersCoaching(meta, locale)");
  });

  it.each(SECONDAIRES.filter((f) => !f.includes("dirigeant-vision")))(
    "%s n'émet plus de Service ni de WebPage",
    (f) => {
      const src = lire(f);
      expect(src).not.toMatch(/buildServiceJsonLd|buildWebPageJsonLd/);
    },
  );

  it("une seule page de coaching émet le Service « Coaching IA individuel » (tout src/app et src/components)", () => {
    const parcourir = (dir: string): string[] =>
      readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) => {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) return parcourir(rel);
        return /\.(tsx?|jsx?)$/.test(e.name) ? [rel] : [];
      });
    const fichiers = [...parcourir("src/app"), ...parcourir("src/components")];
    const avecServiceCoaching = fichiers.filter((f) => {
      const src = lire(f);
      return /buildServiceJsonLd\(/.test(src) && /serviceType:\s*[^,\n]*coaching/i.test(src);
    });
    expect(avecServiceCoaching).toEqual([HUB]);
  });

  it("la page Vision IA stratégique n'émet pas de Service : le gabarit partagé le neutralise pour ce slug", () => {
    expect(lire(VISION)).toContain("InterventionDetailPage");
    const gabarit = lire("src/components/sections/InterventionDetailPage.tsx");
    expect(gabarit).toMatch(
      /slug === "dirigeant-vision-strategique"\s*\? null\s*: buildServiceJsonLd\(/,
    );
    expect(gabarit).toContain("{serviceJsonLd ? <JsonLd data={serviceJsonLd} /> : null}");
  });

  it("les trois pages sont exclues de pages.xml et existent bien dans routing.pathnames", () => {
    const sitemap = lire("src/app/sitemap.ts");
    for (const cle of COACHING_PAGES_CANONIQUES_VERS_REFERENCE) {
      expect(Object.keys(routing.pathnames)).toContain(cle);
      expect(sitemap).toContain(`"${cle}",`);
    }
    // la page de référence, elle, reste annoncée
    expect(sitemap).not.toMatch(/"\/un-a-un",/);
  });
});

describe("V2-08 — la page de référence", () => {
  const hub = lire(HUB);

  it("ouvre sur une définition autonome, sans prix ni chiffre client", () => {
    expect(COACHING_DEFINITION_FR).toMatch(/^Le coaching IA individuel d’Axion-IA est /);
    expect(COACHING_DEFINITION_FR).not.toMatch(/€|\d{2,} ?%|clients?/i);
    expect(hub).toContain("? COACHING_DEFINITION_FR");
  });

  it("rend en HTML le déroulé, « pour qui » et la différence (sections serveur)", () => {
    expect(hub).toContain("COACHING_1TO1_DEROULE.map");
    expect(hub).toContain("COACHING_PROFILS_FR.map");
    expect(hub).toContain("comparaisonCoachingFr().map");
    expect(hub).not.toMatch(/["']use client["']/);
    expect(COACHING_1TO1_DEROULE.length).toBeGreaterThanOrEqual(4);
  });

  it("différencie le coaching de la Journée IA et de la formation, avec un lien vers /journee-ia", () => {
    const c = comparaisonCoachingFr();
    expect(c.map((x) => x.id)).toEqual(["coaching", "journee-ia", "formation"]);
    expect(c[1].lien?.href).toBe("/journee-ia");
    expect(c[1].texte).toMatch(/audit le matin/);
    expect(c[1].texte).toMatch(/formation de 4 h/);
    expect(c[2].lien?.href).toBe("/formations");
  });

  it("les cartes de formules renvoient à des ancres de la page, pas aux pages doublons", () => {
    expect(hub).not.toMatch(/coachingFormulePath/);
    expect(hub).toContain('"#profil-dirigeant"');
    expect(hub).toContain('"#profil-collaborateur"');
    const ancres = COACHING_PROFILS_FR.map((p) => p.ancre);
    expect(ancres).toContain("profil-dirigeant");
    expect(ancres).toContain("profil-collaborateur");
  });

  it("le Service JSON-LD est rendu côté serveur et n'expose aucun prix", () => {
    expect(hub.match(/buildServiceJsonLd\(/g)).toHaveLength(1);
    expect(hub).toContain("<JsonLd data={serviceJsonLd} />");
    const bloc = hub.slice(
      hub.indexOf("const serviceJsonLd"),
      hub.indexOf("const coachingPageJsonLd"),
    );
    expect(bloc).not.toMatch(/priceEur|offers|price:/);
  });
});

describe("V2-08 — cohérence et mots interdits", () => {
  it("aucun prix de coaching : le seul montant est la Journée IA, par jeton (jamais en dur)", () => {
    const hors = JSON.stringify([
      COACHING_DEFINITION_FR,
      COACHING_PROFILS_FR,
      COACHING_1TO1_DEROULE,
    ]);
    expect(hors).not.toMatch(/€/);
    const journee = comparaisonCoachingFr()[1].texte;
    expect(journee).toMatch(/€/); // injecté par `remplacerJetons`
    expect(journee).not.toContain("{{PRIX}}");
    expect(lire("src/content/coaching-reference.ts")).not.toMatch(/\d[  ]?€/);
  });

  it("aucune promesse contradictoire : l'échange préalable est de 45 min partout", () => {
    expect(JSON.stringify(COACHING_1TO1_DEROULE)).toMatch(/45 minutes/);
    for (const f of [...SECONDAIRES, "src/components/sections/IndividualCoachingPage.tsx"]) {
      expect(lire(f), f).not.toMatch(/20 min|20-min|20 minutes/);
    }
  });

  it("aucun mot interdit dans les textes de la page de référence", () => {
    expect(textesCoaching()).not.toMatch(INTERDITS);
    expect(lire("src/content/coaching-reference.ts").replace(/^\/\/.*$/gm, "")).not.toMatch(
      INTERDITS,
    );
  });
});
