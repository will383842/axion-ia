// Aucun workflow ne pousse sur une branche protégée — régression 2026-08-27.
//
// CE QUE CE TEST PROTÈGE, ET CE QUI L'A MOTIVÉ
// ---------------------------------------------
// `gsc-search-analytics-weekly.yml` exportait les performances Search Console
// puis committait le CSV et faisait `git push` sur `main`. Or `main` est en
// protection stricte : le push est refusé par
//
//     remote: error: GH006: Protected branch update failed for refs/heads/main
//
// L'export FONCTIONNAIT — les données étaient bien récupérées — mais le job
// mourait à sa dernière étape et le rapport n'arrivait nulle part. Deux lundis
// consécutifs en échec (17 et 24 août 2026) avant que quelqu'un ne regarde.
//
// 🔑 CE QUE CETTE PANNE ENSEIGNE : un cron qui échoue ne réveille personne.
// Trois semaines sans rapport de performance, sans une seule alerte. Le défaut
// n'était pas dans le code de l'export, il était dans son DERNIER geste — celui
// que personne ne relit parce qu'il a l'air administratif.
//
// La tentation, en corrigeant, est de « débloquer » le push : jeton à
// privilèges élargis, exception de protection, ou PR automatique hebdomadaire.
// Les trois sont pires que le mal :
//   · les deux premiers désarment la protection pour tout le dépôt ;
//   · la troisième encombre la file de fusion, et chaque fusion invalide TOUTES
//     les PR en vol pour ~35 min de gates (protection stricte). Un rapport
//     d'audit n'a pas à retarder une livraison.
//
// D'où cette garde : un workflow peut lire le dépôt, pas y écrire.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DOSSIER = join(process.cwd(), ".github", "workflows");

/**
 * Le déploiement est le seul à mentionner `git push` — dans un commentaire qui
 * décrit le flux, pas dans une commande. On compare donc sur les lignes
 * exécutables uniquement.
 */
function lignesExecutables(contenu: string): string[] {
  return contenu
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

function workflows(): ReadonlyArray<{ nom: string; contenu: string }> {
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((f) => ({ nom: f, contenu: readFileSync(join(DOSSIER, f), "utf8") }));
}

describe("workflows GitHub Actions", () => {
  it("🔴 aucun ne fait `git push` — la protection de branche le refuserait", () => {
    const fautifs = workflows()
      .filter((w) => lignesExecutables(w.contenu).some((l) => /(^|[;&|\s])git\s+push\b/.test(l)))
      .map((w) => w.nom);

    expect(fautifs).toEqual([]);
  });

  it("🔴 aucun ne committe — un commit sans push ne sert à rien, et avec push il échoue", () => {
    const fautifs = workflows()
      .filter((w) => lignesExecutables(w.contenu).some((l) => /(^|[;&|\s])git\s+commit\b/.test(l)))
      .map((w) => w.nom);

    expect(fautifs).toEqual([]);
  });

  it("l'export GSC hebdomadaire publie bien son rapport quelque part", () => {
    // La correction ne vaut que si le rapport ARRIVE. Retirer le push sans le
    // remplacer aurait rendu le workflow vert et parfaitement inutile — ce qui
    // est pire que rouge, parce que plus personne ne regarde.
    const w = workflows().find((x) => x.nom === "gsc-search-analytics-weekly.yml");
    expect(w, "le workflow d'export GSC a disparu").toBeDefined();
    const contenu = w?.contenu ?? "";
    expect(contenu).toContain("actions/upload-artifact");
    expect(contenu).toContain("GITHUB_STEP_SUMMARY");
  });

  it("l'export GSC n'a plus besoin d'écrire dans le dépôt", () => {
    const w = workflows().find((x) => x.nom === "gsc-search-analytics-weekly.yml");
    const contenu = w?.contenu ?? "";
    // `contents: write` sur un workflow qui n'écrit plus rien est un privilège
    // dormant : il ne casse rien aujourd'hui et autorise tout demain.
    expect(contenu).toContain("contents: read");
    expect(contenu).not.toContain("contents: write");
  });
});
