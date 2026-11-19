// @vitest-environment node

/**
 * Verrou — UN SEUL rendez-vous gratuit de 45 minutes, dit pareil partout sur le site
 * HORS Tour France IA (chantier séparé : ni sa landing, ni son type de réservation,
 * ni sa vue console ne sont couverts ni modifiés ici)
 * (audit harmonie A08, décision n° 12 ; règle r10 du Brain, décidée par Williams le 07/11/2026).
 *
 * - le type `diagnostic` change de LIBELLÉ seulement (clés, routes, slugs, types inchangés) ;
 * - un ancien lien `?rdv=projet` s'affiche comme le Diagnostic IA gratuit, sans toucher
 *   au report ni à l'annulation d'un échange projet déjà réservé.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CHOIX_PUBLICS, TYPES_RESERVABLES } from "@/server/calendly/types-reservables";

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("🔑 le type `diagnostic` est le rendez-vous gratuit de 45 minutes (règle r10 du Brain)", () => {
  const diag = TYPES_RESERVABLES.diagnostic;
  it("libellés changés, identifiants intacts", () => {
    expect(diag.nom).toBe("Diagnostic IA gratuit");
    expect(diag.titre).toBe("Votre diagnostic IA gratuit");
    expect(diag.promesse).toMatch(/45 minutes/);
    expect(diag.promesse).toMatch(/gratuit/i);
    expect(diag.promesse).toMatch(/sans engagement/i);
    expect(diag.choix).toBe("diagnostic");
    expect(diag.route).toBe("diagnostic");
    expect(diag.type).toBe("diagnostic");
  });
  it("le type `projet` garde son nom et son titre d'origine (rendez-vous déjà réservés)", () => {
    const projet = TYPES_RESERVABLES.projet;
    expect(projet.nom).toBe("Échange projet");
    expect(projet.titre).toBe("Votre échange projet");
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

describe("🔑 /appel : l'ancien échange projet s'affiche comme le Diagnostic IA gratuit", () => {
  const page = sansCommentaires(lire("src/app/[locale]/appel/page.tsx"));

  it("`projet` est rabattu sur `diagnostic` à l'affichage", () => {
    expect(page).toMatch(/=== "projet" \? "diagnostic"/);
  });

  it("`depuis` et les UTM suivent le choix rabattu (même variables)", () => {
    expect(page).toContain("parametresDuChoix(choix, depuis, suivi)");
    expect(page).toContain("utmContentDuChoix(choix, depuis)");
  });

  it("report et annulation ne passent pas par ce rabat (type d'ORIGINE du rendez-vous, y compris un échange projet déjà réservé)", () => {
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

  it("la carte annonce 45 minutes en dur ; la durée Calendly ne sert qu'au calendrier", () => {
    const carte = page.slice(
      page.indexOf("function ChoixDuRendezVous"),
      page.indexOf("function Calendrier"),
    );
    expect(carte).toContain("Gratuit · 45 minutes · Sans engagement");
    expect(carte).not.toContain("libelleDuree");
    expect(page).toContain("const duree = libelleDuree(resolu)");
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

describe("🔑 /appel/echange-projet : le titre suit le corps (Diagnostic IA gratuit)", () => {
  const route = sansCommentaires(lire("src/app/[locale]/appel/[type]/page.tsx"));
  it("generateMetadata rabat `projet` vers `diagnostic` avant de lire le nom", () => {
    expect(route).toMatch(/brut === "projet" \? "diagnostic" : brut/);
    expect(route).toMatch(/configDuChoix\(choix\)\.nom/);
    expect(TYPES_RESERVABLES.diagnostic.nom).toBe("Diagnostic IA gratuit");
  });
});

describe("🔑 la durée de repli du formulaire de réservation vaut 45 minutes", () => {
  const reserver = sansCommentaires(lire("src/app/[locale]/appel/reserver/page.tsx"));
  it("DUREE_DEFAUT = 45, et c'est elle qui alimente le formulaire", () => {
    expect(reserver).toMatch(/const DUREE_DEFAUT = 45;/);
    expect(reserver).toMatch(/dureeMinutes=\{et\.dureeMinutes \?\? DUREE_DEFAUT\}/);
  });
});

describe("🔑 le texte public dit « en visio ou par téléphone », comme Calendly", () => {
  it("cartes, étape 1, promesse, consigne", () => {
    expect(TYPES_RESERVABLES.diagnostic.promesse).toMatch(/visio ou par téléphone/);
    expect(TYPES_RESERVABLES.diagnostic.premiereEtape).toMatch(/ou par téléphone/);
    expect(TYPES_RESERVABLES.tour.premiereEtape).not.toMatch(/téléphone/);
    expect(lire("src/app/[locale]/appel/page.tsx")).toContain(
      "Visio ou téléphone · sans engagement",
    );
    expect(lire("src/server/visio/consignes/commun.md")).toContain("en visio ou par téléphone");
  });
});
