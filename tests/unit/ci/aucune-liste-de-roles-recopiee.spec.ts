/**
 * 🛑 AUCUNE LISTE DE RÔLES RECOPIÉE DANS LE PÉRIMÈTRE RECRUTEMENT.
 *
 * 🔴 CE QUE CETTE GARDE EXISTE POUR EMPÊCHER, ET QUI EST DÉJÀ ARRIVÉ.
 *
 * `src/server/auth/habilitations.ts` est le SSOT des rôles. Une garde qui écrit
 * sa propre liste — `role !== "super_admin" && role !== "admin" && …` — ne
 * diverge pas le jour où on l'écrit : elle diverge le jour où le SSOT gagne un
 * rôle, et **la divergence ne se voit sur aucun écran**.
 *
 * Elle est arrivée, exactement comme ça, et le lot 6 l'a soldée : la garde
 * d'écriture des candidatures autorisait `super_admin | admin | editor` pendant
 * que `ROLES_DOSSIER_CANDIDAT` valait `super_admin | admin |
 * responsable_qualite | secretaire`. Résultat, sur les deux actions de
 * décision : `editor` écartait et embauchait des dossiers qu'il n'avait pas le
 * droit d'ouvrir, et `secretaire` — qui mène le dossier de bout en bout — ne
 * pouvait pas enregistrer la décision.
 *
 * 🔑 AUCUNE GARDE NE COUVRAIT ÇA. Vérifié : les 25 fichiers de `tests/unit/ci/`
 * n'examinent aucun littéral de rôle, et `la-console-a-une-garde-de-role-globale`
 * ne lit qu'UN fichier (le layout) en écrivant elle-même qu'elle ne couvre pas
 * « le PÉRIMÈTRE (qui voit quoi) ». La divergence a donc vécu sans témoin.
 *
 * ## ⚠️ Périmètre : le recrutement, et lui seul — assumé
 *
 * Le dépôt porte ~86 occurrences de `role !== "super_admin"` sur une trentaine
 * de fichiers (blog, submissions, users, reviews, routes Qualiopi…). Les
 * balayer toutes ici poserait un rouge que personne ne peut fermer dans sa
 * propre PR — c'est exactement ce que la doctrine d'`AGENTS.md` interdit :
 * « ne jamais reposer un ratchet sur un seuil déjà dépassé ». On ferme donc le
 * périmètre où le défaut a été mesuré et corrigé, à **zéro violation**, et le
 * reste du dépôt reste hors de cette garde jusqu'à ce qu'il soit soldé.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Les dossiers soldés — zéro littéral de rôle attendu. */
const PERIMETRE = [
  "src/features/admin-job-applications",
  "src/features/admin-job-offers",
  "src/features/job-application",
  "src/server/careers",
];

/**
 * Un littéral de rôle DANS UNE COMPARAISON.
 *
 * 🔑 On ne cherche pas le mot `"super_admin"` : il apparaît légitimement dans
 * des messages, des commentaires et des fixtures de test. On cherche la forme
 * qui DÉCIDE — une comparaison, ou une appartenance à un tableau écrit sur
 * place. C'est la forme qui diverge, et c'est la seule qu'on refuse.
 */
const COMPARAISONS = [
  /role\s*(?:!==|===)\s*"(?:super_admin|admin|editor|reader|responsable_qualite|secretaire)"/,
  /\[\s*"(?:super_admin|admin|editor|reader|responsable_qualite|secretaire)"[^\]]*\]\s*\.\s*includes\s*\(/,
];

function fichiersTypeScript(dossier: string): string[] {
  let out: string[] = [];
  let entrees: string[];
  try {
    entrees = readdirSync(dossier);
  } catch {
    return out;
  }
  for (const e of entrees) {
    const chemin = join(dossier, e);
    if (statSync(chemin).isDirectory()) {
      // Les tests ont le droit de nommer les rôles : c'est leur objet.
      if (e === "__tests__") continue;
      out = out.concat(fichiersTypeScript(chemin));
    } else if (e.endsWith(".ts") || e.endsWith(".tsx")) {
      if (e.endsWith(".spec.ts") || e.endsWith(".test.ts")) continue;
      out.push(chemin);
    }
  }
  return out;
}

/** Retire commentaires de ligne et de bloc — un rôle cité en prose ne décide rien. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("🛑 le périmètre recrutement n'écrit aucune liste de rôles", () => {
  const fichiers = PERIMETRE.flatMap(fichiersTypeScript);

  it("le balayage voit bien des fichiers — sinon la garde ne garde rien", () => {
    // 🔴 CONTRE-TÉMOIN OBLIGATOIRE. Une garde qui balaie une arborescence vide
    // est verte pour la pire des raisons. Ce dépôt a déjà payé ce défaut ;
    // le seuil est posé sous le compte réel, pas au-dessus.
    expect(fichiers.length).toBeGreaterThan(15);
  });

  it("🔴 aucune comparaison de rôle écrite en dur — le prédicat du SSOT, ou rien", () => {
    const fautes: string[] = [];

    for (const f of fichiers) {
      const lignes = sansCommentaires(readFileSync(f, "utf8")).split("\n");
      lignes.forEach((ligne, i) => {
        for (const motif of COMPARAISONS) {
          if (motif.test(ligne)) {
            fautes.push(`${f}:${String(i + 1)} — ${ligne.trim().slice(0, 110)}`);
            break;
          }
        }
      });
    }

    expect(
      fautes,
      "Une liste de rôles écrite ici diverge du SSOT le jour où celui-ci gagne un rôle, " +
        "et la divergence ne se voit sur aucun écran. Utiliser un prédicat de " +
        "`@/server/auth/habilitations` : `peutOuvrirDossierCandidat`, `peutEcrire`, " +
        "`peutConsulter` ou `peutEngager`.\n" +
        fautes.join("\n"),
    ).toEqual([]);
  });

  it("le motif attrape VRAIMENT la forme fautive — témoin sur une ligne fabriquée", () => {
    // 🔑 Sans ce témoin, une regex cassée rendrait la garde verte pour
    // toujours. On lui présente les deux formes qu'elle doit refuser, et deux
    // formes voisines qu'elle doit laisser passer.
    const fautives = [
      'if (role !== "super_admin" && role !== "admin") throw new Error("forbidden");',
      'if (["admin", "editor"].includes(role)) return true;',
    ];
    for (const l of fautives) {
      expect(
        COMPARAISONS.some((m) => m.test(l)),
        `non attrapée : ${l}`,
      ).toBe(true);
    }

    const licites = [
      "if (!peutOuvrirDossierCandidat(role)) throw new Error();",
      'return { role: "super_admin" };',
      'const message = "réservé au super_admin";',
    ];
    for (const l of licites) {
      expect(
        COMPARAISONS.some((m) => m.test(l)),
        `faux positif : ${l}`,
      ).toBe(false);
    }
  });
});
