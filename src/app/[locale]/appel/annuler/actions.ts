"use server";

/**
 * L'action qui annule.
 *
 * ## 🔴 ON N'ÉCRIT PAS LE STATUT NOUS-MÊMES, ET C'EST LA DÉCISION LA MOINS
 * ÉVIDENTE DU FICHIER
 *
 * Le réflexe serait `prisma.calendlyEvent.update({ status: "canceled" })` juste
 * après l'appel réussi. Ce serait une panne silencieuse, pour une raison qui ne
 * se voit pas d'ici.
 *
 * Dans `enrich.ts`, l'événement CRM et l'alerte Telegram sont conditionnés à la
 * **TRANSITION**, pas à l'état :
 *
 * ```
 * const canceled = mapped === "canceled" && row.status !== "canceled" && !terminal;
 * ```
 *
 * Si nous posons le statut nous-mêmes, `enrich` verra ensuite une ligne DÉJÀ
 * annulée, `canceled` vaudra `false`, et **ni l'événement CRM ni l'alerte ne
 * partiront**. L'annulation disparaîtrait du CRM et de Telegram sans que rien
 * ne casse.
 *
 * On appelle donc `enrichCalendlyEvent`, qui est l'UNIQUE chemin d'écriture :
 * il relit Calendly, pose le statut, émet l'événement CRM et l'alerte
 * dédupliquée. C'est le raisonnement que la route de webhook tient déjà sous
 * « pourquoi cette route ne persiste rien elle-même » : un second chemin
 * d'écriture finit toujours par diverger du premier.
 *
 * ## Pourquoi l'appel est SYNCHRONE ici, et pas laissé au cron
 *
 * Le passage de rafraîchissement tourne toutes les dix minutes et traite
 * vingt-cinq lignes au plus. Or les rappels J-1 et H-1 sont mis en file par une
 * passe qui ne retient que les rendez-vous encore « planifiés ».
 *
 * 🔴 Conséquence, et c'est un défaut VIVANT du produit, indépendant de ce
 * chantier : quelqu'un qui annule via le lien Calendly dans les dix minutes
 * précédant la fenêtre du rappel H-1 **reçoit quand même son rappel**. Rien en
 * aval ne le rattrape — le service d'envoi ne relit pas le statut avant de
 * partir.
 *
 * Mettre la base à jour DANS CETTE REQUÊTE ferme ce trou pour les annulations
 * faites chez nous. Il reste ouvert pour celles faites sur Calendly, et pour le
 * rappel mis en file dans les secondes qui précèdent. ⚠️ À ne pas déclarer
 * couvert.
 */

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  lireLeLien,
  CHAMP_JETON,
  CHAMP_LOCALE_ANNULATION,
} from "@/server/calendly/liens-rendez-vous";
import { annulerRendezVous } from "@/server/calendly/annulation";
import { enrichCalendlyEvent } from "@/server/calendly/enrich";
import { invaliderCreneaux } from "@/server/calendly/revalider-creneaux";
import { prevenir } from "@/server/calendly/alertes-reservation";

export async function annulerDepuisLeLien(fd: FormData): Promise<void> {
  const locale = String(fd.get(CHAMP_LOCALE_ANNULATION) ?? "fr");
  const jeton = String(fd.get(CHAMP_JETON) ?? "");
  const retour = (suffixe: string): string => `/${locale}/appel/annuler${suffixe}`;

  const lecture = await lireLeLien(jeton, "cancel");
  if (!lecture.ok) {
    // Le jeton était bon à l'affichage et ne l'est plus : expiration pendant
    // que la page était ouverte. On renvoie à la page, qui saura le dire.
    redirect(retour(`?t=${encodeURIComponent(jeton)}`));
  }

  const rdv = await prisma.calendlyEvent.findUnique({
    where: { id: lecture.rendezVousId },
    select: { id: true, eventUri: true, status: true },
  });

  if (!rdv) redirect(retour("?deja=1"));
  if (rdv.status === "canceled") redirect(retour("?deja=1"));
  if (!rdv.eventUri) {
    // Une ligne sans URI d'événement ne peut pas être annulée par l'API. Cela
    // n'arrive que si l'enrichissement n'a jamais abouti — donc une anomalie,
    // pas un cas visiteur.
    await prevenir(
      "annulation_sans_uri",
      "warn",
      rdv.id,
      `Demande d'annulation sur une ligne sans eventUri (${rdv.id}).\n\n` +
        `La ligne existe mais n'a jamais ete enrichie : l'API ne peut pas etre ` +
        `appelee. Le visiteur a ete invite a nous ecrire. Verifier pourquoi ` +
        `l'enrichissement n'a pas abouti sur cette reservation.`,
    );
    redirect(retour(`?t=${encodeURIComponent(jeton)}&echec=refus`));
  }

  const r = await annulerRendezVous(rdv.eventUri);

  if (r.ok) {
    // 🔑 L'UNIQUE chemin d'écriture. Voir l'en-tête : écrire le statut nous-mêmes
    // ferait disparaître l'événement CRM et l'alerte Telegram, qui dépendent de
    // la TRANSITION.
    try {
      await enrichCalendlyEvent(rdv.id);
    } catch (e) {
      // Une synchronisation ratée ne remet pas l'annulation en cause : elle a
      // eu lieu chez Calendly, qui fait autorité. Le passage de dix minutes
      // convergera. On le dit, on ne le cache pas.
      console.warn(
        `[annulation] enrichissement en échec après annulation de ${rdv.id} : ` +
          `${e instanceof Error ? e.message : String(e)}. Le cron convergera.`,
      );
    }
    // Le créneau redevient disponible : la page /appel doit cesser de le taire.
    invaliderCreneaux("annulation");
    redirect(retour(r.deja ? "?deja=1" : "?fait=1"));
  }

  switch (r.raison) {
    case "silence":
      // ⚠️ On ne sait pas si l'annulation a eu lieu. Dire « c'est annulé »
      // serait faux la moitié du temps ; dire « erreur » ferait recliquer.
      await prevenir(
        "annulation_sans_reponse",
        "critical",
        rdv.id,
        `Annulation SANS REPONSE de Calendly - on ignore si elle a eu lieu.\n\n` +
          `Rendez-vous : ${rdv.id}\nEvenement : ${rdv.eventUri}\n\n` +
          `VERIFIER dans Calendly, puis confirmer au visiteur ou lui dire que son ` +
          `rendez-vous tient toujours. Il a ete invite a reessayer.`,
      );
      redirect(retour(`?t=${encodeURIComponent(jeton)}&echec=silence`));
      break;

    case "non_confirme":
      // L'API a rendu 201 mais la relecture ne dit pas « annulé ». Même
      // prudence que le silence : on ne confirme pas ce qu'on n'a pas vu.
      await prevenir(
        "annulation_non_confirmee",
        "critical",
        rdv.id,
        `Calendly a rendu 201 mais l'evenement n'est PAS marque annule.\n\n` +
          `Rendez-vous : ${rdv.id}\nEvenement : ${rdv.eventUri}\n\n` +
          `L'API accepte des champs qu'elle ignore : un 201 ne prouve pas qu'elle ` +
          `a compris. Verifier a la main.`,
      );
      redirect(retour(`?t=${encodeURIComponent(jeton)}&echec=silence`));
      break;

    case "portee_manquante":
      // 🔴 Panne de configuration : PLUS PERSONNE ne peut annuler. Rangée dans
      // « refus », elle se déguiserait en cas limite.
      await prevenir(
        "portee_du_jeton_manquante_annulation",
        "critical",
        "portee",
        `Le jeton Calendly n'a pas le droit d'ECRIRE. AUCUNE annulation ne passe.\n\n` +
          `Portees exigees : ${r.porteesRequises ?? "(non precisees)"}\n\n` +
          `A FAIRE : regenerer un jeton avec scheduled_events:write, le poser dans ` +
          `Coolify (CALENDLY_API_TOKEN, portee RUN) et redeployer.\n\n` +
          `En attendant, chaque visiteur est invite a nous ecrire — le parcours ` +
          `reste praticable, ce qui rend cette panne invisible sans cette alerte.`,
      );
      redirect(retour(`?t=${encodeURIComponent(jeton)}&echec=refus`));
      break;

    case "non_configure":
      redirect(retour(`?t=${encodeURIComponent(jeton)}&echec=refus`));
      break;

    case "refus":
      await prevenir(
        "annulation_refusee",
        "warn",
        rdv.id,
        `Calendly a refuse l'annulation de ${rdv.id}.\n\nMotif : ${r.detail}\n\n` +
          `Le visiteur a ete invite a reessayer ou a nous ecrire.`,
      );
      redirect(retour(`?t=${encodeURIComponent(jeton)}&echec=refus`));
      break;

    default:
      // 🔑 Contrôle d'exhaustivité : le jour où `annulerRendezVous` gagne une
      // raison, cette ligne refuse de compiler tant qu'elle n'est pas traitée.
      // Sans lui, l'action se terminerait SANS redirection — la page se
      // rechargerait, sans explication et sans annulation.
      raisonNonTraitee(r);
  }
}

function raisonNonTraitee(r: never): never {
  throw new Error(`Raison d'annulation non traitee : ${JSON.stringify(r)}`);
}
