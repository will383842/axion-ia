/**
 * Les alertes de la réservation directe, en un seul endroit.
 *
 * ## 🔴 POURQUOI CE MODULE EXISTE : UNE ALERTE ÉCRITE ET INATTEIGNABLE
 *
 * L'alerte « repli permanent » vivait dans l'action de formulaire. Elle avait sa
 * justification, longue et juste : quand le drapeau est allumé et que
 * l'event-type devient illisible, le formulaire n'apparaît plus pour PERSONNE,
 * tout le monde repart chez Calendly — ce qui fonctionne — et rien ne le
 * signale.
 *
 * Elle ne pouvait pas se déclencher. La PAGE fait le même appel, **avant**, et
 * redirige sur `null` sans alerter. Quand la résolution tombe en panne, aucun
 * visiteur n'atteint donc jamais le formulaire, donc aucun POST n'est émis,
 * donc l'action n'est jamais appelée. La seule branche qui alertait ne se
 * déclenchait que si quelqu'un postait à la main sur l'action.
 *
 * Troisième cas d'échec déclaré et inatteignable trouvé dans ce lot en une
 * journée. La cause est chaque fois la même : **la protection a été posée sur
 * le chemin qu'on avait sous les yeux, pas sur celui que les visiteurs
 * empruntent.**
 *
 * D'où ce module, appelé par la page ET par l'action, avec la même clé de
 * déduplication pour qu'une panne ne produise qu'une alerte par quart d'heure
 * plutôt qu'une par visiteur.
 */

import { notify } from "@/server/notifications";
import type { NotificationSeverity } from "@/server/notifications/types";

/**
 * Signale sans jamais faire échouer ce qui l'appelle.
 *
 * 🔑 Une alerte qui lèverait remplacerait une réservation réussie par un écran
 * d'erreur — le pire échange possible.
 *
 * ⚠️ ET ELLE LIT LE RÉSULTAT. `notify` ne lève pas quand elle refuse : elle rend
 * `{ ok: true, deduped }` ou `{ ok: true, rateLimited }`. La catégorie
 * `MONITORING_ALERT` est plafonnée à 30 par heure, TOUTES SOURCES CONFONDUES —
 * une supervision bavarde peut donc consommer les crédits et faire jeter en
 * silence la première alerte d'une panne totale. Un `try/catch` seul ne voit
 * rien de ça : il n'y a pas d'exception à attraper.
 */
export async function prevenir(
  kind: string,
  severity: NotificationSeverity,
  discriminant: string,
  corps: string,
): Promise<void> {
  try {
    const r = await notify({
      category: "MONITORING_ALERT",
      severity,
      payload: { kind, details: { legacyBody: corps } },
      // ⚠️ LE DISCRIMINANT NE PORTE JAMAIS DE DONNÉE PERSONNELLE. Une clé de
      // déduplication devient une clé Redis : elle se lit dans un `SCAN`, dans
      // le journal des commandes lentes, et surtout elle atterrit dans les
      // sauvegardes. L'adresse e-mail du visiteur y a figuré pendant une heure,
      // dans le même fichier qui expliquait, deux cents lignes plus haut,
      // pourquoi on ne la met jamais dans une URL.
      dedupKey: `reservation-directe:${kind}:${discriminant}`,
      dedupTtlSec: 900,
    });

    // Un rejet de quota sur une alerte `critical` est lui-même un incident : la
    // panne qu'on voulait signaler reste invisible. On le journalise, faute de
    // pouvoir alerter sur l'échec d'une alerte.
    if (severity === "critical" && (r.rateLimited || r.deduped)) {
      console.warn(
        `[reservation-directe] alerte « ${kind} » NON DÉLIVRÉE ` +
          `(${r.rateLimited ? "quota horaire de MONITORING_ALERT atteint" : "déjà signalée"}). ` +
          `La panne signalée reste réelle.`,
      );
    }
  } catch (e) {
    console.warn(
      `[reservation-directe] alerte « ${kind} » non émise : ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Le formulaire se replie alors que son drapeau est allumé.
 *
 * Appelée depuis la page ET depuis l'action — voir l'en-tête de ce fichier pour
 * la raison, qui n'est pas la prudence mais une correction de défaut.
 */
export async function signalerRepliPermanent(): Promise<void> {
  await prevenir(
    "repli_permanent",
    "critical",
    "resolution",
    `Le formulaire de reservation se replie alors que son drapeau est ALLUME.\n\n` +
      `Cause probable : jeton Calendly absent ou refuse, API injoignable, ou une ` +
      `question ajoutee chez Calendly que notre formulaire ne sait pas poser ` +
      `(voir les journaux du conteneur, prefixe [calendly-availability]).\n\n` +
      `Consequence : AUCUN visiteur n'atteint le formulaire. Ils partent tous ` +
      `chez Calendly, ce qui fonctionne — donc rien ne casse, et personne ne ` +
      `s'en apercevra sans cette alerte.`,
  );
}
