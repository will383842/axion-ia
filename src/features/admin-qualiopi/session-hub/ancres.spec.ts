/**
 * 🔴 Garde des ancres du hub de session.
 *
 * L'identifiant est écrit deux fois — `href="#x"` dans la barre, `id="x"` sur
 * la section. Deux copies d'une même frontière divergent : ce test est le seul
 * point où l'écart devient visible, et il doit ROUGIR dans les deux sens.
 *
 *   · une ancre au catalogue sans section correspondante → lien mort ;
 *   · une section ancrable absente du catalogue → invisible dans la barre,
 *     donc atteignable seulement en déroulant — le défaut d'origine.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANCRES_HUB_SESSION, ancresVisibles, CLASSE_ANCRE_SECTION } from "./ancres";

const PAGE = join(
  process.cwd(),
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx",
);

/**
 * 🔴 On DÉPOUILLE les commentaires avant de chercher.
 *
 * Le dépôt a déjà payé ce piège : un test statique qui lit le fichier entier
 * trouve ses PROPRES commentaires. Ici la page cite « preparation-kit » et
 * « lien mort » en prose ; sans dépouillement, désarmer le code laisserait le
 * test vert parce qu'un commentaire porte encore l'identifiant.
 */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const source = readFileSync(PAGE, "utf8");
const code = sansCommentaires(source);

describe("le dépouillement des commentaires", () => {
  it("retire bien quelque chose", () => {
    // Sans cette vérification, une regex cassée rendrait la source INTACTE et
    // toutes les gardes ci-dessous redeviendraient muettes en silence.
    expect(code.length).toBeLessThan(source.length);
  });

  it("ne mange pas le code — les sections survivent", () => {
    // L'excès inverse est aussi dangereux : une regex trop gourmande viderait
    // le fichier, et « aucun id manquant » deviendrait vrai par le vide.
    expect(code).toContain("<section");
    expect(code.length).toBeGreaterThan(source.length / 2);
  });
});

describe("🔴 chaque ancre du catalogue a sa section dans la page", () => {
  it.each(ANCRES_HUB_SESSION.map((a) => [a.id] as const))('id="%s" existe', (id) => {
    expect(code).toContain(`id="${id}"`);
  });
});

describe("🔴 chaque section ancrée de la page est au catalogue", () => {
  it("aucun id orphelin", () => {
    const dansLaPage = [...code.matchAll(/<section\s+id="([\w-]+)"/g)].map((m) => m[1]!);
    const auCatalogue = new Set(ANCRES_HUB_SESSION.map((a) => a.id));
    // Une section ancrée mais absente de la barre est une section qu'on a
    // rendue atteignable par URL sans le dire à personne.
    expect(dansLaPage.filter((id) => !auCatalogue.has(id))).toEqual([]);
  });

  it("les dix sections du hub sont couvertes", () => {
    // Compte figé volontairement : ajouter une onzième section sans l'ancrer
    // fera rougir ici, ce qui est exactement le rappel qu'il faut.
    expect([...code.matchAll(/<section\s+id="/g)]).toHaveLength(ANCRES_HUB_SESSION.length);
  });
});

describe("🔴 le décalage de défilement est posé sur chaque section", () => {
  it("autant de CLASSE_ANCRE_SECTION que de sections ancrées", () => {
    // Sans lui, la topbar collante recouvre le titre : on atterrit sur un
    // paragraphe orphelin sans savoir de quelle section il s'agit.
    // On compte la forme INTERPOLÉE `${CLASSE_ANCRE_SECTION}` : compter le nom
    // nu inclurait la ligne d'import et donnerait un de trop — un décompte qui
    // se croit juste est pire qu'un décompte absent.
    expect([...code.matchAll(/\$\{CLASSE_ANCRE_SECTION\}/g)]).toHaveLength(
      ANCRES_HUB_SESSION.length,
    );
  });

  it("il s'appuie sur le jeton de hauteur, jamais sur une valeur figée", () => {
    // La topbar a déjà changé de hauteur une fois. Un `scroll-mt-12` en dur
    // aurait recouvert ou décollé selon le sens du changement.
    expect(CLASSE_ANCRE_SECTION).toContain("--admin-topbar-h");
    expect(CLASSE_ANCRE_SECTION).not.toMatch(/scroll-mt-\d/);
  });
});

describe("ancresVisibles", () => {
  it("écarte une ancre conditionnelle non déclarée — pas de lien mort", () => {
    const ids = ancresVisibles().map((a) => a.id);
    expect(ids).not.toContain("preparation-kit");
  });

  it("la rend dès que la page dit que la section est là", () => {
    expect(ancresVisibles(["preparation-kit"]).map((a) => a.id)).toContain("preparation-kit");
  });

  it("les inconditionnelles sont toujours là, sans rien déclarer", () => {
    const ids = ancresVisibles().map((a) => a.id);
    expect(ids).toContain("infos");
    expect(ids).toContain("documents");
    // Rendue même hors inter-entreprises : la section porte la bascule.
    expect(ids).toContain("inter-entreprises");
  });

  it("l'ordre du catalogue est celui du DOM, jamais réordonné", () => {
    // Une barre qui ne suit pas l'ordre de la page fait sauter le lecteur en
    // arrière sans qu'il comprenne pourquoi.
    const positions = ANCRES_HUB_SESSION.map((a) => code.indexOf(`id="${a.id}"`));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
  });

  it("aucun identifiant en double", () => {
    const ids = ANCRES_HUB_SESSION.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("la barre est bien rendue par la page", () => {
  it("le composant est appelé, et nourri par ancresVisibles", () => {
    // Poser les `id` sans afficher la barre laisserait les sections
    // atteignables par URL et introuvables à l'écran — le défaut intact.
    // ⚠️ Frontière de mot obligatoire. `toContain("<AncresHubSession")` reste
    // vrai pour `<AncresHubSessionAutreChose` : constaté en désarmant cette
    // garde même — elle est restée VERTE alors que la barre ne se rendait plus.
    expect(code).toMatch(/<AncresHubSession\b/);
    expect(code).toContain("ancresVisibles(");
  });
});
