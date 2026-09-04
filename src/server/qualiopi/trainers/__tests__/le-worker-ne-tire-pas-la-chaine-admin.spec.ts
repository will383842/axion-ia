/**
 * Le graphe d'imports du WORKER ne doit pas tirer la chaîne admin.
 *
 * ## Le défaut, vécu le 2026-09-04
 *
 * En ajoutant le canal « message après échéance », j'ai importé
 * `alertes-service` dans `mission-formateur.ts`. Une ligne. Trois suites de
 * tests sont devenues **incollectables** — pas rouges : incollectables, avec
 * `Cannot find module '…/next-auth/lib/env.js'`.
 *
 * La chaîne : `alertes-service` → `evaluateur` → conformité admin → `next-auth`.
 *
 * ## Pourquoi c'est un défaut de PRODUCTION, pas de test
 *
 * `mission-formateur.ts` est importé par `qualiopi-formation-crons-worker.ts`
 * (`relancerEtExpirerMissions`). Le worker tourne sous `tsx`, sur les SOURCES,
 * **hors de Next** — il n'a ni runtime Next ni contexte de requête. Y faire
 * entrer `next-auth` fait échouer le chargement du module.
 *
 * Et l'échec serait SILENCIEUX au bon endroit : le worker se déclare `ready`,
 * puis chaque déclenchement du cron plante. C'est exactement ce qui a tué deux
 * crons de recrutement le 2026-09-04, et c'est pour ce motif que le dépôt avait
 * déjà extrait `job-ia-echoue.ts` hors du worker.
 *
 * ## Ce que cette garde vérifie
 *
 * Statiquement, sur le TEXTE des modules que le worker importe : aucun ne doit
 * importer `alertes-service`. On lit le fichier plutôt que de l'exécuter —
 * l'importer ici reproduirait précisément la panne qu'on veut détecter.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RACINE = resolve(__dirname, "../../../../..");

function lire(chemin: string): string {
  return readFileSync(resolve(RACINE, chemin), "utf8");
}

/**
 * Modules chargés par le worker de crons Qualiopi, en import STATIQUE.
 *
 * ⚠️ Cette liste se tient à la main, et c'est assumé : la dérivation
 * automatique du graphe demanderait de résoudre les alias `@/`, c'est-à-dire
 * de réimplémenter le résolveur. Le test ci-dessous vérifie au moins que
 * chaque entrée est bien importée par le worker — une entrée périmée rougit.
 */
const MODULES_DU_WORKER = [
  "src/server/qualiopi/trainers/mission-formateur.ts",
  "src/server/qualiopi/trainers/convocation-formateur.ts",
  "src/server/qualiopi/trainers/delai-reponse-mission.ts",
] as const;

const CHEMIN_WORKER = "src/server/queue/workers/qualiopi-formation-crons-worker.ts";

/** Les modules qui font entrer la chaîne admin — et donc `next-auth`. */
const INTERDITS = ["alertes/alertes-service", "alertes/evaluateur"] as const;

describe("le worker ne tire pas la chaîne admin", () => {
  it("chaque module listé est RÉELLEMENT importé par le worker", () => {
    // Témoin positif : sans lui, la liste pourrait se vider par erreur et le
    // test resterait vert en ne vérifiant plus rien.
    const worker = lire(CHEMIN_WORKER);
    for (const chemin of MODULES_DU_WORKER) {
      const nom = chemin.replace("src/", "@/").replace(/\.ts$/, "");
      expect(
        worker,
        `${chemin} n'est plus importé par le worker — mettez la liste à jour`,
      ).toContain(nom);
    }
  });

  it.each(MODULES_DU_WORKER)("%s n'importe pas la chaîne admin", (chemin) => {
    const source = lire(chemin);
    for (const interdit of INTERDITS) {
      expect(
        source.includes(interdit),
        `${chemin} importe « ${interdit} », qui tire l'évaluateur puis next-auth. ` +
          `Le worker tourne sous tsx, hors de Next : le module ne se chargera pas, ` +
          `le worker se déclarera quand même « ready », et le cron plantera à chaque ` +
          `déclenchement. Extrayez le code concerné dans un module que le worker ` +
          `n'importe pas — cf. message-apres-delai.ts.`,
      ).toBe(false);
    }
  });

  it("le module extrait, lui, a bien le droit d'importer le service d'alertes", () => {
    // Contre-témoin : la règle porte sur le graphe du WORKER, pas sur une
    // interdiction générale. Sans ce cas, on pourrait croire que lever une
    // alerte est proscrit partout.
    expect(lire("src/server/qualiopi/trainers/message-apres-delai.ts")).toContain(
      "alertes/alertes-service",
    );
  });
});
