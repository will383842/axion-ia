/**
 * Alignement de l'offre sur La Journée IA (audit SEO/GEO du 11/11/2026).
 *
 * `/fr/audit`, `/fr/formations/ia-pour-bien-commencer-journee` et `/fr/tarifs` se
 * concurrençaient sur « audit / formation IA PME » et contredisaient la landing
 * `/fr/journee-ia` (rapport « sous 7 jours », « formation 1 jour sur devis »,
 * « audits, coaching… »). Décision de Williams : on GARDE ces pages, on les aligne,
 * et elles renvoient à La Journée IA. Le Tour France IA est hors de ce périmètre.
 *
 * Ce test garantit, sur ces trois pages :
 *   · la présence du lien vers `/fr/journee-ia` (et d'un rendez-vous `depuis=`) ;
 *   · aucune occurrence de « 7 jours » (le rapport arrive sous 3 jours ouvrés) ;
 *   · aucun montant hors jeton (le seul prix public est celui de La Journée IA,
 *     lu dans `pricing.ts`) ;
 *   · aucun mot interdit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";
import { prixDeLaJournee } from "@/app/[locale]/journee-ia/prix";
import {
  CHEMIN_JOURNEE_IA,
  DEROULE_JOURNEE_IA,
  EN_BREF_JOURNEE_IA_PARAGRAPHES,
  GARANTIE_PHRASE,
  RAPPORT_COMPLET,
  lienDiagnostic,
} from "@/content/journee-ia-commun";
import { phrasePrixJourneeIa, texteDuRenvoi } from "@/content/renvoi-journee-ia";
import { getFormationV2 } from "@/content/formations/catalog-v2";

const RACINE = process.cwd();
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");

/** Retire les commentaires : seuls les textes servis comptent. */
function sansCommentaires(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

const PAGE_AUDIT = "src/app/[locale]/audit/page.tsx";
const PAGE_TARIFS = "src/app/[locale]/tarifs/page.tsx";
const COMPOSANT_RENVOI = "src/components/sections/RenvoiJourneeIa.tsx";
const FICHE_FORMATION = "src/components/formations/FormationDetailPage.tsx";
/** Les composants du hub /audit dont le texte a été aligné. */
const COMPOSANTS_AUDIT = [
  "AuditHero",
  "AuditWhyAudit",
  "AuditProcessFlow",
  "AuditContactBand",
  "AuditBenefits",
  "AuditAudience",
  "AuditWhyChooseUs",
  "AuditRealisations",
  "AuditTrustPills",
  "AuditWhyNow",
  "AuditFaq",
  "AuditCtaBlock",
].map((c) => `src/components/services/audit/${c}.tsx`);

const formation = getFormationV2("ia-pour-bien-commencer-journee");

/** Le texte servi par la fiche formation qui est propre à cette formation. */
function texteFormation(): string {
  if (!formation) return "";
  return [
    formation.titreFr,
    formation.h1Fr,
    formation.accrocheFr,
    formation.metaTitleFr,
    formation.metaDescriptionFr,
    formation.renvoiJourneeIa?.precisionFr ?? "",
    texteDuRenvoi(formation.renvoiJourneeIa?.precisionFr),
  ].join("\n");
}

const MOTS_INTERDITS: ReadonlyArray<RegExp> = [
  /conform/i,
  /certifi/i,
  /qualiopi/i,
  /\bCPF\b/,
  /\bOPCO\b/i,
  /financement/i,
  /amende/i,
  /offert/i,
  /\bETI\b/,
  /TPE\s?\/\s?PME/,
  /\bSaaS\b/,
  /no-code/i,
  /grenoble/i,
  /freelance/i,
];

describe("lien vers /fr/journee-ia sur les trois pages", () => {
  it("le chemin est déclaré au routage, donc servi en /fr/journee-ia", () => {
    expect(CHEMIN_JOURNEE_IA).toBe("/journee-ia");
    expect(Object.keys(routing.pathnames)).toContain("/journee-ia");
  });

  it("le bloc de renvoi porte le lien et un rendez-vous `depuis=` explicite", () => {
    const src = sansCommentaires(lire(COMPOSANT_RENVOI));
    expect(src).toMatch(/href=\{CHEMIN_JOURNEE_IA\}/);
    expect(src).toMatch(/href=\{lienDiagnostic\(depuis\)\}/);
    expect(lienDiagnostic("page-audit-renvoi")).toBe(
      "/appel?rdv=diagnostic&depuis=page-audit-renvoi",
    );
  });

  it("/fr/audit : le bloc suit le héros (qui porte le h1), avec son emplacement", () => {
    const src = sansCommentaires(lire(PAGE_AUDIT));
    const renvoi = src.indexOf("<RenvoiJourneeIa");
    expect(renvoi).toBeGreaterThan(-1);
    expect(renvoi).toBeGreaterThan(src.indexOf("<AuditHero"));
    expect(src).toMatch(/depuis="page-audit-renvoi"/);
  });

  it("/fr/formations/ia-pour-bien-commencer-journee : la fiche pose le bloc après le h1", () => {
    expect(formation?.renvoiJourneeIa?.depuis).toBe("formation-journee-complete-renvoi");
    const src = sansCommentaires(lire(FICHE_FORMATION));
    const renvoi = src.indexOf("<RenvoiJourneeIa");
    expect(renvoi).toBeGreaterThan(-1);
    expect(renvoi).toBeGreaterThan(src.indexOf("<h1"));
  });

  it("/fr/tarifs : La Journée IA en tête (héros et première section), avec son lien", () => {
    const src = sansCommentaires(lire(PAGE_TARIFS));
    expect(src).toMatch(/title=\{isFr \? "La Journée IA :" : "The AI Day:"\}/);
    expect(src).toMatch(/titleEm=\{prixJournee\}/);
    expect(src).toMatch(/href=\{CHEMIN_JOURNEE_IA\}/);
    expect(src).toMatch(/lienDiagnostic\("tarifs-heros"\)/);
    expect(src.indexOf('id="journee-ia"')).toBeLessThan(src.indexOf("{cartes.map("));
  });
});

describe("le rapport : sous 3 jours ouvrés, jamais « 7 jours »", () => {
  const SEPT_JOURS = /\b7\s?jours\b|\bsept jours\b|\b7\s?days\b/i;

  it("le bloc de renvoi dit 3 jours ouvrés", () => {
    expect(RAPPORT_COMPLET).toMatch(/sous 3 jours ouvrés/i);
    expect(texteDuRenvoi()).toContain(RAPPORT_COMPLET);
  });

  it("aucune page ni aucun composant aligné ne dit « 7 jours »", () => {
    for (const f of [PAGE_AUDIT, PAGE_TARIFS, COMPOSANT_RENVOI, ...COMPOSANTS_AUDIT]) {
      expect(sansCommentaires(lire(f)), f).not.toMatch(SEPT_JOURS);
    }
    expect(texteFormation()).not.toMatch(SEPT_JOURS);
    expect(texteDuRenvoi()).not.toMatch(SEPT_JOURS);
  });
});

describe("un seul prix public : celui de La Journée IA, lu dans pricing.ts", () => {
  const MONTANT = /\d[\d\s  .,]*\s?(€|k€|euros?\b|EUR\b)/i;

  it("le bloc de renvoi n'affiche que le jeton", () => {
    expect(phrasePrixJourneeIa()).toContain(prixDeLaJournee());
    const sansJeton = texteDuRenvoi().split(prixDeLaJournee()).join("");
    expect(sansJeton).not.toMatch(MONTANT);
    expect(sansJeton).not.toMatch(/\bHT\b/);
  });

  it("aucun montant écrit dans les sources des pages et composants alignés", () => {
    for (const f of [PAGE_AUDIT, PAGE_TARIFS, COMPOSANT_RENVOI, ...COMPOSANTS_AUDIT]) {
      expect(sansCommentaires(lire(f)), f).not.toMatch(MONTANT);
    }
  });

  it("/fr/tarifs ne formate aucun autre prix que celui de La Journée IA", () => {
    const src = sansCommentaires(lire(PAGE_TARIFS));
    expect(src).not.toMatch(/formatPricePublic|formatPrice\(|formatAmount|formatMontantPublic/);
    for (const m of src.matchAll(/formatTierPrice\(([A-Z_]+)/g)) {
      expect(m[1]).toBe("JOURNEE_IA_TIER");
    }
    // L'ancienne formulation « audits, coaching… » ne revient pas.
    expect(src).not.toMatch(/audits, coaching/i);
    expect(src).toMatch(/Sur devis écrit/);
  });

  it("la fiche formation n'écrit aucun montant", () => {
    expect(texteFormation().split(prixDeLaJournee()).join("")).not.toMatch(MONTANT);
  });

  it("la garantie est reprise mot pour mot, et le déroulé vient du « En bref »", () => {
    expect(texteDuRenvoi()).toContain(GARANTIE_PHRASE);
    expect(DEROULE_JOURNEE_IA).toBe(EN_BREF_JOURNEE_IA_PARAGRAPHES[1]);
  });
});

describe("aucun mot interdit sur les trois pages", () => {
  /** Les clés internes « ETI » (segments, jamais affichées) ne sont pas du texte servi. */
  const sansClesInternes = (src: string) =>
    src
      .replace(/"ETI"/g, '""')
      .replace(/^\s*ETI:/gm, "x:")
      .replace(/strategique-eti/g, "");

  const surfaces = (): ReadonlyArray<readonly [string, string]> => [
    ["renvoi", texteDuRenvoi()],
    ["formation", texteFormation()],
    ...[PAGE_AUDIT, PAGE_TARIFS, COMPOSANT_RENVOI, ...COMPOSANTS_AUDIT].map(
      (f) => [f, sansClesInternes(sansCommentaires(lire(f)))] as const,
    ),
  ];

  it("ni conformité, certification, Qualiopi, CPF, OPCO, financement, amende, offert, ETI, TPE/PME, SaaS, no-code, Grenoble", () => {
    const fautes: string[] = [];
    for (const [nom, texte] of surfaces()) {
      for (const motif of MOTS_INTERDITS) {
        const m = texte.match(motif);
        if (m) fautes.push(`${nom} : ${String(motif)} → « ${m[0]} »`);
      }
    }
    expect(fautes).toEqual([]);
  });
});
