// @vitest-environment node

/**
 * Verrou — chacun des quatre rendez-vous a sa page, et tous suivent le MÊME code
 * (2026-10-05).
 *
 * `/fr/appel/<type>` est une porte, pas une page de plus : elle traduit le segment
 * en choix et rend `/appel`. Ce fichier garde le câblage qu'aucun test unitaire ne
 * voit — c'est une garde de texte, qui ne rend pas la page ; la vérification
 * visuelle (375 px, CLS) se fait en production.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHOIX_PUBLICS,
  CHOIX_RENDEZ_VOUS,
  TYPES_RESERVABLES,
} from "@/server/calendly/types-reservables";

function lire(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8");
}
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const DOSSIER = "src/app/[locale]/appel";
const PORTE = `${DOSSIER}/[type]/page.tsx`;
const PAGE = `${DOSSIER}/page.tsx`;

describe("🔑 la porte `/appel/[type]`", () => {
  it("contre-témoin : elle existe et rend la page d'`/appel`", () => {
    expect(existsSync(join(process.cwd(), PORTE))).toBe(true);
    const code = sansCommentaires(lire(PORTE));
    expect(code).toContain('import AppelPage from "../page"');
    expect(code).toContain("choixDeLaRoute(type)");
    expect(code).toContain("[PARAM_RDV]: choix");
    expect(code).toContain("notFound()");
  });

  it("🔴 elle ne s'indexe pas (liens privés, et doublon des adresses publiques)", () => {
    const code = sansCommentaires(lire(PORTE));
    expect(code).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(code).toContain("export const revalidate = 900");
  });

  it("aucun segment ne masque une route voisine, et aucune route voisine ne masque un segment", () => {
    const voisins = readdirSync(join(process.cwd(), DOSSIER), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("_"))
      .map((d) => d.name);
    // Les quatre écrans de fin / de saisie existants.
    expect(voisins).toEqual(
      expect.arrayContaining(["reserver", "reporter", "confirme", "annuler"]),
    );
    for (const c of CHOIX_RENDEZ_VOUS) {
      expect(
        voisins,
        `le segment « ${TYPES_RESERVABLES[c].route} » est déjà une route`,
      ).not.toContain(TYPES_RESERVABLES[c].route);
    }
  });
});

describe("🔑 /appel : le choix public ne liste que les deux rendez-vous publics", () => {
  const page = sansCommentaires(lire(PAGE));

  it("une carte par rendez-vous PUBLIC, aucune pour un lien privé", () => {
    for (const c of CHOIX_PUBLICS) expect(page).toContain(`data-cta="appel_choix_${c}"`);
    expect(page).not.toContain('data-cta="appel_choix_apporteur"');
    expect(page).not.toContain('data-cta="appel_choix_salon"');
  });

  it("« Changer de rendez-vous » n'existe pas pour un rendez-vous privé", () => {
    const i = page.indexOf('data-cta="appel_changer_de_rendez_vous"');
    expect(i).toBeGreaterThan(-1);
    expect(page.slice(Math.max(0, i - 400), i)).toContain("config.public ?");
  });

  it("un rendez-vous privé n'a ni description structurée ni référencement", () => {
    expect(page).toContain("referencable");
    expect(page).toMatch(/restreint|estUnChoixPublic\(choixDemande\)/);
    expect(page).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("les libellés du calendrier viennent de la table, pas de la page", () => {
    expect(page).toContain("config.premiereEtape");
    expect(page).toContain("config.deuxiemeEtape");
    expect(page).toContain("config.troisiemeEtape");
    expect(page).toContain("config.titre");
    expect(page).not.toContain('choix === "diagnostic" ?');
  });
});

describe("🔴 le formulaire, l'action et le report ne connaissent plus que la table", () => {
  const reserverPage = sansCommentaires(lire(`${DOSSIER}/reserver/page.tsx`));
  const reserverActions = sansCommentaires(lire(`${DOSSIER}/reserver/actions.ts`));

  it("le retour au calendrier passe par `lienDuCalendrier` (jamais `/appel?` recopié)", () => {
    for (const code of [reserverPage, reserverActions]) {
      expect(code).toContain("lienDuCalendrier(locale, choix, depuis, suivi)");
      expect(code).not.toMatch(/`\/\$\{locale\}\/appel\?/);
    }
  });

  it("la page et l'action jugent les formats avec la MÊME fonction", () => {
    expect(reserverPage).toContain("formatsProposes(choix, et.lieux?.formats)");
    expect(reserverActions).toContain("formats: formatsProposes(choix, et.lieux?.formats)");
  });

  it("le report garde son type d'origine pour les quatre types", () => {
    const choix = sansCommentaires(lire("src/server/calendly/choix-rendez-vous.ts"));
    expect(choix).toContain("choixDuTypeRendezVous(type)");
    expect(choix).toContain("urlConfigureeDuChoix(choix)");
  });
});
