// @vitest-environment node

/**
 * Verrou — UN SEUL rendez-vous gratuit de 45 minutes, dit pareil partout sur le site
 * HORS Tour France IA (chantier séparé : ni sa landing, ni son type de réservation,
 * ni sa vue console ne sont couverts ni modifiés ici)
 * (audit harmonie A08, décision n° 12 ; relecture Opus de la PR R5b).
 *
 * - le type `projet` change de LIBELLÉ seulement (clés, routes, slugs, types inchangés) ;
 * - un ancien lien `?rdv=diagnostic` s'affiche comme le rendez-vous de 45 min, sans toucher
 *   au report ni à l'annulation d'un diagnostic déjà réservé.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CHOIX_PUBLICS, TYPES_RESERVABLES } from "@/server/calendly/types-reservables";

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("🔑 le type `projet` est « Rendez-vous gratuit de 45 minutes »", () => {
  const projet = TYPES_RESERVABLES.projet;
  it("libellés changés, identifiants intacts", () => {
    expect(projet.nom).toBe("Rendez-vous gratuit de 45 minutes");
    expect(projet.titre).toBe("Votre rendez-vous gratuit");
    expect(projet.choix).toBe("projet");
    expect(projet.route).toBe("echange-projet");
    expect(projet.type).toBe("echange_projet");
  });
  it("aucun libellé public ne parle de 15, 20 ou 30 minutes", () => {
    for (const c of CHOIX_PUBLICS) {
      const t = TYPES_RESERVABLES[c];
      expect(`${t.titre} ${t.promesse}`).not.toMatch(/\b(15|20|30) ?min/);
    }
  });
});

describe("🔑 /appel : l'ancien diagnostic s'affiche comme le rendez-vous de 45 minutes", () => {
  const page = sansCommentaires(lire("src/app/[locale]/appel/page.tsx"));

  it("`diagnostic` est rabattu sur `projet` à l'affichage", () => {
    expect(page).toMatch(/=== "diagnostic" \? "projet"/);
  });

  it("`depuis` et les UTM suivent le choix rabattu (même variables)", () => {
    expect(page).toContain("parametresDuChoix(choix, depuis, suivi)");
    expect(page).toContain("utmContentDuChoix(choix, depuis)");
  });

  it("report et annulation ne passent pas par ce rabat (type d'ORIGINE du rendez-vous)", () => {
    for (const f of [
      "src/app/[locale]/appel/reporter/page.tsx",
      "src/app/[locale]/appel/reporter/actions.ts",
      "src/app/[locale]/appel/annuler/page.tsx",
      "src/app/[locale]/appel/annuler/actions.ts",
    ]) {
      expect(sansCommentaires(lire(f)), f).not.toContain("lireChoixRendezVous");
    }
  });

  it("« Changer de rendez-vous » n'existe que s'il reste plusieurs choix publics", () => {
    const i = page.indexOf('data-cta="appel_changer_de_rendez_vous"');
    expect(i).toBeGreaterThan(-1);
    expect(page.slice(Math.max(0, i - 500), i)).toMatch(/CHOIX_AFFICHES\.length > 1/);
  });

  it("la carte lit la durée de Calendly, avec 45 en repli", () => {
    expect(page).toContain("libelleDuree(resolus.projet)");
    expect(page).toContain("DUREE_REPLI_MINUTES");
  });

  it("le JSON-LD et la meta disent « l'équipe », comme l'encart visible", () => {
    expect(page).not.toMatch(/avec Williams/);
    expect(page).toContain("avec l’équipe d’Axion-IA");
  });
});

describe("🔑 FAQ et stack-ia : 45 minutes, et le bouton mène au rendez-vous gratuit", () => {
  const FICHIERS = [
    "src/app/[locale]/faq/page.tsx",
    "src/app/[locale]/faq/par-thematique/page.tsx",
    "src/app/[locale]/faq/par-thematique/[categorie]/page.tsx",
    "src/app/[locale]/stack-ia/page.tsx",
    "src/app/[locale]/stack-ia/[tool]/page.tsx",
  ];

  it.each(FICHIERS)("%s : aucune durée de 15, 20 ou 30 minutes pour le rendez-vous", (f) => {
    const code = lire(f);
    expect(code).not.toMatch(/\b(15|20|30)[ -]?(minutes?|min)\b/i);
    expect(code).not.toMatch(/quart d'heure|demi-heure/i);
  });

  it.each(["src/app/[locale]/stack-ia/page.tsx", "src/app/[locale]/stack-ia/[tool]/page.tsx"])(
    "%s : le CTA de fin est « Réserver mon rendez-vous gratuit » vers /appel",
    (f) => {
      const code = lire(f);
      expect(code).not.toContain("Réserver l'audit flash");
      expect(code).toContain("Réserver mon rendez-vous gratuit");
      expect(code).toMatch(
        /<Cta href="\/appel" size="lg">\s*\{isFr \? "Réserver mon rendez-vous gratuit"/,
      );
    },
  );
});
