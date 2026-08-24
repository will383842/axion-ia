/**
 * L'ÉMETTEUR de l'alerte de clôture incomplète — un seul, pour tous les chemins.
 *
 * ## Le défaut (2026-08-24, cahier D2)
 *
 * 🔴 La clôture **manuelle** signalait ce cas. La clôture **automatique** — le
 * cron J+24 h, c'est-à-dire le chemin **dominant** — ne le signalait pas : le
 * worker importait `mesurerTraceCloture` et `clotureSansAucuneTrace`, mais
 * **pas** `traceClotureIncomplete`. La mesure était faite, le cas partiel
 * simplement jamais lu.
 *
 * Conséquence : onze stagiaires sur douze sans aucune preuve de présence, la
 * session passait en « réalisée » en silence, `attestations-auto` délivrait
 * ensuite les attestations, et personne n'apprenait rien.
 *
 * 🔑 **On n'a pas recopié le bloc du chemin manuel.** `trace-cloture.ts`
 * raconte lui-même pourquoi : `CONF-01` (2026-08-20) a dédupliqué la MESURE,
 * qui vivait aux deux endroits sous un commentaire priant de les garder
 * alignées. Recopier l'ÉMISSION aurait recréé exactement la divergence qu'on
 * venait de fermer, un cran plus loin.
 *
 * ## Pourquoi ce module, et pas `trace-cloture.ts`
 *
 * ⚠️ L'émetteur a d'abord été posé dans `trace-cloture.ts`, à côté de la
 * mesure. Mauvaise idée, et la suite de tests l'a dit tout de suite :
 * `trace-cloture.ts` est un module de **mesure**, qui n'importait que Prisma.
 * Lui faire importer le service d'alertes y a tiré toute la chaîne
 * d'authentification, et `trace-cloture.spec.ts` ne pouvait plus se charger.
 *
 * La mesure reste donc légère et testable seule ; l'émission vit ici, dans le
 * domaine dont c'est le métier.
 */

import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import {
  traceClotureIncomplete,
  type TraceClotureSession,
} from "@/server/qualiopi/presence/trace-cloture";

/**
 * Signale qu'une session a été clôturée alors que des inscrits actifs n'ont
 * aucune trace de présence.
 *
 * ⚠️ **Ne bloque pas**, et c'est un arbitrage déjà pris et écrit dans
 * `trace-cloture.ts` : le durcissement rendrait des sessions définitivement non
 * clôturables. On signale, et l'alerte nomme les deux gestes qui la résolvent.
 *
 * Fail-soft, comme la mesure : une panne d'écriture d'alerte ne doit pas
 * empêcher une session réellement tenue de se clôturer.
 *
 * Ne fait rien si la mesure a échoué (`null`), ou si le dossier est complet, ou
 * s'il est entièrement vide — ce dernier cas relève de `clotureSansAucuneTrace`,
 * qui refuse la clôture en amont.
 */
export function signalerClotureIncomplete(
  sessionId: string,
  trace: TraceClotureSession | null,
): void {
  if (trace === null || !traceClotureIncomplete(trace)) return;

  void creerOuDedup({
    code: "cloture_trace_presence_incomplete",
    niveau: "important",
    titre: "Session clôturée sans trace de présence pour tous les inscrits",
    message:
      `${trace.sansTrace} inscrit(s) actif(s) sur ${trace.totalActifs} ` +
      `n'ont aucune trace de présence, alors que la session est passée en « réalisée ». ` +
      `Une attestation délivrée à ces personnes ne serait adossée à aucune preuve. ` +
      `Deux gestes possibles : compléter la feuille d'émargement ou le relevé de ` +
      `connexion, ou passer en « abandon » ceux qui ont renoncé.`,
    cibleType: "TrainingSession",
    cibleId: sessionId,
  }).catch(() => {});
}
