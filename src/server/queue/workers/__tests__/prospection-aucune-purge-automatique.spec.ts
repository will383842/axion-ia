/**
 * 🛑 LES FICHES DE PROSPECTION NE SONT JAMAIS SUPPRIMÉES AUTOMATIQUEMENT.
 *
 * **Décision du responsable de traitement, 2026-08-20** : « je veux tout garder
 * et ne jamais les supprimer […] j'effacerai manuellement quand je le
 * souhaiterai, sans que tu me le rappelles. »
 *
 * Portée : `ProspectionCompany` (~4,29 M fiches), `ProspectionPerson`
 * (~1,32 M fiches nominatives) et `ProspectionHealthPractitioner`.
 *
 * ## Ce que ce fichier garde, et pourquoi il n'est pas un rappel
 *
 * Une alerte console avait été livrée le même jour pour compter les fiches
 * sur-conservées. Elle a été **retirée** : elle aurait rappelé à chaque passage
 * une décision déjà prise, et une console qui répète une question tranchée
 * apprend à être ignorée.
 *
 * Ce fichier fait l'inverse. Il ne rappelle rien : il **empêche**. Si un
 * `deleteMany` réapparaît un jour sur l'un de ces trois modèles — par un
 * correctif automatique, une reprise d'audit, ou quelqu'un qui « répare » la
 * rétention sans connaître la décision — la suite rougit.
 *
 * ## Pourquoi retirer le code plutôt que le désactiver
 *
 * Les `deleteMany` d'origine filtraient sur `retentionUntil`, colonne qu'aucun
 * code de ce dépôt n'écrit pour ces modèles : ils ne supprimaient rien
 * AUJOURD'HUI. Mais les tables sont alimentées par Axion CRM Pro, un dépôt
 * séparé, et renseigner cette colonne est le rôle naturel d'un CRM.
 *
 * 🔑 **Un effacement de masse qui s'arme par un changement fait AILLEURS n'est
 * pas un effacement décidé.** Un drapeau à `false` n'aurait pas suffi : il se
 * bascule, et il aurait laissé croire que la question restait ouverte.
 *
 * ## Ce qui reste purgé, et qui n'est pas concerné
 *
 * `ProspectionAccessLog` — le journal technique de qui a consulté quoi, avec sa
 * propre durée (12 mois). Ce n'est pas une fiche. La décision porte sur les
 * FICHES.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(
  process.cwd(),
  "src",
  "server",
  "queue",
  "workers",
  "retention-purge-worker.ts",
);

/**
 * ⚠️ Les commentaires sont RETIRÉS avant analyse. Ce fichier-ci, comme le
 * worker, parle abondamment de `prospectionCompany.deleteMany` en prose — un
 * test statique qui trouverait ses propres explications serait un faux positif,
 * et le dépôt l'a déjà payé.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const MODELES_INTOUCHABLES = [
  "prospectionCompany",
  "prospectionPerson",
  "prospectionHealthPractitioner",
] as const;

describe("🛑 fiches de prospection — aucune suppression automatique", () => {
  it("le fichier du worker est bien lu — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ. Si le worker était renommé ou déplacé, `readFileSync`
    // lèverait ; mais une source vide ou tronquée passerait tous les cas
    // ci-dessous au vert, et l'absence d'alerte se lirait comme une absence de
    // problème.
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    expect(code).toContain("executerPurgeRetention");
    expect(code.length).toBeGreaterThan(5_000);
  });

  it("🛑 aucun `deleteMany` sur les fiches entreprises, personnes ou praticiens", () => {
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    const fautifs = MODELES_INTOUCHABLES.filter((m) =>
      new RegExp(`prisma\\.${m}\\s*\\.\\s*delete`).test(code),
    );
    expect(
      fautifs,
      "Une suppression automatique a été réintroduite sur des fiches de " +
        "prospection. C'est INTERDIT par décision du responsable de traitement " +
        "(2026-08-20) : ces fiches se conservent sans limite et ne s'effacent " +
        "qu'à la main. Ne pas « réparer » la rétention ici sans un nouvel " +
        "arbitrage explicite de sa part.",
    ).toEqual([]);
  });

  it("🛑 aucune alerte ne rappelle la question — elle est tranchée", () => {
    // La décision inclut « sans que tu me le rappelles ». Une alerte console
    // ré-introduite serait un rappel, donc une désobéissance polie.
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    expect(code).not.toContain("retention_prospection_sans_horizon");
    expect(code, "le worker ne doit plus lever d'alerte sur ce sujet").not.toContain(
      "creerOuDedup",
    );
  });

  it("le journal d'ACCÈS reste purgé — il n'est pas concerné par la décision", () => {
    // Témoin inverse : sans lui, un correctif qui viderait tout le bloc
    // prospection ferait passer les cas ci-dessus en supprimant aussi une purge
    // légitime. On prouverait l'obéissance par la destruction.
    const code = sansCommentaires(readFileSync(SOURCE, "utf8"));
    expect(code).toMatch(/prisma\.prospectionAccessLog\s*\.\s*deleteMany/);
  });
});
