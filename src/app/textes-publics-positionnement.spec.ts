/**
 * Tests — lot R4 « textes publics » (vague 1B, audit harmonie du 2026-11-08).
 *
 * Décisions de Williams Jullin couvertes (DECISIONS-WILLIAMS.md) :
 *  - n°13 : le slogan des données structurées devient le positionnement ;
 *  - n°14 : jamais l'étiquette « TPE/PME » ;
 *  - n°15 : ni ETI ni grands groupes dans les textes publics ;
 *  - n°18 : /charte-editoriale dit ce qui est vrai de la relecture humaine ;
 *  - n°19 : adresse en JSON-LD = pays seulement ;
 *  - « siège à Grenoble » retiré des textes publics (« partout en France ») ;
 *  - le bloc « certifié Qualiopi » des llms*.txt est supprimé, pas seulement éteint.
 *
 * L'adresse complète reste dans les mentions légales / CGV / pied d'e-mail : ces
 * fichiers ne sont volontairement PAS lus ici.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("@/lib/seo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo")>();
  return { ...actual, SITE_URL: "https://axion-ia.com" };
});

import { GET as getLlms } from "./llms.txt/route";
import { GET as getLlmsFull } from "./llms-full.txt/route";
import { BRAND, FOUNDER } from "@/lib/brand";
import { buildPersonWilliamsJsonLd } from "@/lib/seo/williams-person";
import { WILLIAMS_LEAD, WILLIAMS_IDENTITE, WILLIAMS_PREUVES } from "@/content/equipe/williams";

const POSITIONNEMENT =
  "Le partenaire IA de bout en bout des PME : on chiffre, on forme, on met en place.";
const ROOT = path.resolve(__dirname, "../..");
const lire = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/** Retire les commentaires de ligne et de bloc : seuls les textes servis comptent. */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const INTERDITS_CIBLE = [
  [/\bETI\b/, "ETI"],
  [/grands groupes/i, "grands groupes"],
  [/TPE\s?\/\s?PME/, "TPE/PME"],
  [/PME\s?\/\s?ETI/, "PME/ETI"],
] as const;

describe("llms.txt / llms-full.txt — cible, rendez-vous, Qualiopi", () => {
  const drapeaux = ["OF_PUBLIC_DISCLOSURE_ENABLED", "QUALIOPI_CERTIFICATION_OBTENUE"] as const;
  const avant: Record<string, string | undefined> = {};
  beforeAll(() => {
    // Pire cas : les deux drapeaux levés. Le bloc doit avoir DISPARU, pas dormir.
    for (const d of drapeaux) {
      avant[d] = process.env[d];
      process.env[d] = "true";
    }
  });
  afterAll(() => {
    for (const d of drapeaux) {
      if (avant[d] === undefined) delete process.env[d];
      else process.env[d] = avant[d];
    }
  });

  it.each([
    ["llms.txt", getLlms],
    ["llms-full.txt", getLlmsFull],
  ] as const)(
    "%s : ni ETI, ni grands groupes, ni « TPE/PME », ni Qualiopi, même drapeaux levés",
    async (_n, get) => {
      const tout = await (await get()).text();
      // llms-full.txt rend aussi la FAQ partagée (`transversal.ts`), dont les entrées sur les
      // niveaux d'audit « Stratégique ETI » relèvent de l'offre/des tarifs (lot R5a) : ESCALADE.
      // On contrôle donc tout ce qui précède la FAQ (direction, modules, positionnement).
      const corps = tout.split("\n## FAQ")[0] ?? tout;
      for (const [motif, nom] of INTERDITS_CIBLE) expect(corps, nom).not.toMatch(motif);
      expect(tout).not.toMatch(/qualiopi|certifi|finançable/i);
      expect(tout).not.toMatch(/Grenoble/i);
    },
  );

  it.each([
    ["llms.txt", getLlms],
    ["llms-full.txt", getLlmsFull],
  ] as const)("%s : porte le message principal", async (_n, get) => {
    expect(await (await get()).text()).toContain(POSITIONNEMENT);
  });

  it("llms.txt nomme l'offre « La Journée IA » (sans lien : la page arrive par un autre lot)", async () => {
    const corps = await (await getLlms()).text();
    expect(corps).toContain("La Journée IA");
    expect(corps).not.toMatch(/journee-ia/);
  });

  it("llms.txt : la visio de sélection du Tour dure 45 minutes, jamais 30", async () => {
    const corps = await (await getLlms()).text();
    expect(corps).toMatch(/visio de 45 minutes/);
    expect(corps).not.toMatch(/30 minutes/);
    expect(corps).toMatch(/des TPE et PME, tous secteurs/);
  });

  it("les sources des deux routes ne lisent plus aucun drapeau de certification", () => {
    for (const rel of ["src/app/llms.txt/route.ts", "src/app/llms-full.txt/route.ts"]) {
      const code = sansCommentaires(lire(rel));
      expect(code, rel).not.toMatch(/QUALIOPI_CERTIFICATION_OBTENUE|OF_PUBLIC_DISCLOSURE_ENABLED/);
      expect(code, rel).not.toMatch(/qualiopi/i);
    }
  });
});

describe("slogan des données structurées (décision n°13)", () => {
  it("le slogan est le positionnement, en FR et en EN", () => {
    expect(BRAND.sloganFr).toBe(POSITIONNEMENT);
    expect(BRAND.sloganEn).toMatch(/end-to-end AI partner for SMEs/);
    expect(`${BRAND.sloganFr} ${BRAND.sloganEn}`).not.toMatch(
      /idée à l.impact|idea to impact|Un seul partenaire/i,
    );
  });

  it("le nœud Organization émet ce slogan (seul usage de BRAND.sloganFr/En)", () => {
    expect(lire("src/lib/seo.ts")).toContain("slogan: isFr ? BRAND.sloganFr : BRAND.sloganEn");
  });

  it("knowsAbout ne nomme plus ETI ni grands groupes", () => {
    expect(FOUNDER.knowsAbout.join(" ")).not.toMatch(/ETI|grands groupes/i);
  });
});

describe("adresse en JSON-LD : pays seulement (décision n°19)", () => {
  it("la fiche Person de Williams ne porte plus ni Grenoble ni région", () => {
    const json = JSON.stringify(buildPersonWilliamsJsonLd());
    expect(json).not.toMatch(
      /Grenoble|Auvergne|addressLocality|addressRegion|postalCode|streetAddress/,
    );
    expect(json).toContain('"addressCountry":"FR"');
  });

  it("les JSON-LD de /a-propos et /contact n'émettent plus de localité, code postal ni région", () => {
    for (const rel of ["src/app/[locale]/a-propos/page.tsx", "src/app/[locale]/contact/page.tsx"]) {
      const code = sansCommentaires(lire(rel));
      expect(code, rel).not.toMatch(/addressLocality|postalCode|addressRegion|streetAddress/);
      expect(code, rel).not.toMatch(/city:\s*"Grenoble"/);
    }
  });
});

describe("textes publics : plus de siège à Grenoble, plus d'ETI (décisions n°14 et n°15)", () => {
  const FICHIERS_TSX_TS = [
    "src/app/[locale]/a-propos/page.tsx",
    "src/app/[locale]/contact/page.tsx",
    "src/app/[locale]/charte-editoriale/page.tsx",
    "src/content/equipe/williams.ts",
    "src/components/sections/FounderProfile.tsx",
    "src/lib/seo/williams-person.ts",
  ];

  it.each(FICHIERS_TSX_TS)("%s : aucune mention de Grenoble ni de la cible ETI", (rel) => {
    const code = sansCommentaires(lire(rel));
    expect(code).not.toMatch(/Grenoble/i);
    for (const [motif, nom] of INTERDITS_CIBLE) expect(code, nom).not.toMatch(motif);
    expect(code).not.toMatch(/mid-caps?|mid-market/i);
  });

  it("la fiche de Williams ne parle plus de siège ni de grands groupes", () => {
    const textes = [
      WILLIAMS_LEAD,
      ...WILLIAMS_IDENTITE.map((l) => `${l.terme} ${l.valeur}`),
      ...WILLIAMS_PREUVES.map((p) => `${p.chiffre} ${p.libelle}`),
    ].join("\n");
    expect(textes).not.toMatch(/siège|Grenoble|ETI|grands groupes/i);
    expect(WILLIAMS_IDENTITE.map((l) => l.terme)).not.toContain("Siège");
  });

  it("transversal.ts : la question FAQ « ETI et grands comptes » a disparu, sans lien orphelin", () => {
    const src = lire("src/content/transversal.ts");
    expect(src).not.toContain('id: "eti-grands-comptes"');
    expect(src).not.toContain("eti-grands-comptes");
    expect(src).not.toMatch(/travaille-t-il avec les ETI/);
    expect(src).not.toMatch(/Le Havre, Grenoble/);
    expect(src).not.toMatch(/TPE\s?\/\s?PME/);
  });

  it("fr.json : accueil sans ETI / grands groupes dans le manifeste, la preuve fondateur et la comparaison", () => {
    const fr = JSON.parse(lire("src/messages/fr.json")) as { home: Record<string, string> };
    for (const cle of [
      "manifestoContext",
      "value3Bullet3",
      "founderStat3Number",
      "comparisonRow2Label",
    ]) {
      const v = fr.home[cle] ?? "";
      expect(v, cle).not.toBe("");
      expect(v, cle).not.toMatch(/\bETI\b|grands groupes|TPE\/PME/);
    }
  });
});

describe("/charte-editoriale : « Williams », et la vérité sur la relecture (décisions n°17-A17 et n°18)", () => {
  const code = sansCommentaires(lire("src/app/[locale]/charte-editoriale/page.tsx"));
  const brut = lire("src/app/[locale]/charte-editoriale/page.tsx");

  it("ni « Will » (texte ou commentaire), ni validation par une personne nommée", () => {
    expect(brut).not.toMatch(/\bWill\b/);
    expect(code).not.toMatch(/validée? par/i);
    expect(code).not.toMatch(/validated by/i);
  });

  it("ne promet plus une relecture systématique avant publication", () => {
    expect(code).not.toMatch(/relus et validés/);
    expect(code).not.toMatch(/reviewed and validated/);
    expect(code).not.toMatch(/revue humaine\)/);
    expect(code).not.toMatch(/human review\)/);
    expect(code).not.toMatch(/supervision humaine|human supervision/i);
    expect(code).not.toMatch(/révisées avant publication|revised before publication/i);
  });

  it("dit honnêtement que la relecture humaine n'est pas systématique, en FR et en EN", () => {
    expect(code).toMatch(/relecture humaine n'est pas systématique/);
    expect(code).toMatch(/human review is not systematic/i);
    expect(code).toMatch(/sans validation humaine préalable/);
    expect(code).toMatch(/without prior human validation/);
  });

  it("dit ce qui déclenche une relecture humaine : contrôle bloquant, puis signalement", () => {
    expect(code).toMatch(/attend une relecture humaine/);
    expect(code).toMatch(/waits for human review/);
    expect(code).toMatch(/sur signalement/);
  });

  it("place la vérification factuelle APRÈS la mise en ligne (le worker est un hook post-publication)", () => {
    expect(code).toMatch(/Chaque article publié fait l'objet d'une vérification factuelle/);
    expect(code).toMatch(/Every published article goes through an automatic factual check/);
  });
});

describe("rédaction : pas de mots proscrits dans les fichiers de ce lot", () => {
  it("aucun Qualiopi / CPF / « certifié » dans les textes de la charte et de llms*.txt", () => {
    for (const rel of [
      "src/app/[locale]/charte-editoriale/page.tsx",
      "src/app/llms.txt/route.ts",
      "src/app/llms-full.txt/route.ts",
    ]) {
      expect(sansCommentaires(lire(rel)), rel).not.toMatch(
        /qualiopi|\bCPF\b|certifi|Aucun gain garanti/i,
      );
    }
  });
});
