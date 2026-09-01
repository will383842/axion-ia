"use server";

/**
 * L'action qui déplace.
 *
 * ## Ce qu'elle fait, et dans quel ordre
 *
 * Elle délègue à `reporterRendezVous`, qui porte la seule règle à ne pas
 * changer : **réserver le nouveau créneau d'abord, ne libérer l'ancien
 * qu'après**. L'ordre inverse produit le seul état qu'on ne sait pas réparer —
 * un prospect sans aucun rendez-vous, dont l'ancien créneau est déjà repris,
 * et qu'on ne sait même pas qu'il faut prévenir.
 *
 * ## 🔴 CE QU'ELLE NE FAIT PAS : écrire les statuts elle-même
 *
 * Même raison que pour l'annulation, et elle vaut ici deux fois. Dans
 * `enrich.ts`, l'événement CRM et l'alerte Telegram sont conditionnés à la
 * TRANSITION de statut. Poser `canceled` sur l'ancienne ligne ferait voir à
 * `enrich` une ligne déjà annulée : ni l'événement CRM ni l'alerte ne
 * partiraient, et le déplacement disparaîtrait du CRM.
 *
 * Quant à la NOUVELLE ligne, elle n'existe pas encore : c'est le passage de
 * découverte, une minute plus tard, qui la crée. On ne la fabrique surtout pas
 * à la main — `inviteeUri` porte une contrainte d'unicité, et un second chemin
 * de création finirait par diverger du premier.
 *
 * ## ⚠️ APRÈS UN REPORT RÉUSSI, ON NE MONTRE JAMAIS D'ERREUR
 *
 * Si l'annulation de l'ancien échoue, le visiteur a quand même son nouveau
 * rendez-vous : son but est atteint. Lui afficher un échec l'inquiéterait pour
 * un problème qui n'est pas le sien. Le doublon est le nôtre — deux créneaux
 * bloqués se voient tout de suite dans l'agenda — et il déclenche une alerte.
 */

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  lireLeLien,
  CHAMP_JETON,
  CHAMP_LOCALE_ANNULATION,
  CHAMP_NOUVEAU_DEBUT,
} from "@/server/calendly/liens-rendez-vous";
import { reporterRendezVous } from "@/server/calendly/report";
import { resoudreEventTypePourReservation } from "@/server/calendly/availability";
import { enrichCalendlyEvent } from "@/server/calendly/enrich";
import { invaliderCreneaux } from "@/server/calendly/revalider-creneaux";
import { prevenir } from "@/server/calendly/alertes-reservation";
import { creneauExploitable } from "@/server/calendly/formulaire-reservation";

export async function reporterDepuisLeLien(fd: FormData): Promise<void> {
  const locale = String(fd.get(CHAMP_LOCALE_ANNULATION) ?? "fr");
  const jeton = String(fd.get(CHAMP_JETON) ?? "");
  const debutBrut = String(fd.get(CHAMP_NOUVEAU_DEBUT) ?? "");
  const base = `/${locale}/appel/reporter?t=${encodeURIComponent(jeton)}`;
  const retour = (suffixe: string): string => `${base}${suffixe}`;

  const lecture = await lireLeLien(jeton, "reschedule");
  if (!lecture.ok) redirect(base);

  // Le créneau a pu passer sous le préavis pendant que la page était ouverte.
  // Même jugement que partout ailleurs — une seule fonction, jamais une
  // comparaison rejouée. Voir `formulaire-reservation.ts`.
  if (!creneauExploitable(debutBrut, new Date())) redirect(retour("&echec=creneau_pris"));

  const rdv = await prisma.calendlyEvent.findUnique({
    where: { id: lecture.rendezVousId },
    select: {
      id: true,
      eventUri: true,
      status: true,
      inviteeName: true,
      inviteeEmail: true,
      inviteePhone: true,
      timezone: true,
      location: true,
      rawPayload: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
    },
  });
  if (!rdv || rdv.status === "canceled") redirect(base);

  const et = await resoudreEventTypePourReservation(
    process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL ?? "",
  );
  if (!et) redirect(retour("&echec=refus"));

  const r = await reporterRendezVous(rdv, et.uri, new Date(debutBrut));

  if (r.ok) {
    // L'ancienne ligne : on passe par l'UNIQUE chemin d'écriture, qui relira
    // Calendly et émettra l'événement CRM. La nouvelle sera créée par le
    // passage de découverte.
    try {
      await enrichCalendlyEvent(rdv.id);
    } catch (e) {
      console.warn(
        `[report] enrichissement en échec après report de ${rdv.id} : ` +
          `${e instanceof Error ? e.message : String(e)}. Le cron convergera.`,
      );
    }
    invaliderCreneaux("report");

    if (!r.ancienLibere) {
      // 🔴 DEUX RENDEZ-VOUS. Le visiteur a le sien, on ne lui dit rien — mais
      // il faut libérer l'ancien créneau à la main, et vite : il bloque une
      // disponibilité que personne ne peut plus prendre.
      await prevenir(
        "report_ancien_non_libere",
        "critical",
        rdv.id,
        `Report reussi, mais l'ANCIEN rendez-vous n'a pas pu etre annule.\n\n` +
          `Ancien : ${rdv.eventUri ?? "(sans URI)"}\nNouveau : ${r.nouvelEventUri}\n\n` +
          `Il y a donc DEUX creneaux bloques. Le visiteur a ete confirme sur le ` +
          `nouveau — son but est atteint, ne pas l'inquieter. Annuler l'ancien a ` +
          `la main dans Calendly.`,
      );
    }
    redirect(`/${locale}/appel/reporter?fait=1`);
  }

  switch (r.raison) {
    case "creneau_pris":
      // Cas fréquent et bénin : l'ancien rendez-vous est INTACT, et la page le
      // dit explicitement. C'est ce qui évite la panique.
      redirect(retour("&echec=creneau_pris"));
      break;

    case "silence":
      // 🔴 On ignore si le nouveau existe. L'ancien est gardé — c'est la règle.
      // Le visiteur est prié de NE PAS réessayer : une seconde tentative
      // créerait un doublon si la première avait abouti.
      await prevenir(
        "report_sans_reponse",
        "critical",
        rdv.id,
        `Report SANS REPONSE de Calendly - on ignore si le nouveau rendez-vous existe.\n\n` +
          `Ancien (INTACT) : ${rdv.eventUri ?? "(sans URI)"}\n` +
          `Creneau demande : ${debutBrut}\n\n` +
          `VERIFIER dans Calendly si le nouveau a ete cree :\n` +
          `- s'il existe, annuler l'ancien et confirmer au visiteur ;\n` +
          `- sinon, lui dire que son rendez-vous d'origine tient toujours.\n\n` +
          `Il a ete prie de ne pas reessayer.`,
      );
      redirect(retour("&echec=silence"));
      break;

    case "lieu_non_pris_en_compte":
      // Le nouveau existe, au mauvais format, et l'ancien est intact. Deux
      // rendez-vous, dont un faux : un humain doit trancher.
      await prevenir(
        "report_au_mauvais_format",
        "critical",
        rdv.id,
        `Report : le nouveau rendez-vous a ete cree AU MAUVAIS FORMAT.\n\n` +
          `Ancien (INTACT) : ${rdv.eventUri ?? "(sans URI)"}\n` +
          `Nouveau : ${r.nouvelEventUri}\nAnnuler le nouveau : ${r.cancelUrl ?? "(pas de lien)"}\n\n` +
          `DEUX rendez-vous existent. Trancher : corriger le format du nouveau et ` +
          `annuler l'ancien, ou annuler le nouveau et laisser l'ancien.`,
      );
      redirect(retour("&echec=refus"));
      break;

    case "portee_manquante":
      await prevenir(
        "portee_du_jeton_manquante_report",
        "critical",
        "portee",
        `Le jeton Calendly n'a pas le droit d'ECRIRE. AUCUN report ne passe.\n\n` +
          `Portees exigees : ${r.porteesRequises ?? "(non precisees)"}\n\n` +
          `A FAIRE : regenerer un jeton avec scheduled_events:write, le poser dans ` +
          `Coolify et redeployer.`,
      );
      redirect(retour("&echec=refus"));
      break;

    case "donnees_incompletes":
      // La ligne ne permet pas de rejouer une réservation. Ce n'est pas la
      // faute du visiteur, et il ne peut rien y faire.
      await prevenir(
        "report_donnees_incompletes",
        "warn",
        rdv.id,
        `Report impossible : il manque ${r.manque} sur la ligne ${rdv.id}.\n\n` +
          `Le visiteur a ete invite a nous ecrire. Verifier pourquoi cette ` +
          `information manque — l'enrichissement a peut-etre echoue.`,
      );
      redirect(retour("&echec=refus"));
      break;

    case "non_configure":
      redirect(retour("&echec=refus"));
      break;

    case "refus":
      await prevenir(
        "report_refuse",
        "warn",
        rdv.id,
        `Calendly a refuse le report de ${rdv.id}.\n\nMotif : ${r.detail}\n\n` +
          `L'ancien rendez-vous est intact.`,
      );
      redirect(retour("&echec=refus"));
      break;

    default:
      // 🔑 Contrôle d'exhaustivité : une raison nouvelle refuse de compiler tant
      // qu'elle n'est pas traitée ici. Sans lui, l'action se terminerait sans
      // redirection — la page se rechargerait, sans explication.
      raisonNonTraitee(r);
  }
}

function raisonNonTraitee(r: never): never {
  throw new Error(`Raison de report non traitee : ${JSON.stringify(r)}`);
}
