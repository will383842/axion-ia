// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt.

/**
 * Verrou — la durée de conservation des réservations d'appel doit rester égale
 * à celle que le site ANNONCE publiquement.
 *
 * ## Ce que ce test empêche
 *
 * Jusqu'au 2026-08-31, `calendly_events` n'était purgée par rien : le worker de
 * rétention traitait 24 modèles, et `calendlyEvent` n'en faisait pas partie.
 * Nom, e-mail, téléphone et réponses libres des prospects se conservaient sans
 * limite, la plus ancienne ligne datant du 2026-07-01.
 *
 * Ce n'était pas seulement « une décision de rétention en attente » : la notice
 * art. 13 servie sur le site annonce, elle, « Demandes commerciales : 3 ans ».
 * Une durée publiée qu'aucun mécanisme n'applique est un écart entre ce qu'on
 * dit aux personnes et ce qu'on fait — la forme de non-conformité la plus
 * facile à constater en contrôle, puisqu'il suffit de lire la page publique
 * puis la base.
 *
 * ## Pourquoi un test, et pas seulement un commentaire
 *
 * Les deux valeurs vivent dans deux fichiers qui n'ont aucune raison d'être
 * relus ensemble : `src/content/legal.ts` est édité par une passe éditoriale,
 * `retention-purge-worker.ts` par une passe technique. Rien ne rougirait si
 * l'une changeait sans l'autre — et c'est exactement ainsi que naît l'écart
 * qu'on vient de fermer.
 *
 * 🔑 Le test DÉRIVE la durée de la notice au lieu de la recopier. Si la
 * politique passe un jour à 5 ans, il rougit et désigne le fichier à corriger ;
 * il ne se contente pas de vérifier qu'un nombre vaut 36.
 *
 * ⚠️ Ce verrou ne dit RIEN de la décision « prospection : conservation SANS
 * LIMITE » du 2026-08-20, qui porte sur `ProspectionCompany`,
 * `ProspectionPerson` et `ProspectionHealthPractitioner` — des fiches
 * constituées, sous un autre régime, et protégées par leur propre garde
 * (`prospection-aucune-purge-automatique.spec.ts`). Une réservation d'appel est
 * une demande entrante d'une personne qui nous a écrit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(join(RACINE, relatif), "utf8");
}

const WORKER = "src/server/queue/workers/retention-purge-worker.ts";
const NOTICE = "src/content/legal.ts";

describe("la rétention des réservations d'appel suit la notice publiée", () => {
  it("🔴 la notice annonce toujours une durée pour les demandes commerciales", () => {
    const annees = /Demandes commerciales\s*:\s*(\d+)\s*ans?/.exec(lire(NOTICE))?.[1];
    expect(
      annees,
      "la phrase « Demandes commerciales : N ans » a disparu de src/content/legal.ts — " +
        "si la notice a été reformulée, mettre ce test à jour EN MÊME TEMPS que le worker",
    ).toBeDefined();
    expect(Number(annees)).toBeGreaterThan(0);
  });

  it("🔴 le worker purge bien `calendlyEvent` — sans quoi la durée publiée n'est appliquée par rien", () => {
    const src = lire(WORKER);
    expect(
      src,
      "aucune purge sur calendlyEvent : la notice annoncerait une durée que rien n'applique",
    ).toMatch(/prisma\.calendlyEvent\.deleteMany/);
  });

  it("🔴 la durée du worker est EXACTEMENT celle de la notice", () => {
    const annees = Number(/Demandes commerciales\s*:\s*(\d+)\s*ans?/.exec(lire(NOTICE))?.[1]);
    const mois = Number(/reservationsAppel:\s*(\d+)/.exec(lire(WORKER))?.[1]);

    expect(mois, "`DEFAULTS.reservationsAppel` introuvable dans le worker").toBeGreaterThan(0);
    expect(
      mois,
      `la notice publique annonce ${annees} ans (${annees * 12} mois) mais le worker purge à ` +
        `${mois} mois. Les deux doivent dire la même chose : corriger celle des deux qui a tort.`,
    ).toBe(annees * 12);
  });

  it("une réservation SANS horaire ne doit pas échapper à la purge", () => {
    // Le piège du NULL, déjà rencontré sur l'effacement RGPD de cette même
    // table : une ligne jamais enrichie a `startTime` à NULL, et un filtre qui
    // ne porte que sur cette colonne la laisse en base pour toujours.
    const src = lire(WORKER);
    expect(src).toMatch(/startTime:\s*null,\s*capturedAt:\s*\{\s*lt:/);
  });

  it("⚠️ la décision « prospection sans limite » n'est pas touchée", () => {
    // Contre-témoin : ce lot ne doit pas avoir réintroduit une purge sur les
    // trois modèles de prospection, retirés sur ordre daté du 2026-08-20.
    const src = lire(WORKER);
    for (const modele of [
      "prospectionCompany",
      "prospectionPerson",
      "prospectionHealthPractitioner",
    ]) {
      expect(src, `${modele} ne doit PAS être purgé — ordre de Will du 2026-08-20`).not.toMatch(
        new RegExp(`prisma\\.${modele}\\.deleteMany`),
      );
    }
  });
});
