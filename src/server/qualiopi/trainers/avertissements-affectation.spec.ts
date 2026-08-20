/**
 * `D2-5-06` — un sous-traitant ne peut plus être affecté en silence sans contrat.
 *
 * Le contrat de sous-traitance est classé `bloquant` par `trainers/conformite.ts`
 * (`REQUIS_SOUS_TRAITANT`), et pourtant rien ne le signalait sur la voie
 * d'affectation la plus empruntée — la création de session.
 *
 * 🔑 Ce qui rendait le trou invisible : `assignerFormateurAction` avertissait
 * bien, et l'habilitation était contrôlée aux DEUX endroits. On voyait un
 * contrôle marcher, on en concluait qu'il couvrait le sujet.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const getTrainerConformite = vi.fn();

vi.mock("@/server/qualiopi/trainers/documents", () => ({
  getTrainerConformite: (...a: unknown[]) => getTrainerConformite(...a),
}));

import { avertissementsAffectation } from "./avertissements-affectation";

const MANQUEMENT_CONTRAT = {
  code: "contrat_sous_traitance_absent",
  type: "contrat_sous_traitance",
  gravite: "bloquant",
  message: "Le contrat de sous-traitance est absent ou non validé.",
};

const MANQUEMENT_CV = {
  code: "cv_obsolete",
  type: "cv",
  gravite: "alerte",
  message: "CV de plus de 12 mois.",
};

describe("avertissementsAffectation", () => {
  beforeEach(() => getTrainerConformite.mockReset());

  it("🔴 remonte le contrat de sous-traitance manquant", async () => {
    getTrainerConformite.mockResolvedValue({ manquements: [MANQUEMENT_CONTRAT] });
    expect(await avertissementsAffectation("t-1")).toEqual([MANQUEMENT_CONTRAT.message]);
  });

  it("🔴 ne remonte QUE les manquements bloquants", async () => {
    // 🔑 Le témoin discriminant. Remonter aussi les `alerte` (CV obsolète, RC
    // pro absente à l'entrée) noierait le manquement qui compte — et un
    // avertissement qu'on apprend à survoler ne vaut pas mieux que pas
    // d'avertissement du tout.
    getTrainerConformite.mockResolvedValue({ manquements: [MANQUEMENT_CONTRAT, MANQUEMENT_CV] });
    const res = await avertissementsAffectation("t-1");
    expect(res).toHaveLength(1);
    expect(res).not.toContain(MANQUEMENT_CV.message);
  });

  it("un dossier complet n'avertit de rien", async () => {
    // 🔑 Témoin de non-vacuité : sans lui, une fonction qui avertirait TOUJOURS
    // passerait les deux tests précédents.
    getTrainerConformite.mockResolvedValue({ manquements: [] });
    expect(await avertissementsAffectation("t-1")).toEqual([]);
  });

  it("aucun formateur affecté → aucune lecture, aucun avertissement", async () => {
    expect(await avertissementsAffectation(null)).toEqual([]);
    expect(getTrainerConformite).not.toHaveBeenCalled();
  });

  it("🔴 une conformité ILLISIBLE n'invente rien et ne lève pas", async () => {
    // ⚠️ Ce qui rendrait ce module nuisible serait qu'il fasse échouer une
    // affectation déjà écrite en base. La session EXISTE quand on l'appelle.
    // ⚠️ On simule l'illisibilité par une FORME INATTENDUE plutôt que par un
    // rejet du mock : Vitest fait échouer le fichier sur toute erreur levée
    // depuis un double, même quand le code testé l'attrape. Le test rougissait
    // alors pour la façon de le mocker, pas pour ce qu'il teste — et un test
    // qui rougit pour la mauvaise raison finit par être « réparé » en le
    // supprimant.
    //
    // La forme retenue traverse le même chemin : `conformite.manquements` est
    // absent, `.filter` lève à l'intérieur du `try`, le `catch` rend `[]`.
    getTrainerConformite.mockResolvedValue({ pasDeManquements: true });
    await expect(avertissementsAffectation("t-1")).resolves.toEqual([]);
  });

  it("formateur introuvable (`null`) → aucun avertissement", async () => {
    getTrainerConformite.mockResolvedValue(null);
    expect(await avertissementsAffectation("t-1")).toEqual([]);
  });
});

describe("`D2-5-06` — les deux voies d'affectation avertissent", () => {
  async function source(...segments: string[]): Promise<string> {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return readFileSync(join(process.cwd(), ...segments), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  it("🔴 la CRÉATION de session calcule les avertissements", async () => {
    // C'est la voie qui se taisait, et c'est la plus empruntée : on affecte le
    // formateur en créant la session, pas en revenant l'assigner ensuite.
    const s = await source("src", "server", "actions", "qualiopi", "sessions.ts");

    // 🔴 L'APPEL, pas l'import. Première version de ce test : il cherchait
    // `/avertissementsAffectation/` — et la mutation qui rétablissait le défaut
    // d'origine (`const avertissements: string[] = []`) est passée au VERT,
    // parce que la ligne d'`import` contient encore le mot. La garde ne gardait
    // rien, et seule la mutation l'a montré.
    expect(s, "la fonction doit être APPELÉE, pas seulement importée").toMatch(
      /avertissementsAffectation\(\s*v\.trainerId/,
    );
    expect(s, "et son résultat rendu à l'appelant").toMatch(/avertissements\s*[,}]/);
  });

  it("l'AFFECTATION passe par la même fonction, elle ne la réimplémente pas", async () => {
    // 🔑 Le calcul vivait en ligne dans cette action, et c'est précisément pour
    // ça que l'autre voie ne l'a jamais eu. Une règle qui ne vit qu'à l'endroit
    // où on l'a écrite ne protège que cet endroit.
    const s = await source("src", "server", "actions", "qualiopi", "trainers.ts");
    // Même exigence : l'appel, avec son argument.
    expect(s).toMatch(/avertissementsAffectation\(\s*trainerId\s*\)/);
    expect(s, "plus de lecture directe de la conformité ici").not.toMatch(/getTrainerConformite/);
  });

  it("🔴 le formulaire de création AFFICHE les avertissements, sans rediriger", async () => {
    // ⚠️ Une redirection efface le message avant qu'il n'ait été lu. Un
    // avertissement qu'on n'a pas le temps de lire ne vaut pas mieux que pas
    // d'avertissement — c'est le même défaut, avec l'apparence d'un correctif.
    const s = await source("src", "components", "admin", "qualiopi", "SessionForm.tsx");
    expect(s).toMatch(/setAvertissements\(result\.data\.avertissements\)/);
    expect(s).toMatch(/if \(result\.data\.avertissements\.length > 0\) return;/);
    expect(s, "et il les rend à l'écran").toMatch(/avertissements\.map/);
  });
});
