/**
 * Délai d'accès (indicateur 1 Qualiopi) — UNE règle, lue partout, jamais l'ancienne.
 *
 * Le 2026-10-02, le dirigeant a fixé la règle réelle : « dès 48 heures pour un
 * financement direct par l'entreprise ; avec une prise en charge OPCO, comptez le
 * délai de réponse de l'OPCO (en général 2 à 4 semaines) ». Le site affichait
 * jusque-là « 11 jours ouvrés minimum », un chiffre sans fondement, recopié sur
 * les fiches, la FAQ, sept pages villes et la base de connaissances.
 *
 * Ce fichier rougit :
 *   1. si l'ancienne affirmation revient dans une ligne de code du contenu
 *      public (texte rendu, hors commentaires) ;
 *   2. si une surface cesse de lire la source unique (`delai-acces.ts`) ;
 *   3. si la fiche formation, RENDUE, n'affiche plus la règle — ou nomme France
 *      Travail alors que la page ne le propose pas.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DELAI_ACCES_COURT,
  DELAI_ACCES_FAIT,
  DELAI_ACCES_FORMES_RETIREES,
  DELAI_ACCES_PHRASE,
  DELAI_ACCES_VALEUR,
} from "../delai-acces";
import { FORMATION_DELAI_ACCES_DEFAUT, getFormationDelaiAcces } from "../catalog-v2-facts";
import { FORMATIONS_V2 } from "../catalog-v2";
import { FAQ_GLOBAL } from "@/content/transversal";
import { KB_INTERVENTIONS_FORMATIONS } from "@/server/content-gen/kb/interventions-formations";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: unknown; children?: ReactNode }) => (
    <a href={typeof href === "string" ? href : "/"}>{children}</a>
  ),
}));
vi.mock("@/components/forms/UnifiedContactForm", () => ({ UnifiedContactForm: () => null }));
vi.mock("@/components/reviews/ServiceReviewsSection", () => ({
  ServiceReviewsSection: () => null,
}));
vi.mock("@/components/services/RelatedKnowledge", () => ({ RelatedKnowledge: () => null }));
vi.mock("@/components/services/audit/ClientLogosMarqueeBand", () => ({
  ClientLogosMarqueeBand: () => null,
}));
vi.mock("@/components/sections/ContactBand", () => ({ ContactBand: () => null }));
vi.mock("@/components/sections/CtaBlock", () => ({ CtaBlock: () => null }));
// Composant serveur ASYNCHRONE (rendu statique synchrone impossible) : hors sujet ici.
vi.mock("@/components/nav/Breadcrumbs", () => ({ Breadcrumbs: () => null }));

const RACINE = path.resolve(__dirname, "../../../..");

/** Texte de référence validé par le dirigeant — recopié ICI à dessein, et nulle part ailleurs. */
const PHRASE_VALIDEE =
  "Délai d'accès : dès 48 heures pour un financement direct par l'entreprise ; avec une prise en charge OPCO, comptez le délai de réponse de l'OPCO (en général 2 à 4 semaines).";

function fautes(texte: string): string[] {
  return DELAI_ACCES_FORMES_RETIREES.filter((re) => re.test(texte)).map(String);
}

/** Lignes de code (hors commentaires) d'un fichier source. */
function lignesDeCode(source: string): string[] {
  return source.split("\n").filter((l) => {
    const t = l.trim();
    return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*"));
  });
}

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom === "__tests__" || nom === "(admin)" || nom === "node_modules") continue;
      out.push(...fichiers(p));
    } else if (/\.(ts|tsx|json|md|mdx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      out.push(p);
    }
  }
  return out;
}

describe("délai d'accès — la source unique porte la règle du dirigeant", () => {
  it("phrase complète = texte validé, mot pour mot", () => {
    expect(DELAI_ACCES_PHRASE).toBe(PHRASE_VALIDEE);
  });

  it("forme abrégée fidèle, et aucune forme ne porte l'ancienne affirmation", () => {
    expect(DELAI_ACCES_COURT).toBe("Dès 48 h (financement direct) · délai OPCO en sus");
    for (const t of [
      DELAI_ACCES_PHRASE,
      DELAI_ACCES_VALEUR,
      DELAI_ACCES_COURT,
      `${DELAI_ACCES_FAIT.figure} ${DELAI_ACCES_FAIT.label}`,
    ]) {
      expect(fautes(t)).toEqual([]);
    }
  });

  it("la garde reconnaît bien l'ancienne affirmation (témoin)", () => {
    expect(
      fautes("Nous consulter — sous 11 jours ouvrés minimum à compter de la confirmation"),
    ).not.toEqual([]);
    expect(fautes("Comptez au moins 11 jours ouvrés avant la session.")).not.toEqual([]);
    expect(fautes('{ figure: "11 j", label: "ouvrés de délai d\'accès" }')).not.toEqual([]);
  });
});

describe("délai d'accès — chaque surface lit la source unique", () => {
  it("fiches du catalogue : la valeur par défaut est la règle, sans surcharge divergente", () => {
    expect(FORMATION_DELAI_ACCES_DEFAUT).toBe(DELAI_ACCES_VALEUR);
    for (const f of FORMATIONS_V2) {
      expect(getFormationDelaiAcces(f), f.slugFr).toBe(DELAI_ACCES_VALEUR);
    }
  });

  it("autre financeur proposé : renvoi à SON délai de réponse, aucun délai inventé", () => {
    const f = FORMATIONS_V2[0]!;
    const t = getFormationDelaiAcces(f, ["France Travail"]);
    expect(t.startsWith(DELAI_ACCES_VALEUR)).toBe(true);
    expect(t).toContain("Avec France Travail, comptez le délai de réponse du financeur.");
    expect(t.replace(DELAI_ACCES_VALEUR, "")).not.toMatch(/\d/);
  });

  it("FAQ transversale : la phrase et la tuile viennent de la source", () => {
    const json = JSON.stringify(FAQ_GLOBAL);
    expect(fautes(json)).toEqual([]);
    expect(json.split(DELAI_ACCES_PHRASE).length - 1).toBeGreaterThanOrEqual(5);
    expect(json.split(JSON.stringify(DELAI_ACCES_FAIT.label)).length - 1).toBe(2);
  });

  it("base de connaissances (form-031) : la phrase de la source", () => {
    const fait = KB_INTERVENTIONS_FORMATIONS.find((k) => k.id === "form-031");
    expect(fait?.text).toContain(DELAI_ACCES_PHRASE);
    expect(fautes(JSON.stringify(KB_INTERVENTIONS_FORMATIONS))).toEqual([]);
  });

  it.each([
    "athis-mons",
    "chatillon",
    "eysines",
    "la-roche-sur-yon",
    "meaux",
    "puteaux",
    "sarcelles",
  ])("page ville %s : la FAQ lit la source", async (slug) => {
    const mod = (await import(`@/content/villes/copy/${slug}.ts`)) as Record<string, unknown>;
    const json = JSON.stringify(Object.values(mod));
    expect(json.includes(DELAI_ACCES_PHRASE), slug).toBe(true);
    expect(fautes(json)).toEqual([]);
  });
});

describe("délai d'accès — l'ancienne affirmation ne revient pas dans le contenu public", () => {
  const RACINES = [
    "src/content",
    "src/messages",
    "src/components",
    "src/app/[locale]",
    "src/server/content-gen/kb",
    "src/server/qualiopi/documents/templates",
  ];

  it("aucune ligne de code (hors commentaires) ne la porte", () => {
    const trouvees: string[] = [];
    for (const r of RACINES) {
      for (const f of fichiers(path.join(RACINE, r))) {
        lignesDeCode(readFileSync(f, "utf8")).forEach((l) => {
          if (fautes(l).length > 0) trouvees.push(`${path.relative(RACINE, f)} : ${l.trim()}`);
        });
      }
    }
    expect(trouvees).toEqual([]);
  });
});

describe("délai d'accès — rendu réel de la fiche formation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function rendre(): Promise<string> {
    const { FormationDetailPage } = await import("@/components/formations/FormationDetailPage");
    const f = FORMATIONS_V2.find((x) => !x.seminaire) ?? FORMATIONS_V2[0]!;
    const html = renderToStaticMarkup(
      <>
        {FormationDetailPage({
          formation: f,
          locale: "fr",
          referentHandicap: { nom: "", email: "handicap@example.invalid" },
          resultats: null,
        })}
      </>,
    );
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;|&#39;|&apos;/g, "'")
      .replace(/\s+/g, " ");
  }

  it("certification non affirmée : la règle, sans France Travail dans le délai", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
    const texte = await rendre();
    expect(texte).toContain(DELAI_ACCES_VALEUR);
    expect(texte).not.toContain("Avec France Travail, comptez");
    expect(fautes(texte)).toEqual([]);
  });

  it("financement affiché (France Travail proposé) : la règle + le délai du financeur", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    const texte = await rendre();
    expect(texte).toContain(
      `${DELAI_ACCES_VALEUR} Avec France Travail, comptez le délai de réponse du financeur.`,
    );
    expect(fautes(texte)).toEqual([]);
  });
});
