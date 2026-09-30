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
import {
  ANCRES_HUB_SESSION,
  ancresDeLOnglet,
  ancresVisibles,
  CLASSE_ANCRE_SECTION,
  lirePhaseFiche,
  PHASES_DES_BLOCS,
  PHASES_FICHE,
  repartirBlocs,
  type BlocFiche,
} from "./ancres";

const TOUS_LES_BLOCS = ANCRES_HUB_SESSION.map((a) => a.id as BlocFiche);

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

  it("toutes les sections du hub sont couvertes", () => {
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
  it("le composant est appelé, et nourri par les blocs AFFICHÉS de l'onglet", () => {
    // Poser les `id` sans afficher la barre laisserait les sections
    // atteignables par URL et introuvables à l'écran — le défaut intact.
    // ⚠️ Frontière de mot obligatoire. `toContain("<AncresHubSession")` reste
    // vrai pour `<AncresHubSessionAutreChose` : constaté en désarmant cette
    // garde même — elle est restée VERTE alors que la barre ne se rendait plus.
    expect(code).toMatch(/<AncresHubSession\b/);
    // 🔴 Relecture L3 — nourrie par TOUT le catalogue, la barre menait aussi
    // aux blocs repliés, c'est-à-dire dans un <details> fermé.
    expect(code).toContain("ancresDeLOnglet(blocsAffiches)");
  });
});

describe("🔴 ancresDeLOnglet — aucune pastille vers un bloc replié", () => {
  it.each(PHASES_FICHE.map((p) => [p.id] as const))("onglet %s", (phase) => {
    const { affiches, replies } = repartirBlocs(phase, TOUS_LES_BLOCS);
    const ids = ancresDeLOnglet(affiches).map((a) => a.id);
    expect(ids).toEqual(affiches);
    expect(replies.length, "témoin : l'onglet replie bien quelque chose").toBeGreaterThan(0);
    for (const r of replies) expect(ids, r).not.toContain(r);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phases (L3, 30/09/2026) — la fiche s'affiche par onglet
// ─────────────────────────────────────────────────────────────────────────────

const TOUS = ANCRES_HUB_SESSION.map((a) => a.id as BlocFiche);

describe("🔴 aucun bloc orphelin : chaque bloc de la fiche a sa phase", () => {
  it("la table des phases nomme EXACTEMENT les blocs du catalogue", () => {
    expect(Object.keys(PHASES_DES_BLOCS).sort()).toEqual([...TOUS].sort());
  });

  it("aucun bloc n'est rattaché à une liste vide de phases", () => {
    for (const [bloc, phases] of Object.entries(PHASES_DES_BLOCS)) {
      if (phases !== "toujours") expect(phases.length, bloc).toBeGreaterThan(0);
    }
  });

  it("chaque onglet a au moins un bloc qui lui est PROPRE à montrer", () => {
    for (const p of PHASES_FICHE) {
      const propres = TOUS.filter((b) => {
        const phases = PHASES_DES_BLOCS[b];
        return phases !== "toujours" && phases.includes(p.id);
      });
      expect(propres.length, p.id).toBeGreaterThan(0);
    }
  });
});

describe("🔴 aucun contenu perdu : les blocs hors phase sont repliés, jamais supprimés", () => {
  it.each(PHASES_FICHE.map((p) => [p.id] as const))(
    "phase %s : affichés + repliés = tous les blocs rendus, sans doublon",
    (phase) => {
      const { affiches, replies } = repartirBlocs(phase, TOUS);
      expect(affiches.length + replies.length).toBe(TOUS.length);
      expect(new Set([...affiches, ...replies]).size).toBe(TOUS.length);
      // Chacune des deux listes garde l'ordre du DOM.
      const rang = (b: BlocFiche) => TOUS.indexOf(b);
      expect(affiches).toEqual([...affiches].sort((x, y) => rang(x) - rang(y)));
      expect(replies).toEqual([...replies].sort((x, y) => rang(x) - rang(y)));
    },
  );

  it("un bloc absent (conditionnel non rendu) n'apparaît nulle part", () => {
    const { affiches, replies } = repartirBlocs(
      "preparer",
      TOUS.filter((b) => b !== "preparation-kit"),
    );
    expect([...affiches, ...replies]).not.toContain("preparation-kit");
  });

  it("sans phase (session annulée ou reportée) tout est affiché, rien n'est replié", () => {
    const { affiches, replies } = repartirBlocs(null, TOUS);
    expect(replies).toEqual([]);
    expect(affiches).toEqual(TOUS);
  });

  it("l'onglet Préparer montre les dates, pas la clôture ; Clôturée l'inverse", () => {
    expect(repartirBlocs("preparer", TOUS).affiches).toContain("dates");
    expect(repartirBlocs("preparer", TOUS).replies).toContain("cloture");
    expect(repartirBlocs("cloturee", TOUS).affiches).toContain("cloture");
    expect(repartirBlocs("cloturee", TOUS).replies).toContain("dates");
  });

  it("la page rend les DEUX listes : les blocs de l'onglet, et « Toutes les actions »", () => {
    // Compter les sections : chaque bloc passe par l'une des deux boucles, et
    // le repli est un <details>, jamais un rendu conditionnel qui l'effacerait.
    expect(code).toContain("repartirBlocs(");
    expect(code).toMatch(/blocsAffiches\.map\(/);
    expect(code).toMatch(/blocsReplies\.map\(/);
    expect(code).toMatch(/<details[\s>]/);
    expect(code).toContain("Autres blocs de la fiche");
    expect(code).not.toContain("Toutes les actions");
  });
});

describe("lirePhaseFiche", () => {
  it("lit une phase connue, rejette le reste", () => {
    expect(lirePhaseFiche("jour_j")).toBe("jour_j");
    expect(lirePhaseFiche(["apres", "x"])).toBe("apres");
    expect(lirePhaseFiche("hors_parcours")).toBeNull();
    expect(lirePhaseFiche(undefined)).toBeNull();
  });

  it("sans ?phase, la page retombe sur la phase du dossier (phaseDossier)", () => {
    expect(code).toMatch(/lirePhaseFiche\(parametres\.phase\)\s*\?\?\s*phaseCourante/);
    expect(code).toContain("phaseDossier(");
  });
});
