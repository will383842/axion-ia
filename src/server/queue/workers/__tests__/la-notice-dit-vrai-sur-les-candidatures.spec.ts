// @vitest-environment node

/**
 * Verrou — la notice publique et la purge doivent dire la MÊME chose des
 * candidatures.
 *
 * ## Le défaut qu'il ferme
 *
 * Jusqu'au 2026-09-03, `src/content/legal.ts` ne mentionnait pas une seule fois
 * les candidatures. Le site collectait pourtant, depuis `/carrieres`, un nom, un
 * téléphone, une ville, un CV et une photographie — les données les plus
 * sensibles du dépôt — sans en publier ni la finalité, ni la base légale, ni la
 * durée. La politique de confidentialité annonçait trois durées (clients,
 * demandes commerciales, journaux techniques) et la quatrième n'existait nulle
 * part.
 *
 * La section a été écrite. Ce fichier existe pour qu'elle ne redevienne pas
 * fausse : le dépôt a deux précédents documentés où le code a changé et le texte
 * publié est resté (Calendly absent de la liste des sous-traitants pendant
 * quatorze mois, Google Agenda déclaré sans flux alors que la console y écrivait
 * des noms). Les deux fois, la parade manquante n'était pas une note de
 * vigilance — il en existait déjà — mais un contrôle qui refuse l'incohérence.
 *
 * ## Ce qu'il vérifie, et ce qu'il ne vérifie pas
 *
 * ✅ Que la durée publiée est EXACTEMENT celle que la purge applique.
 * ✅ Que l'exception des personnes recrutées est annoncée tant qu'elle existe
 *    dans le code — les deux moitiés sont couplées, retirer l'une rougit.
 * ✅ Que la notice continue d'annoncer une suppression pour les candidatures non
 *    retenues (témoin inverse : sans lui, tout supprimer du worker passerait).
 *
 * ❌ Il ne juge pas la rédaction. C'est une garde de forme, et elle le dit —
 *    même honnêteté que `la-retention-des-appels-suit-la-notice.spec.ts`, dont
 *    il reprend la méthode.
 *
 * ⚠️ Il ne peut rien contre une surcharge d'environnement : `readMonths` lit
 *    `RETENTION_CANDIDATURES_MONTHS` avant le défaut. Poser cette variable en
 *    production ferait mentir la notice sans que rien ne rougisse. C'est la même
 *    limite que pour toutes les durées de ce worker ; elle est écrite ici plutôt
 *    que sous-entendue.
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

/** La durée annoncée au public, en mois. */
const DUREE_PUBLIEE = /Candidature non retenue\s*:\s*(\d+)\s*mois/;
/** La durée réellement appliquée, lue dans les défauts du worker. */
const DUREE_APPLIQUEE = /candidatures:\s*(\d+)/;

describe("la notice dit vrai sur les candidatures", () => {
  it("🔴 la notice publique annonce une durée pour les candidatures non retenues", () => {
    const mois = DUREE_PUBLIEE.exec(lire(NOTICE))?.[1];
    expect(
      mois,
      "la phrase « Candidature non retenue : N mois » a disparu de src/content/legal.ts. " +
        "Le site collecte des CV, des photographies et des numéros de téléphone : la durée " +
        "de conservation doit être publiée (RGPD art. 13.2.a). Si la notice a été " +
        "reformulée, mettre ce test à jour EN MÊME TEMPS.",
    ).toBeDefined();
    expect(Number(mois)).toBeGreaterThan(0);
  });

  it("🔴 la durée appliquée par la purge est EXACTEMENT celle qui est publiée", () => {
    const publiee = Number(DUREE_PUBLIEE.exec(lire(NOTICE))?.[1]);
    const appliquee = Number(DUREE_APPLIQUEE.exec(lire(WORKER))?.[1]);

    expect(appliquee, "`DEFAULTS.candidatures` introuvable dans le worker").toBeGreaterThan(0);
    expect(
      appliquee,
      `la notice publique annonce ${publiee} mois mais la purge s'applique à ${appliquee} mois. ` +
        "Les deux doivent dire la même chose : corriger celle des deux qui a tort.",
    ).toBe(publiee);
  });

  it("🔴 tant que la purge épargne les personnes recrutées, la notice le dit", () => {
    // 🔑 Les deux moitiés sont COUPLÉES à dessein. Une garde qui ne testerait
    // que la notice laisserait passer un code qui recommence à effacer ; une
    // garde qui ne testerait que le code laisserait passer une notice muette
    // sur un régime de conservation plus long — ce qui est précisément le
    // reproche qu'on fait à une politique de confidentialité incomplète.
    const codeEpargne = /notIn:\s*\[\s*"hired"\s*\]/.test(lire(WORKER));
    const noticeLeDit = /dossier du personnel/i.test(lire(NOTICE));

    expect(
      noticeLeDit,
      codeEpargne
        ? "la purge épargne les candidatures `hired` (décision D4) mais la notice ne " +
            "l'annonce plus : une conservation plus longue que la durée publiée n'est pas " +
            "défendable. Rétablir la section « Conservation des candidatures »."
        : "la notice annonce un régime « dossier du personnel » que le code n'applique " +
            'plus : soit rétablir l\'exclusion `notIn: ["hired"]` dans le worker, soit ' +
            "retirer l'annonce.",
    ).toBe(codeEpargne);
  });

  it("les candidatures non retenues sont bien SUPPRIMÉES — la notice ne promet pas l'éternité", () => {
    // 🔑 Témoin inverse. Sans lui, retirer purement et simplement le bloc de
    // purge des candidatures ferait passer tous les cas ci-dessus : on
    // prouverait la conformité par une conservation sans limite, qui est
    // l'autre non-conformité.
    const src = lire(WORKER);
    expect(
      src,
      "aucune suppression de candidature dans le worker : la notice annoncerait une " +
        "durée que rien n'applique",
    ).toMatch(/prisma\.jobApplication\.delete\(/);
    expect(
      lire(NOTICE),
      "la notice doit continuer d'annoncer une suppression automatique pour les " +
        "candidatures non retenues",
    ).toMatch(/suppression automatique/);
  });
});
