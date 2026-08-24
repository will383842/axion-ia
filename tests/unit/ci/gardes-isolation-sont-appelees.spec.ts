/**
 * Les gardes d'isolation doivent être APPELÉES — garde d'infrastructure.
 *
 * ## Ce que le 2026-08-24 a mesuré
 *
 * Ce dépôt a trois gardes d'isolation de module, écrites sur le même patron.
 * Une seule était câblée en CI. Voici leur état ce jour-là :
 *
 *   · `content-gen:isolation-check`  — dans `gate-a`  →  **0 violation** / 11 268 fichiers
 *   · `qualiopi:isolation-check`     — nulle part     →  **58 violations**
 *   · `image-bank:isolation-check`   — nulle part     →  **30 violations**
 *
 * Ce n'est pas une coïncidence, et ce n'est pas une question de discipline des
 * auteurs : c'est la même règle que ce dépôt a déjà payée plusieurs fois. Une
 * garde qu'on n'exécute pas n'arrête rien — elle enregistre la dérive. Celle de
 * qualiopi est passée de 24 violations le 2026-07-30 à 58 le 2026-08-24 pendant
 * que son propre en-tête affirmait « câblé dans verify:all + pre-push » : faux
 * pour le hook, et sans effet pour `verify:all`, qui n'a lui-même aucun appelant.
 * Un commentaire qui décrit un câblage inexistant est pire que pas de commentaire,
 * parce qu'il fait croire que la dérive serait vue.
 *
 * Ce fichier n'exécute aucune garde. Il lit le workflow et vérifie qu'elles sont
 * branchées là où quelqu'un lit leur résultat.
 *
 * ⚠️ RÈGLE DE RÉDACTION — on raisonne sur des lignes de CODE YAML, jamais sur du
 * commentaire : cette en-tête cite elle-même `qualiopi:isolation-check`, et un
 * contrôle qui confond une explication avec le fait qu'elle explique est faux.
 * Même piège que `test-statique-trouve-ses-propres-commentaires`.
 *
 * ## `image-bank` n'est PAS exigé ici, et c'est délibéré
 *
 * Ses 30 violations ne relèvent pas du même remède : contrairement aux deux
 * autres, il marque VOLONTAIREMENT sur la simple mention du terme (« Contient
 * marqueur image-bank »), pour protéger la possibilité d'un rollback modulaire
 * V1 → V2. Le rendre vert demande de trancher si ce rollback est encore un
 * objectif — une décision produit, pas une correction d'instrument. Le câbler en
 * l'état ouvrirait un rouge permanent sur toutes les PR, ce que ce dépôt
 * interdit explicitement (AGENTS.md : « seuil aligné d'abord, blocage ensuite »).
 * La dette est donc nommée ici plutôt que masquée.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const CI = ".github/workflows/ci.yml";

/** Le workflow, privé de ses commentaires : seules les lignes de code comptent. */
function codeYaml(chemin: string): string {
  return readFileSync(path.join(RACINE, chemin), "utf8")
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

/**
 * Les gardes dont l'absence de câblage a été mesurée comme coûteuse.
 * `image-bank` est absent volontairement — voir l'en-tête.
 */
const GARDES_EXIGEES = ["content-gen:isolation-check", "qualiopi:isolation-check"] as const;

describe("les gardes d'isolation sont appelées par la CI", () => {
  const ci = codeYaml(CI);

  it.each(GARDES_EXIGEES)("« %s » est exécutée par ci.yml", (garde) => {
    expect(
      ci,
      `🔴 « pnpm ${garde} » n'apparaît dans AUCUNE ligne de code de ${CI}.\n` +
        "\n" +
        "   Une garde d'isolation que rien n'exécute ne garde rien : elle enregistre\n" +
        "   la dérive au lieu de l'arrêter. Mesuré le 2026-08-24 sur ce dépôt même —\n" +
        "   la seule des trois qui était câblée était aussi la seule à 0 violation ;\n" +
        "   les deux autres cumulaient 88 violations.\n" +
        "\n" +
        "   Si la garde est retirée volontairement, retirer aussi son entrée de\n" +
        "   GARDES_EXIGEES dans ce fichier — pour que la décision soit visible.",
    ).toContain(`pnpm ${garde}`);
  });

  it("elles tournent dans gate-a, un contexte EXIGÉ par la protection de main", () => {
    // Le job qui compte est celui dont l'échec bloque la fusion. Une garde
    // rangée dans un job facultatif rougirait sans rien empêcher — c'est le vice
    // de `continue-on-error`, sous une autre forme.
    const debutGateA = ci.indexOf("\n  gate-a:");
    const debutGateB = ci.indexOf("\n  gate-b:");
    expect(
      debutGateA,
      `🔴 Le job « gate-a » est introuvable dans ${CI} : ce contrôle deviendrait vide.`,
    ).toBeGreaterThan(-1);
    expect(
      debutGateB,
      `🔴 Le job « gate-b » est introuvable dans ${CI} : impossible de borner gate-a.`,
    ).toBeGreaterThan(debutGateA);

    const corpsGateA = ci.slice(debutGateA, debutGateB);
    for (const garde of GARDES_EXIGEES) {
      expect(
        corpsGateA,
        `🔴 « pnpm ${garde} » est bien dans ${CI}, mais PAS dans le job gate-a.\n` +
          "   gate-a est un contexte exigé par la protection de branche : c'est là que\n" +
          "   son rouge empêche une fusion. Ailleurs, il informe sans protéger.",
      ).toContain(`pnpm ${garde}`);
    }
  });

  it("la garde qualiopi porte un cliquet nominatif, pas une exception par répertoire", () => {
    // Une exception par dossier laisserait entrer le consommateur suivant sans
    // que personne ne le voie. C'est tout l'intérêt d'une liste de FICHIERS.
    const source = readFileSync(path.join(RACINE, "scripts/qualiopi/isolation-check.ts"), "utf8");
    expect(
      source,
      "🔴 CONSOMMATEURS_ASSUMES a disparu de scripts/qualiopi/isolation-check.ts.\n" +
        "   Sans cette liste nominative, la garde ne peut être verte qu'en autorisant\n" +
        "   des RÉPERTOIRES entiers — et le prochain fichier qui importe le domaine\n" +
        "   entrerait alors sans décision.",
    ).toContain("CONSOMMATEURS_ASSUMES");

    const bloc = source.slice(
      source.indexOf("const CONSOMMATEURS_ASSUMES"),
      source.indexOf("function isPathAllowed"),
    );
    const entrees = (bloc.match(/^\s+"[^"]+",$/gm) ?? []).length;
    expect(
      entrees,
      "🔴 La liste CONSOMMATEURS_ASSUMES est vide ou illisible : la garde serait\n" +
        "   verte par vacuité, ce qui ne prouve rien.",
    ).toBeGreaterThan(20);
  });
});
