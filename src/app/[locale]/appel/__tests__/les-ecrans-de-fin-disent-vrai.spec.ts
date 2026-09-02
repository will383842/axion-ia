// @vitest-environment node

/**
 * Verrou — les écrans de FIN du parcours d'appel disent vrai, et ne laissent
 * personne devant un mur.
 *
 * ## Ce que la passe au téléphone a vu (2026-09-02, iPhone 375 px, prod)
 *
 * — `/confirme?e=bidon` affichait « C'est réservé. » Un identifiant qui n'a
 *   pas la forme d'un identifiant confirmait un rendez-vous inexistant, et la
 *   confirmation sans détail (relecture Calendly muette) était indiscernable
 *   du succès complet : ni date, ni format, ni indication d'où vérifier.
 * — L'onglet de l'état « incertain » — celui où l'on ne sait PAS si la
 *   réservation existe — s'appelait « Rendez-vous confirmé ».
 * — « C'est annulé » et « C'est déplacé » n'avaient pas de pictogramme là où
 *   « C'est réservé » en avait un ; le refus de report n'expliquait rien là où
 *   le refus d'annulation expliquait ; l'écran « rendez-vous introuvable » du
 *   report n'avait AUCUNE sortie.
 *
 * ## Ce qu'il vérifie, et sa limite
 *
 * Ces pages lisent Prisma et Calendly : on ne les rend pas ici, on lit leur
 * source, comme les gardes voisines. Une garde de source mesure ce qui est
 * ÉCRIT, pas ce qui s'affiche — elle rougit si quelqu'un retire la garde de
 * forme, remet un titre unique, ou recopie une tête à la main au lieu de la
 * dériver du composant partagé.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");

const CONFIRME = "src/app/[locale]/appel/confirme/page.tsx";
const ANNULER = "src/app/[locale]/appel/annuler/page.tsx";
const REPORTER = "src/app/[locale]/appel/reporter/page.tsx";
const PARTAGE = "src/components/booking/parcours-ui.tsx";

/** Le code sans ses commentaires — les pages EXPLIQUENT le défaut qu'elles évitent. */
function sansCommentaires(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const confirme = sansCommentaires(lire(CONFIRME));
const annuler = sansCommentaires(lire(ANNULER));
const reporter = sansCommentaires(lire(REPORTER));

/** Le corps d'une fonction `function Nom(` jusqu'à la suivante ou la fin. */
function corpsDe(source: string, nom: string): string {
  const debut = source.indexOf(`function ${nom}(`);
  if (debut < 0) throw new Error(`fonction ${nom} introuvable — la garde ne mesure rien`);
  const suite = source.indexOf("\nfunction ", debut + 1);
  return source.slice(debut, suite < 0 ? undefined : suite);
}

describe("🔑 CONTRE-TÉMOIN : le filtre n'a pas vidé les sources", () => {
  it("les trois pages contiennent encore leur fonction de page", () => {
    expect(confirme).toContain("ConfirmePage");
    expect(annuler).toContain("AnnulerPage");
    expect(reporter).toContain("ReporterPage");
  });
});

describe("🔴 /confirme — un identifiant sans forme n'est pas une réservation", () => {
  it("refuse (404) un `e` qui n'a pas la forme d'un identifiant Calendly", () => {
    // La garde de FORME, avant toute relecture. Sans elle, `?e=bidon` rendait
    // « C'est réservé. » en prod.
    expect(confirme).toMatch(/if \(uuid !== "" && !FORME_IDENTIFIANT\.test\(uuid\)\) notFound\(\)/);
  });

  it("🔑 la forme est écrite UNE fois, partagée entre la garde et la relecture", () => {
    // Deux regex pour le même identifiant finiraient par diverger : la page
    // accepterait ce que la relecture refuse, ou l'inverse.
    const litteraux = confirme.match(/\/\^\[a-f0-9-\]\{10,64\}\$\/i/g) ?? [];
    expect(litteraux, "le motif doit vivre dans FORME_IDENTIFIANT seulement").toHaveLength(1);
    expect(confirme.match(/FORME_IDENTIFIANT\.test\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("ne dit « C'est réservé. » QUE lorsqu'elle peut montrer la date", () => {
    const composant = corpsDe(confirme, "Confirme");
    const branche = composant.indexOf("detail?.debut ? (");
    const reserve = composant.indexOf(`titre="C'est réservé."`);
    expect(branche, "la tête doit dépendre du détail").toBeGreaterThan(-1);
    expect(reserve).toBeGreaterThan(branche);
    // Et la branche sans détail dit OÙ vérifier — l'e-mail fait foi.
    expect(composant).toContain("Votre réservation est enregistrée.");
    expect(composant).toMatch(/L'e-mail de confirmation[^"]*fait foi/);
  });

  it("le titre de l'onglet suit l'état — jamais « confirmé » pour « incertain »", () => {
    expect(confirme).not.toMatch(/export const metadata/);
    expect(confirme).toContain("export async function generateMetadata");
    const titres = confirme.match(/"[^"]* · Axion-IA"/g) ?? [];
    expect(new Set(titres).size, "trois états, trois titres").toBeGreaterThanOrEqual(3);
    expect(titres.some((t) => /vérification/i.test(t))).toBe(true);
  });
});

describe("🔴 les têtes d'écran sont DÉRIVÉES du composant partagé, pas recopiées", () => {
  it("le composant partagé existe et porte le pictogramme ET le titre", () => {
    const partage = sansCommentaires(lire(PARTAGE));
    expect(partage).toContain("export function TeteDeParcours");
    expect(partage).toContain("export function SortiesDeParcours");
    expect(partage).toContain("<h1");
  });

  it.each([
    [CONFIRME, confirme, 4],
    [ANNULER, annuler, 3],
    [REPORTER, reporter, 4],
  ])("%s dérive ses écrans de fin de TeteDeParcours (≥ %i)", (_chemin, source, minimum) => {
    const n = source.match(/<TeteDeParcours\b/g)?.length ?? 0;
    expect(n).toBeGreaterThanOrEqual(minimum as number);
  });

  it("aucune page ne redéfinit sa propre tête locale", () => {
    for (const source of [confirme, annuler, reporter]) {
      expect(source).not.toMatch(/function Tete\(/);
    }
  });
});

describe("🔴 jamais de cul-de-sac", () => {
  it("l'écran « rendez-vous introuvable » du REPORT offre une sortie", () => {
    // Celui de l'annulation en avait une ; celui-ci était un mur.
    const introuvable = corpsDe(reporter, "Introuvable");
    expect(introuvable).toMatch(/<SortiesDeParcours[\s\S]*href: "\/appel"/);
  });

  it("les deux refus expliquent un lien coupé par la messagerie", () => {
    expect(corpsDe(annuler, "LienRefuse")).toContain("coupé par votre messagerie");
    expect(corpsDe(reporter, "LienRefuse")).toContain("coupé par votre messagerie");
  });

  it("après une annulation, reprendre un rendez-vous est la sortie PRINCIPALE", () => {
    const accompli = corpsDe(annuler, "Accompli");
    expect(accompli).toMatch(/principale=\{\{ href: "\/appel"/);
    // Le point médian entre deux liens texte se repliait en « voulez · Retour ».
    expect(accompli).not.toContain("·");
  });
});
