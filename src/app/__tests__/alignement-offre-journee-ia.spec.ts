/**
 * Alignement de l'offre sur La Journée IA (audit SEO/GEO du 11/11/2026).
 *
 * `/fr/audit`, `/fr/formations/ia-pour-bien-commencer-journee`, `/fr/tarifs` et la
 * landing du Tour France IA se concurrençaient sur « audit / formation IA PME » et
 * contredisaient la landing `/fr/journee-ia` (rapport « sous 7 jours », « formation
 * 1 jour sur devis », « audits, coaching… », « journée offerte »). Décision de
 * Williams : on GARDE ces pages, on les aligne, et elles renvoient à La Journée IA.
 *
 * Ce test garantit, sur ces quatre pages :
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
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import { GARANTIE_PHRASE } from "@/content/journee-ia-commun";
import {
  CHEMIN_JOURNEE_IA,
  GARANTIE_RENVOI,
  RAPPORT_JOURNEE_IA,
  lienRendezVousJourneeIa,
  prixJourneeIa,
  texteDuRenvoi,
} from "@/content/renvoi-journee-ia";
import { getFormationV2 } from "@/content/formations/catalog-v2";
import { LIEN_OFFRE, toutLeTexte as toutLeTexteDuTour } from "@/app/tour-france-ia/contenu";
import { jsonLdDuTour } from "@/app/tour-france-ia/jsonld";

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

describe("lien vers /fr/journee-ia sur les quatre pages", () => {
  it("le chemin est déclaré au routage, donc servi en /fr/journee-ia", () => {
    expect(CHEMIN_JOURNEE_IA).toBe("/journee-ia");
    expect(Object.keys(routing.pathnames)).toContain("/journee-ia");
  });

  it("le bloc de renvoi porte le lien et un rendez-vous `depuis=` explicite", () => {
    const src = sansCommentaires(lire(COMPOSANT_RENVOI));
    expect(src).toMatch(/href=\{CHEMIN_JOURNEE_IA\}/);
    expect(src).toMatch(/href=\{lienRendezVousJourneeIa\(depuis\)\}/);
    expect(lienRendezVousJourneeIa("page-audit-renvoi")).toBe(
      "/appel?rdv=diagnostic&depuis=page-audit-renvoi",
    );
  });

  it("/fr/audit : le bloc est en tête, avant le héros, avec son emplacement", () => {
    const src = sansCommentaires(lire(PAGE_AUDIT));
    const renvoi = src.indexOf("<RenvoiJourneeIa");
    expect(renvoi).toBeGreaterThan(-1);
    expect(renvoi).toBeLessThan(src.indexOf("<AuditHero"));
    expect(src).toMatch(/depuis="page-audit-renvoi"/);
  });

  it("/fr/formations/ia-pour-bien-commencer-journee : la fiche pose le bloc en tête", () => {
    expect(formation?.renvoiJourneeIa?.depuis).toBe("formation-journee-complete-renvoi");
    const src = sansCommentaires(lire(FICHE_FORMATION));
    const renvoi = src.indexOf("<RenvoiJourneeIa");
    expect(renvoi).toBeGreaterThan(-1);
    expect(renvoi).toBeLessThan(src.indexOf("<h1"));
  });

  it("/fr/tarifs : La Journée IA en tête (héros et première section), avec son lien", () => {
    const src = sansCommentaires(lire(PAGE_TARIFS));
    expect(src).toMatch(/title=\{isFr \? "La Journée IA :" : "The AI Day:"\}/);
    expect(src).toMatch(/titleEm=\{prixJournee\}/);
    expect(src).toMatch(/href=\{CHEMIN_JOURNEE_IA\}/);
    expect(src).toMatch(/lienRendezVousJourneeIa\("tarifs-heros"\)/);
    expect(src.indexOf('id="journee-ia"')).toBeLessThan(src.indexOf("{cartes.map("));
  });

  it("/tour-france-ia : le lien vers /fr/journee-ia, sous la promesse et dans le pied", () => {
    expect(LIEN_OFFRE.href).toBe("https://axion-ia.com/fr/journee-ia");
    expect(toutLeTexteDuTour()).toMatch(/axion-ia\.com\/fr\/journee-ia/);
    expect(sansCommentaires(lire("src/app/tour-france-ia/page.tsx"))).toMatch(
      /href=\{LIEN_OFFRE\.href\}/,
    );
  });
});

describe("le rapport : sous 3 jours ouvrés, jamais « 7 jours »", () => {
  const SEPT_JOURS = /\b7\s?jours\b|\bsept jours\b|\b7\s?days\b/i;

  it("le bloc de renvoi dit 3 jours ouvrés", () => {
    expect(RAPPORT_JOURNEE_IA).toMatch(/sous 3 jours ouvrés/);
  });

  it("aucune page ni aucun composant aligné ne dit « 7 jours »", () => {
    for (const f of [PAGE_AUDIT, PAGE_TARIFS, COMPOSANT_RENVOI, ...COMPOSANTS_AUDIT]) {
      expect(sansCommentaires(lire(f)), f).not.toMatch(SEPT_JOURS);
    }
    expect(texteFormation()).not.toMatch(SEPT_JOURS);
    expect(toutLeTexteDuTour()).not.toMatch(SEPT_JOURS);
    expect(texteDuRenvoi()).not.toMatch(SEPT_JOURS);
  });
});

describe("un seul prix public : celui de La Journée IA, lu dans pricing.ts", () => {
  const MONTANT = /\d[\d\s  .,]*\s?(€|k€|euros?\b|EUR\b)/i;

  it("le bloc de renvoi n'affiche que le jeton", () => {
    expect(prixJourneeIa()).toBe(formatTierPrice(JOURNEE_IA_TIER, "fr"));
    const sansJeton = texteDuRenvoi().split(prixJourneeIa()).join("");
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

  it("la fiche formation et le Tour n'écrivent aucun montant", () => {
    expect(texteFormation().split(prixJourneeIa()).join("")).not.toMatch(MONTANT);
    expect(toutLeTexteDuTour()).not.toMatch(MONTANT);
    expect(JSON.stringify(jsonLdDuTour())).not.toMatch(/"price"/);
  });

  it("la garantie est reprise mot pour mot", () => {
    expect(GARANTIE_RENVOI).toBe(GARANTIE_PHRASE);
  });
});

describe("aucun mot interdit sur les quatre pages", () => {
  /** Les clés internes « ETI » (segments, jamais affichées) ne sont pas du texte servi. */
  const sansClesInternes = (src: string) =>
    src
      .replace(/"ETI"/g, '""')
      .replace(/^\s*ETI:/gm, "x:")
      .replace(/strategique-eti/g, "");

  const surfaces = (): ReadonlyArray<readonly [string, string]> => [
    ["renvoi", texteDuRenvoi()],
    ["formation", texteFormation()],
    ["tour", toutLeTexteDuTour()],
    ["tour JSON-LD", JSON.stringify(jsonLdDuTour())],
    ["tour image", lire("src/app/tour-france-ia/opengraph-image.alt.txt")],
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

  it("aucune gratuité promise sur le Tour", () => {
    expect(toutLeTexteDuTour()).not.toMatch(/gratuit/i);
  });
});
