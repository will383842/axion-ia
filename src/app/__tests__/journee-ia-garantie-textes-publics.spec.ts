/**
 * Garantie et délai de la Journée IA : les textes publics disent la même chose que les CGV
 * (art. 47.1 (c) et 47.10), décision du dirigeant du 25/11/2026.
 *
 *   (a) aucun mot interdit (anciennes formulations de la garantie, mots de financement…) ;
 *   (b) le délai du rapport est UN seul nombre : `DELAI_RAPPORT_JOURS_OUVRES`, le même que dans
 *       l'art. 47 des CGV (lecture seule) et dans `OFFRE_JOURNEE_IA`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import { CONTENU as ACCUEIL } from "@/app/[locale]/_accueil/contenu";
import { CONTENU as JOURNEE } from "@/app/[locale]/journee-ia/contenu";
import { GET as llms } from "@/app/llms.txt/route";
import { GET as llmsFull } from "@/app/llms-full.txt/route";
import {
  CONDITION_GARANTIE,
  DEDUCTION_JOURNEE_IA,
  DELAI_RAPPORT_JOURS_OUVRES,
  DESCRIPTION_SERVICE_JOURNEE_IA,
  EN_BREF_ACCUEIL,
  EN_BREF_JOURNEE_IA,
  EN_BREF_JOURNEE_IA_PARAGRAPHES,
  GARANTIE,
  GARANTIE_PHRASE,
  RAPPORT_COMPLET,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import { getLegal } from "@/content/legal";
import { OFFRE_JOURNEE_IA } from "@/content/offre";
import { reponseReference } from "@/content/questions-reference";
import { texteDuRenvoi } from "@/content/renvoi-journee-ia";

const lire = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

/** Retire les commentaires : seuls les textes servis comptent. */
function sansCommentaires(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

/** La ligne (ou le passage) d'un fichier qui parle de la Journée IA. */
function lignesAvec(rel: string, motif: RegExp): string {
  return sansCommentaires(lire(rel))
    .split("\n")
    .filter((l) => motif.test(l))
    .join("\n");
}

/**
 * Les lignes d'un `llms*.txt` qui parlent de la Journée IA : le corps entier porte aussi le
 * glossaire (« valeur que 95 % des demandes ne dépassent pas »), sans rapport avec la garantie.
 */
const lignesJourneeIa = (corps: string) =>
  corps
    .split("\n")
    .filter((l) => /Journée IA|garantie|rapport complet/i.test(l))
    .join("\n");
const corpsLlms = lignesJourneeIa(await (await llms()).text());
const corpsLlmsFull = lignesJourneeIa(await (await llmsFull()).text());

const FICHIERS_SOURCE = [
  "src/app/[locale]/journee-ia/page.tsx",
  "src/app/[locale]/journee-ia/contenu.ts",
  "src/app/[locale]/_accueil/contenu.ts",
  "src/app/[locale]/audit/page.tsx",
  "src/components/services/audit/AuditFaq.tsx",
  "src/app/[locale]/implantations/[region]/[ville]/page.tsx",
  "src/app/[locale]/cartographie/contenu.ts",
  "src/app/[locale]/prix-audit-ia/contenu.ts",
  "src/content/villes/journee-ia-locale.ts",
  "src/content/offre.ts",
  "src/content/questions-reference.ts",
  "src/app/[locale]/tarifs/page.tsx",
];

const TEXTES: Record<string, string> = {
  GARANTIE,
  GARANTIE_PHRASE,
  CONDITION_GARANTIE,
  RAPPORT_COMPLET,
  DEDUCTION: remplacerJetons(DEDUCTION_JOURNEE_IA),
  EN_BREF_ACCUEIL,
  EN_BREF_JOURNEE_IA,
  EN_BREF_PARAGRAPHES: EN_BREF_JOURNEE_IA_PARAGRAPHES.join(" "),
  DESCRIPTION_SERVICE_JOURNEE_IA,
  CONTENU_JOURNEE_IA: JSON.stringify(JOURNEE),
  CONTENU_ACCUEIL: JSON.stringify(ACCUEIL),
  REPONSE_REF_PRIX: reponseReference("ref-journee-prix"),
  RENVOI: texteDuRenvoi(),
  OFFRE: JSON.stringify(OFFRE_JOURNEE_IA),
  LLMS_TXT: corpsLlms,
  LLMS_FULL_TXT: corpsLlmsFull,
  ...Object.fromEntries(FICHIERS_SOURCE.map((f) => [f, sansCommentaires(lire(f))])),
  "positionnement.ts (Journée IA)": lignesAvec(
    "src/server/content-gen/brand/positionnement.ts",
    /Journée IA|jours ouvrés/,
  ),
  "interventions-formations.ts (Journée IA)": lignesAvec(
    "src/server/content-gen/kb/interventions-formations.ts",
    /La Journée IA d'Axion-IA/,
  ),
};

const INTERDITS: ReadonlyArray<RegExp> = [
  /gagnez 3 fois le prix/i,
  /rentabilisée? le soir même/i,
  /×\s?3\b|\b3\s?×/,
  /gains? garantis?/i,
  /aucun gain garanti/i,
  /validés par vous/i,
  /sans discussion/i,
  /ne dépass(e|ent) pas/i,
  /Grenoble/i,
  /Qualiopi/i,
  /\bOPCO\b/i,
  /financement/i,
  /prise en charge/i,
  /cabinet de conseil/i,
  /\b\d+ (journées )?par mois/i,
  /sans (questionnaire|démarche)/i,
  /(chiffr\w+|remis\w*)[^.]{0,40}(pendant|à la fin de) la journée/i,
];

describe("Journée IA : aucun mot interdit dans les textes publics", () => {
  it("le périmètre n'est pas vide", () => {
    for (const [nom, t] of Object.entries(TEXTES)) expect(t.length, nom).toBeGreaterThan(20);
  });

  for (const re of INTERDITS) {
    it(`aucun texte ne contient ${re}`, () => {
      const fautes = Object.entries(TEXTES)
        .filter(([, t]) => re.test(t))
        .map(([nom]) => nom);
      expect(fautes).toEqual([]);
    });
  }

  it("GARANTIE_PHRASE dit « n'atteignent pas » ; le titre de garantie dit « gains identifiés »", () => {
    expect(GARANTIE_PHRASE).toMatch(/n[’']atteignent pas/);
    expect(JOURNEE.prix.titreGarantie).toContain("gains identifiés");
  });
});

describe("Journée IA : un seul délai de rapport", () => {
  const DELAI = /(\d+)\s?(?:jours ouvrés|business days)/gi;

  it("chaque délai écrit vaut DELAI_RAPPORT_JOURS_OUVRES", () => {
    let vus = 0;
    for (const [nom, t] of Object.entries(TEXTES)) {
      for (const m of t.matchAll(DELAI)) {
        vus += 1;
        expect(Number(m[1]), nom).toBe(DELAI_RAPPORT_JOURS_OUVRES);
      }
    }
    expect(vus).toBeGreaterThan(10);
  });

  it("le même nombre que l'art. 47 des CGV (lecture seule)", () => {
    const corps = getLegal("conditions-generales")
      .fr.sections.map((s) => s.body)
      .join("\n");
    const m = corps.match(/\(c\) un rapport écrit[\s\S]{0,200}?à défaut : (\d+) jours ouvrés/i);
    expect(m, "alinéa (c) de l'art. 47.1 introuvable").not.toBeNull();
    expect(Number(m![1])).toBe(DELAI_RAPPORT_JOURS_OUVRES);
  });

  it("OFFRE_JOURNEE_IA.deroule.rapportJoursOuvres est le même nombre", () => {
    expect(OFFRE_JOURNEE_IA.deroule.rapportJoursOuvres).toBe(DELAI_RAPPORT_JOURS_OUVRES);
  });
});
