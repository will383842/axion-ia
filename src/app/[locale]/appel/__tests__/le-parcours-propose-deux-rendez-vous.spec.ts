// @vitest-environment node

/**
 * Verrou — le parcours `/appel` propose DEUX rendez-vous, et chaque écran suit
 * le type choisi (chantier « Types de rendez-vous », lot L2, 2026-10-04).
 *
 * La logique (choix, repli, report, `utm_content`) est éprouvée dans
 * `server/calendly/__tests__/le-parcours-suit-le-rendez-vous-choisi.spec.ts`.
 * Ce fichier garde le CÂBLAGE des pages, qu'aucun test unitaire ne voit :
 * une page qui relirait `NEXT_PUBLIC_CALENDLY_APPEL_URL` en direct ouvrirait le
 * calendrier du type appel à qui a choisi le diagnostic — sans aucune erreur.
 *
 * Limite assumée : c'est une garde de texte. Elle ne rend pas la page ; la
 * vérification visuelle (375 px, CLS) se fait en production.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function lire(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8");
}

/** Le code sans ses commentaires : on mesure ce qui s'exécute et s'affiche. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const PAGE = "src/app/[locale]/appel/page.tsx";
const PARCOURS = [
  PAGE,
  "src/app/[locale]/appel/reserver/page.tsx",
  "src/app/[locale]/appel/reserver/actions.ts",
  "src/app/[locale]/appel/reporter/page.tsx",
  "src/app/[locale]/appel/reporter/actions.ts",
  "src/app/[locale]/appel/confirme/page.tsx",
  "src/app/api/internal/calendly-availability/route.ts",
] as const;

const page = sansCommentaires(lire(PAGE));

describe("🔑 /appel montre le choix, puis le bon calendrier", () => {
  it("contre-témoin : la page survit au filtre", () => {
    expect(page).toContain("AppelPage");
    expect(page.length).toBeGreaterThan(2000);
  });

  it("le paramètre `rdv` décide de l'écran", () => {
    expect(page).toContain("lireChoixRendezVous(sp[PARAM_RDV])");
    expect(page).toMatch(/choix \? \(\s*<Calendrier/);
    expect(page).toContain("<ChoixDuRendezVous");
  });

  it("les deux rendez-vous sont nommés, le diagnostic EN PREMIER et en bouton plein", () => {
    const diag = page.indexOf('data-cta="appel_choix_diagnostic"');
    const projet = page.indexOf('data-cta="appel_choix_projet"');
    expect(diag).toBeGreaterThan(-1);
    expect(projet).toBeGreaterThan(diag);
    expect(page).toContain("Diagnostic IA");
    expect(page).toContain("Échange projet");
    // Le bouton du diagnostic est le bouton PLEIN (couleur de marque).
    const boutonDiag = page.slice(page.lastIndexOf("<a", diag), diag + 400);
    expect(boutonDiag).toContain("bg-terracotta");
  });

  it("un lien discret permet de changer de rendez-vous", () => {
    expect(page).toContain('data-cta="appel_changer_de_rendez_vous"');
  });

  it("le widget et la capture reçoivent l'URL RÉSOLUE et le bouton", () => {
    expect(page).toContain("calendlyUrl={resolu.url}");
    expect(page).toContain("utmContent={utmContent}");
    expect(page).toContain("parametresDuChoix={parametresDuChoix(choix, depuis, suivi)}");
    expect(page).toMatch(/<CalendlyEventCapture calendlyUrl=\{resolu\.url\}/);
    expect(page).toContain("trackingContext.utmContent = utmContentDuChoix(choix, depuis)");
  });

  it("le choix est rendu côté serveur : aucune directive client sur la page", () => {
    expect(lire(PAGE)).not.toMatch(/^["']use client["']/m);
    expect(page).not.toContain("StickyMobileCta");
  });

  it("aucune durée écrite en dur sur la page : elles viennent de Calendly", () => {
    expect(page).not.toMatch(/\b(30|45) ?min/);
  });
});

describe("🔴 aucune page du parcours ne relit l'URL Calendly en direct", () => {
  it.each(PARCOURS)("%s passe par choix-rendez-vous", (chemin) => {
    const code = sansCommentaires(lire(chemin));
    expect(code).not.toMatch(/process\.env\.NEXT_PUBLIC_CALENDLY/);
  });

  it("le report reprogramme sur le type d'ORIGINE", () => {
    for (const chemin of [
      "src/app/[locale]/appel/reporter/page.tsx",
      "src/app/[locale]/appel/reporter/actions.ts",
    ]) {
      const code = sansCommentaires(lire(chemin));
      expect(code).toContain("urlDeReprogrammation(rdv)");
      expect(code).toContain("eventTypeUri: true");
      expect(code).toContain("typeRendezVous: true");
    }
  });

  it("le formulaire maison réserve le type choisi et envoie le bouton", () => {
    const actions = sansCommentaires(lire("src/app/[locale]/appel/reserver/actions.ts"));
    expect(actions).toContain("resoudreChoix(choix)");
    expect(actions).toContain(
      "utmContent: choixExplicite ? utmContentDuChoix(choixExplicite, depuis) : null",
    );
    const pageReserver = sansCommentaires(lire("src/app/[locale]/appel/reserver/page.tsx"));
    expect(pageReserver).toContain("resoudreEventTypePourReservation(resolu.url)");
    expect(pageReserver).toContain("champsCaches=");
  });
});

describe("🔑 /appel/confirme suit le type", () => {
  const confirme = sansCommentaires(lire("src/app/[locale]/appel/confirme/page.tsx"));

  it("le type vient de Calendly (URI du type), à défaut du choix transmis", () => {
    expect(confirme).toContain("classerRendezVous(");
    expect(confirme).toContain('lireChoixRendezVous(sp["rdv"])');
  });

  it("le diagnostic se prépare", () => {
    expect(confirme).toMatch(/type === "diagnostic"[\s\S]{0,200}Préparez/);
  });
});
