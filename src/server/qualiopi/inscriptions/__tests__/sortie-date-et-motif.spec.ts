/**
 * 🛑 GARDE — une sortie du dispositif a une DATE et une RAISON.
 *
 * ## Le défaut que cette garde ferme
 *
 * Mesuré le 2026-08-27, sur une question de Will : « notre système Qualiopi
 * gère-t-il les abandons ? »
 *
 * Réponse mesurée : oui, et mieux que je ne le craignais. `abandon` était un
 * vrai statut d'inscription, correctement câblé PARTOUT — sorti des
 * inscriptions actives (`STATUTS_SORTIS`), sorti des moyennes de présence
 * (`STATUTS_HORS_MOYENNE`), exclu de la génération automatique d'attestation
 * (le cron ne traite que `planifiee` / `presente`), visible sur la feuille
 * d'émargement parce que c'est le contexte de la séance, et compté par
 * l'indicateur `m4_taux_abandon` affiché sur l'écran de pilotage.
 *
 * **Il manquait le QUAND et le POURQUOI.** `setEnrollmentStatutAction`
 * écrivait `data: { statut }` — rien d'autre. Conséquences concrètes :
 *
 * - sans DATE, impossible de dire combien d'heures ont réellement été suivies :
 *   pas de certificat de réalisation juste, pas de facturation au prorata ;
 * - sans MOTIF, l'indicateur rend un CHIFFRE que personne ne peut analyser. Un
 *   auditeur qui demande « pourquoi abandonne-t-on chez vous, et qu'avez-vous
 *   fait ? » n'avait rien à lire — et c'est précisément ce qu'un indicateur de
 *   résultat doit permettre.
 *
 * ## Ce que cette garde vérifie
 *
 * Que les deux moitiés restent en place, et surtout qu'elles restent
 * COHÉRENTES entre le client et le serveur : l'écran propose la saisie d'un
 * motif pour les statuts qu'il croit être des sorties, le serveur l'exige pour
 * ceux que `STATUTS_SORTIS` désigne. Si les deux listes divergent, on obtient
 * soit un motif réclamé pour rien, soit une sortie enregistrable sans raison —
 * le défaut revenu par la porte de derrière.
 *
 * ## 🔑 Pourquoi ce fichier vit DANS le domaine et non sous `tests/unit/`
 *
 * Il importe `STATUTS_SORTIS` — donc il consomme le domaine Qualiopi.
 * `qualiopi:isolation-check` refuse cette consommation depuis une surface qui
 * ne la faisait pas : le cloisonnement n'est pas décoratif.
 *
 * ⚠️ Ce contrôle est passé VERT en local pendant que la CI le refusait. Il
 * énumère par `git ls-files` : tant que le fichier n'était pas `git add`é, il
 * n'existait pas pour lui. **Un contrôle statique est aveugle au travail pas
 * encore suivi** — lancer `git add -A` avant de croire son vert.
 *
 * ## Ce que cette garde ne couvre PAS
 *
 * La contrainte `CHECK` en base (`enrollments_sortie_coherente_check`), qui est
 * le vrai filet : elle refuse une sortie sans date ni motif, ET une inscription
 * active qui porterait une date fantôme. Elle se teste en base, pas ici — Gate D
 * la joue sur une base fraîche.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { STATUTS_SORTIS } from "@/server/qualiopi/inscriptions/inscriptions-actives";

const ACTION = "src/server/actions/qualiopi/enrollments.ts";
const ECRAN = "src/components/admin/qualiopi/EnrollmentsSection.tsx";

function lire(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8");
}

describe("🛑 une sortie du dispositif a une date et une raison", () => {
  it("🔑 le client et le serveur s'accordent sur CE QU'EST une sortie", () => {
    // Le client ne peut pas importer le module serveur (il tirerait Prisma dans
    // le navigateur), donc les deux listes existent en double. Une duplication
    // qu'on ne vérifie pas finit par diverger — c'est la leçon la plus chère de
    // ce dépôt, payée sur les rôles le matin même.
    //
    // ⚠️ On lit le TEXTE de l'écran plutôt que de l'importer : une frontière de
    // modules interdit à `tests/` de tirer depuis `components/`. Un contrôle
    // textuel est plus faible qu'un import — d'où le contre-témoin ci-dessous,
    // qui refuse une extraction vide. Sans lui, renommer la constante rendrait
    // ce test vert en ne comparant plus rien.
    const litteral = /export const STATUTS_DE_SORTIE[^=]*=\s*\[([^\]]*)\]/.exec(lire(ECRAN));
    expect(
      litteral,
      "`STATUTS_DE_SORTIE` est introuvable dans l'écran : ce test ne compare plus rien.",
    ).not.toBeNull();

    const cote = (litteral?.[1] ?? "")
      .split(",")
      .map((m) => m.trim().replace(/^["']|["']$/g, ""))
      .filter((m) => m !== "");
    expect(cote.length, "extraction vide : le test ne mesure rien").toBeGreaterThan(0);

    expect(
      [...cote].sort(),
      "L'écran et le serveur ne s'accordent plus sur les statuts de sortie : " +
        "soit un motif est réclamé pour rien, soit une sortie s'enregistre sans raison.",
    ).toEqual([...STATUTS_SORTIS].sort());
  });

  it("l'action REFUSE une sortie sans motif", () => {
    const source = lire(ACTION);
    // 🔑 On vérifie que le refus dérive du SSOT, pas d'une liste recopiée :
    // le jour où un statut de sortie s'ajoute à l'énumération, il doit être
    // daté et motivé sans que personne n'y pense.
    expect(
      source,
      "`STATUTS_SORTIS` n'est plus importé par l'action : la règle a été " +
        "recopiée, elle divergera.",
    ).toContain('from "@/server/qualiopi/inscriptions/inscriptions-actives"');
    expect(
      source,
      "L'action n'exige plus de motif : une sortie redevient enregistrable sans raison.",
    ).toMatch(/estSortie && motifPropre === ""/);
  });

  it("l'action DATE la sortie, et efface la date au retour", () => {
    const source = lire(ACTION);
    expect(source, "la sortie n'est plus datée").toContain("sortieAt: new Date()");
    // 🔑 Le second sens compte autant. Sans l'effacement, annuler une sortie
    // laisserait une date fantôme que les rapports liraient comme une sortie
    // réelle — et la contrainte CHECK refuserait l'écriture.
    expect(
      source,
      "un retour à un statut actif n'efface plus la date : une sortie annulée " +
        "laisserait une date fantôme.",
    ).toContain("sortieAt: null, sortieMotif: null");
  });

  it("l'écran RÉCLAME le motif avant d'envoyer, pas après", () => {
    const source = lire(ECRAN);
    // Poser le statut d'abord et demander le motif ensuite rendrait une sortie
    // non motivée enregistrable en fermant l'onglet. Le statut et son motif
    // partent ensemble, ou ne partent pas.
    expect(source, "l'écran n'ouvre plus de saisie de motif : le statut partirait seul.").toContain(
      "setSortieEnAttente(statut)",
    );
    expect(source, "le bouton d'envoi ne vérifie plus que le motif est renseigné.").toMatch(
      /disabled=\{isPendingStatut \|\| motifText\.trim\(\) === ""\}/,
    );
  });

  it("🔑 le taux d'abandon est accompagné de ses MOTIFS", () => {
    // Sans ce témoin, on pourrait retirer l'affichage des motifs et revenir à
    // un chiffre seul — l'état exact qu'on corrige — sans qu'aucun test ne
    // rougisse : la saisie continuerait de fonctionner, mais personne ne lirait
    // jamais ce qu'elle produit.
    const service = lire("src/server/qualiopi/conformite/pilotage-service.ts");
    expect(service, "les motifs ne sont plus calculés").toContain("m4_motifs_abandon");
    expect(service, "les motifs ne sont plus regroupés par fréquence").toContain(
      'by: ["sortieMotif"]',
    );

    const ecran = lire("src/app/[locale]/(admin)/[adminPrefix]/qualiopi/pilotage/page.tsx");
    expect(
      ecran,
      "l'écran de pilotage n'affiche plus les motifs : M4 redevient un chiffre " +
        "que personne ne peut analyser.",
    ).toContain("m4_motifs_abandon");
  });

  it("🔑 la migration REPREND l'existant avant de poser la contrainte", () => {
    // Sans reprise, la contrainte échouerait sur toute base portant déjà des
    // sorties (~3 000 en base de dev). Une migration qui ne passe que sur une
    // base vide n'est pas une migration.
    const sql = lire("prisma/migrations/20260827150000_sortie_date_et_motif/migration.sql");
    const posUpdate = sql.indexOf("UPDATE ");
    const posCheck = sql.indexOf("ADD CONSTRAINT");
    expect(posUpdate, "la migration ne reprend plus l'existant").toBeGreaterThan(0);
    expect(posCheck, "la contrainte a disparu").toBeGreaterThan(0);
    expect(
      posUpdate,
      "la contrainte est posée AVANT la reprise : elle échouera sur toute base " +
        "portant déjà des abandons.",
    ).toBeLessThan(posCheck);
  });
});
