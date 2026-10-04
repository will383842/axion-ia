// @vitest-environment node

/**
 * Chaque porte vers `/appel` dit D'OÙ l'on vient (chantier « Types de
 * rendez-vous », lot L5a, 2026-10-04).
 *
 * `?depuis=<emplacement>` est recopié dans `utm_content` (`diagnostic:accueil-hero`)
 * et revient dans nos colonnes : sans lui, on sait QUEL rendez-vous a été pris,
 * jamais QUEL bouton l'a fait prendre. Ce fichier garde :
 *   1. les liens principaux (accueil, en-tête, pied, chatbot, pages services)
 *      portent leur emplacement, au format accepté par `lireDepuis` ;
 *   2. AUCUN texte de bouton n'a changé, et aucun ne force `rdv=` (aucun ne
 *      parle de diagnostic : ils mènent à l'écran du choix) ;
 *   3. les e-mails mènent à `/appel` avec leur emplacement — l'e-mail salon ne
 *      pointe plus Calendly en direct ;
 *   4. le clic sur chaque carte du choix est mesuré dans Plausible, sans JS
 *      (classes `plausible-event-*` de l'extension `tagged-events` déjà chargée) ;
 *   5. la consigne du compte rendu visio dit les deux rendez-vous.
 *
 * Limite assumée : garde de texte, sur le modèle des autres verrous du parcours.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lireDepuis } from "@/server/calendly/choix-rendez-vous";

function lire(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8");
}

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

/** [fichier, emplacement, texte du bouton qui doit rester tel quel] */
const PORTES: ReadonlyArray<readonly [string, string, string]> = [
  ["src/app/[locale]/page.tsx", "accueil-hero", "Je réserve un appel"],
  ["src/app/[locale]/page.tsx", "accueil-final", "Réserver un appel"],
  ["src/app/[locale]/page.tsx", "accueil-mobile", "Échanger 45 min — sans engagement"],
  ["src/components/nav/Header.tsx", "entete", 't("cta.bookCall")'],
  ["src/components/nav/Header.tsx", "entete-mobile", 't("cta.bookCall")'],
  ["src/components/nav/Footer.tsx", "pied", "Réserver un appel"],
  ["src/components/services/audit/AuditHero.tsx", "page-audit", "Réserver un appel"],
  ["src/app/[locale]/formations/page.tsx", "page-formation", "Réserver un appel"],
  [
    "src/components/services/implementation/ImplementationContactBand.tsx",
    "page-integration",
    "Réserver un appel",
  ],
  ["src/app/[locale]/un-a-un/page.tsx", "page-coaching", "Réserver un appel"],
];

describe("🔑 chaque lien principal porte son emplacement", () => {
  it.each(PORTES)("%s → depuis=%s", (fichier, depuis, texte) => {
    expect(lireDepuis(depuis)).toBe(depuis);
    const code = sansCommentaires(lire(fichier));
    const forme = new RegExp(`/appel\\?depuis=${depuis}"|query: \\{ depuis: "${depuis}" \\}`);
    expect(code).toMatch(forme);
    expect(code).toContain(texte);
  });

  it("aucune porte ne force un rendez-vous : elles mènent toutes au choix", () => {
    for (const [fichier] of PORTES) {
      expect(sansCommentaires(lire(fichier))).not.toMatch(/\/appel\?rdv=|rdv: "/);
    }
  });

  it("le chatbot propose le choix, avec son emplacement", () => {
    const code = sansCommentaires(lire("src/server/chatbot/orchestrator.ts"));
    expect(code).toContain('const RDV_URL = "/fr/appel?depuis=chatbot"');
  });
});

describe("🔑 les e-mails mènent à /appel, avec leur emplacement", () => {
  it("e-mail salon : plus de lien Calendly direct, l'échange projet du site", () => {
    const code = sansCommentaires(lire("src/lib/email/templates/rdv-salon.tsx"));
    expect(code).not.toContain("calendly.com/axion-ia/premier-contact");
    expect(code).toContain("`${SITE_URL}/fr/appel?rdv=projet&depuis=email-salon`");
  });

  it("signature des e-mails : `depuis=email`", () => {
    const code = sansCommentaires(lire("src/lib/email/templates/_layout.tsx"));
    expect(code).toContain("const APPEL_URL = `${BASE_URL}/fr/appel?depuis=email`");
  });

  it("confirmation de contact : `depuis=email-contact`", () => {
    const code = sansCommentaires(lire("src/lib/email/templates/contact-confirmed.tsx"));
    expect(code).toContain(`"fr/appel"}?depuis=email-contact`);
    expect(lireDepuis("email-contact")).toBe("email-contact");
    expect(lireDepuis("email-salon")).toBe("email-salon");
  });
});

describe("🔑 le clic sur chaque carte est mesuré dans Plausible, sans JS", () => {
  const page = sansCommentaires(lire("src/app/[locale]/appel/page.tsx"));

  it.each(["diagnostic", "projet"])("carte %s", (choix) => {
    const i = page.indexOf(`data-cta="appel_choix_${choix}"`);
    expect(i).toBeGreaterThan(-1);
    const lien = page.slice(page.lastIndexOf("<a", i), page.indexOf(">", i));
    expect(lien).toContain("plausible-event-name=Appel+choix");
    expect(lien).toContain(`plausible-event-rdv=${choix}`);
  });

  it("le script Plausible charge bien l'extension des événements balisés", () => {
    expect(lire("src/components/analytics/Plausible.tsx")).toContain("tagged-events");
  });
});

describe("🔑 la consigne du compte rendu visio dit les deux rendez-vous", () => {
  const consigne = lire("src/server/visio/consignes/commun.md");

  it("Diagnostic IA 30 min, Échange projet 45 min", () => {
    expect(consigne).not.toContain("diagnostic » gratuit de 45 minutes");
    expect(consigne).toMatch(/Diagnostic IA[^.]*30 minutes/);
    expect(consigne).toMatch(/Échange projet[^.]*45 minutes/);
  });
});
