/**
 * Un seul JobPosting pour les apporteurs d'affaires, PRUDENT : celui de
 * `/fr/devenir-commercial-ia`. `/memo-isere` n'en porte aucun.
 *
 * 🔴 HISTOIRE. Décision Will du 2026-09-19 (B5) : aucun JobPosting, car une offre
 * d'emploi est exactement la pièce qu'un juge lirait comme l'annonce d'un salariat
 * déguisé. Levée pour CETTE SEULE page par décision de Will du 25/11/2026, risques
 * juridique et Google (règle affiliate) assumés. Cette spec verrouille les deux faces :
 * ce qui est permis (un balisage sans montant, sans horaires, sans date de fin) et ce
 * qui reste interdit (tout autre emplacement, toute rémunération balisée).
 *
 * 🔑 On lit l'ARBRE que la page rend, pas son code source : le `JSON.stringify` est
 * exactement celui que `JsonLd` écrit dans le HTML.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getLocale: vi.fn(async () => "fr"),
  getTranslations: vi.fn(async () => (k: string) => k),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));
// Aucun avis en base de test : la section avis se masque, le reste de la page
// est rendu comme en production.
vi.mock("@/server/reviews/queries", () => ({
  getPublishedReviews: vi.fn(async () => ({ items: [], total: 0 })),
}));

import { JsonLd } from "@/components/marketing/JsonLd";
import {
  APPORTEUR_JOB_POSTING_DATE_POSTED,
  STATIC_JOB_POSTINGS,
} from "@/content/recrutement/dates";
import { SITE_URL } from "@/lib/seo";
import { HIRING_ORG } from "@/lib/seo/job-posting";
import { buildApporteurJobPostingJsonLd } from "@/lib/seo/job-posting-apporteur";
import { fautesDeRemuneration } from "../../../scripts/gates/jur-copy-indicative";
import { fautesDeVocabulaire } from "../../../scripts/gates/vocab-public";
import DevenirCommercialHub from "@/app/[locale]/devenir-commercial-ia/page";
import MemoIserePage from "@/app/[locale]/memo-isere/page";

/**
 * Toutes les données structurées de l'arbre, telles qu'elles partent dans le
 * HTML. On descend dans TOUTES les props (pas seulement `children`) : un
 * `JsonLd` passé en prop d'un bloc serait sinon invisible.
 */
function donneesStructurees(noeud: unknown, out: string[] = []): string[] {
  if (Array.isArray(noeud)) {
    for (const n of noeud) donneesStructurees(n, out);
    return out;
  }
  if (!isValidElement(noeud)) return out;
  const props = noeud.props as Record<string, unknown>;
  if (noeud.type === JsonLd) out.push(JSON.stringify(props.data));
  if (noeud.type === "script") {
    const html = (props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html;
    if (html) out.push(html);
  }
  for (const v of Object.values(props)) donneesStructurees(v, out);
  return out;
}

const rendreHub = (locale = "fr") => DevenirCommercialHub({ params: Promise.resolve({ locale }) });
const rendreMemo = () => MemoIserePage({ params: Promise.resolve({ locale: "fr" }) });

/** Les éléments JsonLd de l'arbre (props complètes), pour lire `strategy` et `data`. */
function jsonLdElements(noeud: unknown, out: Array<Record<string, unknown>> = []) {
  if (Array.isArray(noeud)) {
    for (const n of noeud) jsonLdElements(n, out);
    return out;
  }
  if (!isValidElement(noeud)) return out;
  const props = noeud.props as Record<string, unknown>;
  if (noeud.type === JsonLd) out.push(props);
  for (const v of Object.values(props)) jsonLdElements(v, out);
  return out;
}

const INTERDITES_JSON =
  /baseSalary|incentiveCompensation|MonetaryAmount|jobBenefits|workHours|validThrough/;
const MOTS_INTERDITS =
  /\bposte\b|emploi|recrut|embauch|commercial|déplafonn|plafond|freelance|aucun gain garanti/i;

async function lireJobPosting(): Promise<Record<string, unknown>> {
  const trouves = (await donneesStructurees(await rendreHub()))
    .filter((j) => j.includes('"@type":"JobPosting"'))
    .map((j) => JSON.parse(j) as Record<string, unknown>);
  expect(trouves).toHaveLength(1);
  return trouves[0]!;
}

describe("JobPosting prudent des apporteurs d'affaires", () => {
  it("/fr/memo-isere : aucun JobPosting, mais ses autres données structurées", async () => {
    const jsonLd = donneesStructurees(await rendreMemo());
    expect(jsonLd.some((j) => j.includes('"@type":"WebPage"'))).toBe(true);
    for (const j of jsonLd) {
      expect(j).not.toContain("JobPosting");
      expect(j).not.toContain("hiringOrganization");
    }
  });

  it("/fr/devenir-commercial-ia : exactement un JobPosting, aux valeurs décidées", async () => {
    const j = await lireJobPosting();
    expect(j["@context"]).toBe("https://schema.org");
    expect(j.title).toBe("Apporteur d'affaires indépendant");
    expect(j.employmentType).toBe("CONTRACTOR");
    expect(j.hiringOrganization).toEqual(JSON.parse(JSON.stringify(HIRING_ORG)));
    expect(j.datePosted).toBe(APPORTEUR_JOB_POSTING_DATE_POSTED);
    expect(j.jobLocationType).toBe("TELECOMMUTE");
    expect(j.applicantLocationRequirements).toEqual({
      "@type": "Country",
      name: "France",
      identifier: "FR",
    });
    expect(j.directApply).toBe(true);
    expect(j.url).toBe(`${SITE_URL}/fr/devenir-commercial-ia`);
    expect(j.identifier).toMatchObject({
      name: "Axion-IA",
      value: "apporteur-affaires-independant",
    });
  });

  it("aucune rémunération, avantage, horaire ni date de fin balisés", async () => {
    const brut = JSON.stringify(await lireJobPosting());
    expect(brut).not.toMatch(INTERDITES_JSON);
    expect(brut).not.toContain("occupationalCategory");
  });

  it("la description dit le cadre, sans montant ni vocabulaire d'emploi", async () => {
    const d = String((await lireJobPosting()).description);
    for (const phrase of [
      "indépendant",
      "réglé sa facture",
      "pas d’horaires",
      "pas d’exclusivité",
      "aucun revenu n’est promis",
    ]) {
      expect(d).toContain(phrase);
    }
    expect((d.match(/<p>/g) ?? []).length).toBe(4);
    expect(d).not.toMatch(/\d\s*€/);
    expect(d).not.toMatch(MOTS_INTERDITS);
    expect(d).not.toMatch(/déplacement|dossier de 3 minutes/i);
    const surface = [{ chemin: "jobposting-apporteur", texte: d }];
    expect(fautesDeRemuneration(surface)).toEqual([]);
    expect(fautesDeVocabulaire(surface)).toEqual([]);
  });

  it("le JsonLd est inline (aucune strategy), au bon identifiant", async () => {
    const el = jsonLdElements(await rendreHub()).find(
      (p) => p.scriptId === "jsonld-commercial-jobposting",
    );
    expect(el).toBeDefined();
    expect((el!.strategy as string | undefined) ?? "inline").toBe("inline");
  });

  it("locale en : aucun JobPosting", () => {
    expect(buildApporteurJobPostingJsonLd("en")).toBeNull();
  });

  it("la date publiée est celle que surveille le cron de fraîcheur", async () => {
    expect(STATIC_JOB_POSTINGS).toHaveLength(1);
    expect(STATIC_JOB_POSTINGS[0]!.path).toBe("/fr/devenir-commercial-ia");
    expect((await lireJobPosting()).datePosted).toBe(STATIC_JOB_POSTINGS[0]!.datePosted);
  });

  it("garde globale : « JobPosting » n'est écrit que dans src/lib/seo/job-posting*.ts", () => {
    const fautifs: string[] = [];
    const parcourir = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const chemin = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "__tests__" || e.name === "node_modules") continue;
          parcourir(chemin);
        } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(spec|test)\./.test(e.name)) {
          const rel = chemin.replace(process.cwd() + "/", "");
          if (/^src\/lib\/seo\/job-posting[^/]*\.ts$/.test(rel)) continue;
          const code = readFileSync(chemin, "utf8")
            .split("\n")
            .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
            .join("\n");
          if (/["'`]JobPosting["'`]/.test(code)) fautifs.push(rel);
        }
      }
    };
    parcourir(join(process.cwd(), "src"));
    expect(fautifs).toEqual([]);
  });
});
