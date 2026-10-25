/**
 * Le rendez-vous créé dans la console APPARAÎT dans Google Agenda — donc dans
 * la page Agenda, et il ferme le créneau de la réservation en ligne.
 *
 * Avant ce module, « + Nouveau rendez-vous » n'écrivait que dans `rencontres` :
 * le créneau restait réservable chez Calendly (Calendly ne ferme un créneau que
 * via un événement « occupé » de l'agenda Google).
 *
 * Règles :
 * - AUCUN e-mail : l'événement n'a pas d'invité ;
 * - échec doux : si Google est absent ou injoignable, la rencontre reste créée,
 *   l'appelant reçoit `false` et le dit à Will ;
 * - l'identifiant Google est gardé dans `rencontres.google_event_id` ;
 * - un rendez-vous annulé ou reporté retire l'événement (aucune action « annuler »
 *   n'existe encore pour une rencontre saisie : le « reporté » du suivi est le seul
 *   chemin ; l'annulation Calendly ne concerne pas ces rencontres).
 */

import type { BaseTransactionnelle } from "./base";

export interface EntreePoserDansGoogle {
  readonly rencontreId: string;
  readonly titre: string;
  readonly debut: Date;
  readonly fin: Date;
  readonly type: "visio" | "telephone" | "presentiel";
  readonly lieu?: string | null;
  readonly objet?: string | null;
  readonly contact?: string | null;
  readonly telephone?: string | null;
}

const CANAL = { visio: "visio", telephone: "telephone", presentiel: "sur_place" } as const;

/** Pose l'événement et garde son identifiant. Ne lève jamais : rend `true` si posé. */
export async function poserDansGoogleAgenda(
  db: BaseTransactionnelle,
  e: EntreePoserDansGoogle,
): Promise<boolean> {
  try {
    const { creerRendezVous } = await import("@/server/google-calendar/events");
    const { COULEUR_GOOGLE_CANAL } = await import("@/server/calendly/canal");
    const note = [e.objet ? `Objet : ${e.objet}` : null, e.lieu ? `Lieu : ${e.lieu}` : null]
      .filter((x): x is string => x !== null)
      .join("\n");
    const res = await creerRendezVous({
      titre: e.titre,
      debut: e.debut,
      fin: e.fin,
      contact: e.contact ?? null,
      telephone: e.telephone ?? null,
      note: note === "" ? null : note,
      couleur: COULEUR_GOOGLE_CANAL[CANAL[e.type]],
    });
    if (!res.ok || res.id === "") return false;
    const id = res.id;
    await db.$transaction((tx) =>
      tx.rencontre.update({ where: { id: e.rencontreId }, data: { googleEventId: id } }),
    );
    return true;
  } catch (err) {
    console.warn("[agenda-google] pose du rendez-vous en échec", err);
    return false;
  }
}

/** Retire l'événement d'un rendez-vous annulé ou reporté. Ne lève jamais. */
export async function retirerDeGoogleAgenda(
  db: BaseTransactionnelle,
  rencontreId: string,
): Promise<void> {
  try {
    const r = await db.$transaction((tx) =>
      tx.rencontre.findUnique({
        where: { id: rencontreId },
        select: { statut: true, googleEventId: true },
      }),
    );
    if (r === null || !r.googleEventId) return;
    if (r.statut !== "annule" && r.statut !== "reporte") return;
    const { retirerEvenement } = await import("@/server/google-calendar/events");
    const res = await retirerEvenement(r.googleEventId);
    if (res.ok) {
      await db.$transaction((tx) =>
        tx.rencontre.update({ where: { id: rencontreId }, data: { googleEventId: null } }),
      );
    }
  } catch (err) {
    console.warn("[agenda-google] retrait du rendez-vous en échec", err);
  }
}
