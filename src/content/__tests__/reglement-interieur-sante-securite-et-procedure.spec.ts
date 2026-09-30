/**
 * Règlement intérieur — santé/hygiène/sécurité, procédure disciplinaire,
 * représentation des stagiaires, issue financière d'une exclusion.
 *
 * ## Le défaut (relecture des pièces réelles, 2026-09-30)
 *
 * Trois versions du même règlement vivent dans le dépôt : la page publique
 * (`src/content/legal.ts`), le PDF remis au stagiaire (`reglement-interieur.tsx`)
 * et le livret d'accueil qui en reprend l'essentiel. Relues comme l'auditeur :
 *
 *  - l'article « Sécurité » était mince au regard de R.6352-1 et L.6352-3
 *    (« principales mesures applicables en matière de santé, de sécurité ») :
 *    ni hygiène, ni interdiction de fumer et de vapoter, ni consignes
 *    d'incendie, ni la règle de R.6352-1 — dans une entreprise dotée d'un
 *    règlement intérieur, ce sont SES mesures de santé et sécurité qui
 *    s'appliquent ;
 *  - la convocation disciplinaire ne disait ni la date, ni l'heure, ni le lieu
 *    de l'entretien, ni qu'elle mentionne la faculté de se faire assister
 *    (R.6352-5), et restreignait l'assistant à « stagiaire ou salarié de
 *    l'organisme » là où le texte dit « la personne de son choix » ;
 *  - aucune clause de représentation des stagiaires (R.6352-9 s., sessions de
 *    plus de 500 heures) ;
 *  - la page publique annonçait l'exclusion « sans remboursement des frais de
 *    formation déjà engagés », à rebours des CGV (seules les prestations
 *    réalisées sont dues, au prorata) et de l'interdiction des sanctions
 *    pécuniaires (R.6352-3).
 *
 * Ce fichier exige que les trois versions disent la même chose sur ces points.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const PAGE = lire("src", "content", "legal.ts");
const GABARIT = lire(
  "src",
  "server",
  "qualiopi",
  "documents",
  "templates",
  "reglement-interieur.tsx",
);
const LIVRET = lire("src", "server", "qualiopi", "documents", "templates", "livret-accueil.tsx");

/** Texte utile : lignes de commentaire écartées, espaces aplatis, apostrophes JSX rendues. */
function aplati(source: string): string {
  return source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
    .join(" ")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ");
}

const SOURCES = {
  "page publique": aplati(PAGE),
  "règlement PDF": aplati(GABARIT),
  "livret PDF": aplati(LIVRET),
} as const;
const REGLEMENTS = {
  "page publique": SOURCES["page publique"],
  "règlement PDF": SOURCES["règlement PDF"],
};

function manquants(sources: Record<string, string>, motifs: RegExp[]): string[] {
  return Object.entries(sources).flatMap(([nom, src]) =>
    motifs.filter((re) => !re.test(src)).map((re) => `${nom} : ${re.source}`),
  );
}

describe("règlement intérieur — santé, hygiène et sécurité (R.6352-1, L.6352-3)", () => {
  it("les trois versions interdisent de fumer ET de vapoter, et renvoient aux consignes d'incendie et d'évacuation affichées", () => {
    expect(
      manquants(SOURCES, [/interdit de fumer et de vapoter/i, /incendie/i, /évacuation/i]),
    ).toEqual([]);
  });

  it("les trois versions disent que, chez une entreprise dotée d'un règlement intérieur, ses mesures de santé et sécurité s'appliquent", () => {
    expect(
      manquants(SOURCES, [
        /les mesures de santé et de sécurité applicables aux stagiaires sont celles de ce (dernier )?règlement/i,
      ]),
    ).toEqual([]);
  });

  it("le règlement publié et le PDF traitent de l'hygiène", () => {
    expect(manquants(REGLEMENTS, [/hygiène/i])).toEqual([]);
  });
});

describe("règlement intérieur — procédure disciplinaire (R.6352-5, R.6352-6)", () => {
  it("la convocation précise l'objet, la date, l'heure et le lieu, et fait état de la faculté de se faire assister", () => {
    expect(
      manquants(REGLEMENTS, [
        /date, l'heure et le lieu de l'entretien/i,
        /fait état de la faculté de se faire assister/i,
        /R6352-5/,
      ]),
    ).toEqual([]);
  });

  it("l'assistant est « la personne de son choix », sans restriction au stagiaire ou au salarié de l'organisme", () => {
    const residus = Object.entries(REGLEMENTS).filter(([, src]) =>
      /stagiaire ou salarié de l'organisme/i.test(src),
    );
    expect(residus.map(([nom]) => nom)).toEqual([]);
  });
});

describe("règlement intérieur — représentation des stagiaires (R.6352-9 s.)", () => {
  it("le seuil des 500 heures est énoncé, avec le constat qu'aucune action de l'organisme ne l'atteint", () => {
    expect(
      manquants(REGLEMENTS, [/cinq cents heures/i, /R6352-9/, /aucune action de formation/i]),
    ).toEqual([]);
  });
});

describe("règlement intérieur — l'exclusion n'est pas une sanction pécuniaire (R.6352-3, CGV)", () => {
  it("🔴 plus aucune version n'annonce l'exclusion « sans remboursement des frais »", () => {
    expect(PAGE).not.toMatch(/sans remboursement des frais de formation/i);
    expect(PAGE).not.toMatch(/without refund of training fees/i);
    expect(GABARIT).not.toMatch(/sans remboursement/i);
  });

  it("l'issue financière renvoie aux conditions contractuelles : prestations réalisées dues au prorata", () => {
    expect(manquants(REGLEMENTS, [/au prorata/i])).toEqual([]);
  });
});
