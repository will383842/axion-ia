/**
 * Garde architecturale — une alerte qui signale une ABSENCE ne peut pas garder
 * sur une clé de configuration qui porte une valeur par défaut non vide.
 *
 * ## Le défaut, mesuré le 2026-08-23
 *
 * `regleReferentHandicap` (R01, niveau **critique**, indicateur 26 ⭐) s'écrit :
 *
 * ```ts
 * const nom = await getQualiopiConfig("referent_handicap_nom");
 * if (nom && nom.trim().length > 0) return [];   // ← rien à signaler
 * ```
 *
 * Or `getQualiopiConfig` rend la valeur par défaut du registre quand la ligne
 * n'existe pas en base (`site-settings.ts:34` — `if (row == null) return
 * entry.default`), et le registre déclare
 * `referent_handicap_nom: str("Williams Jullin")` (`registry.ts:337`).
 *
 * **Donc `nom` n'est JAMAIS vide, et cette alerte critique ne peut JAMAIS
 * partir.** Sur une base entièrement vierge, la console reste muette sur un
 * super-indicateur. `regleResponsableQualite` (R01b) porte le même défaut avec
 * `responsable_qualite_nom`.
 *
 * ## Pourquoi les tests existants ne l'ont pas vu
 *
 * `evaluateur.spec.ts` remplace `getQualiopiConfig` par un mock qui rend `""`.
 * Le test prouve donc que la règle fonctionne **pour une valeur que la
 * production ne peut pas produire** : le mock court-circuite précisément la
 * couche des valeurs par défaut, qui est l'endroit où le défaut vit. Un mock
 * incomplet est un contrat rompu — ce dépôt l'a déjà payé.
 *
 * ## Pourquoi cette garde est STATIQUE et pas un cas de test de plus
 *
 * Deux règles portent le défaut aujourd'hui. Rien n'empêche d'en écrire une
 * troisième demain : le motif « je lis une config, je m'alarme si elle est
 * vide » est naturel, et il est mortellement silencieux dès que la clé a un
 * défaut. Un test par cas ne garde que les cas déjà connus ; celui-ci garde la
 * FORME, donc aussi les règles qui n'existent pas encore.
 *
 * ⚠️ Les valeurs attendues ne sont pas recopiées : elles sont **dérivées** de
 * `QUALIOPI_CONFIG_REGISTRY`. Un prédicat recopié diverge toujours.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { QUALIOPI_CONFIG_REGISTRY } from "@/server/qualiopi/config/registry";

const CHEMIN_EVALUATEUR = join(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts");

/** Une règle d'alerte qui conclut « rien à signaler » sur une config non vide. */
interface RegleDAbsence {
  readonly nomFonction: string;
  readonly cleConfig: string;
}

/**
 * Recense les règles qui traitent une configuration comme la preuve d'une
 * présence : elles lisent une clé, puis rendent une liste VIDE (= aucune
 * alerte) dès que la valeur est non vide.
 *
 * On découpe par déclaration de fonction plutôt qu'avec une seule expression
 * régulière sur tout le fichier : sinon la clé d'une règle serait appariée avec
 * la garde d'une autre, et le recensement mentirait dans les deux sens.
 */
function recenserReglesDAbsence(source: string): RegleDAbsence[] {
  const blocs = source.split(/(?=^async function regle)/m).slice(1);
  const regles: RegleDAbsence[] = [];

  for (const bloc of blocs) {
    const nom = bloc.match(/^async function (regle\w+)/)?.[1];
    if (nom === undefined) continue;

    // Le corps s'arrête à la fonction suivante (le découpage l'a déjà fait).
    const cle = bloc.match(/getQualiopiConfig\(\s*"([a-z0-9_]+)"\s*\)/)?.[1];
    if (cle === undefined) continue;

    // La signature du motif : « si c'est renseigné, je me tais ».
    const gardeSurLaPresence = /if\s*\(\s*\w+\s*&&\s*\w+\.trim\(\)\.length\s*>\s*0\s*\)\s*return\s*\[\]/.test(
      bloc,
    );
    if (!gardeSurLaPresence) continue;

    regles.push({ nomFonction: nom, cleConfig: cle });
  }

  return regles;
}

describe("une alerte d'absence ne peut pas garder sur une clé qui a un défaut non vide", () => {
  const source = readFileSync(CHEMIN_EVALUATEUR, "utf8");
  const regles = recenserReglesDAbsence(source);

  it("le recensement trouve bien des règles — sinon la garde ne garde rien", () => {
    // Témoin de la garde elle-même : si un refactoring change la forme des
    // règles, ce test rougit AVANT que les suivants ne deviennent vacuously
    // verts. Une garde qui ne trouve plus rien à vérifier passe toujours.
    expect(
      regles.length,
      "Aucune règle d'alerte reconnue dans evaluateur.ts. Soit la forme des " +
        "règles a changé, soit le motif de reconnaissance est cassé — dans les " +
        "deux cas cette garde est devenue aveugle et doit être adaptée, pas " +
        "supprimée.",
    ).toBeGreaterThan(0);
  });

  it.each(
    // Le tableau est construit à partir du recensement : chaque règle trouvée
    // devient son propre cas, nommé, pour que l'échec désigne la coupable.
    regles.map((r) => [r.nomFonction, r.cleConfig] as const),
  )("%s garde sur « %s », qui doit donc être vide par défaut", (nomFonction, cleConfig) => {
    const entree = (QUALIOPI_CONFIG_REGISTRY as Record<string, { default: unknown } | undefined>)[
      cleConfig
    ];

    expect(
      entree,
      `${nomFonction} lit la clé « ${cleConfig} », absente du registre de configuration.`,
    ).toBeDefined();

    const defaut = (entree as { default: unknown }).default;

    expect(
      defaut,
      `🔴 ${nomFonction} ne peut JAMAIS se déclencher.\n` +
        `   Elle se tait dès que « ${cleConfig} » est non vide, or le registre lui\n` +
        `   donne pour valeur par défaut ${JSON.stringify(defaut)} — et\n` +
        `   getQualiopiConfig rend ce défaut quand la ligne n'existe pas en base.\n` +
        `   Sur une base vierge, la valeur lue est donc ${JSON.stringify(defaut)},\n` +
        `   jamais "". L'alerte est morte, et son silence est indiscernable\n` +
        `   d'une situation saine.\n` +
        `   Deux issues, au choix : faire garder la règle sur une clé SANS défaut\n` +
        `   (l'e-mail, comme le fait déjà evaluerConformite pour l'indicateur 26),\n` +
        `   ou retirer le défaut du registre.`,
    ).toBe("");
  });
});
