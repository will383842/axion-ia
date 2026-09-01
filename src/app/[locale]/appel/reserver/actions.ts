"use server";

/**
 * L'action qui réserve — le seul endroit du site qui écrive chez Calendly.
 *
 * ## Le motif POST-redirect-GET, et pourquoi il n'est pas négociable
 *
 * Cette page n'envoie aucun JavaScript. Un formulaire natif ne peut donc pas se
 * re-rendre tout seul avec ses erreurs : il faut un POST, une redirection, puis
 * un GET. La redirection a un second mérite, celui pour lequel le motif existe :
 * un rafraîchissement après un POST re-poste. Ici, cela voudrait dire réserver
 * deux fois le même créneau.
 *
 * La saisie voyage entre les deux dans un cookie éphémère, jamais dans l'URL —
 * voir `reprise-formulaire.ts` pour le raisonnement.
 *
 * ## 🔴 LA DÉCISION LA PLUS IMPORTANTE DU FICHIER : le silence
 *
 * Quand l'API ne répond pas, on NE SAIT PAS si la réservation existe. C'est le
 * seul cas où il ne faut surtout pas replier vers Calendly : le visiteur y
 * réserverait le même créneau, et on aurait deux rendez-vous, ou un rendez-vous
 * et un conflit. On l'envoie donc sur une page qui dit exactement cela, et on
 * alerte — parce qu'un humain doit trancher, et vite.
 *
 * C'est la différence entre `silence` et `refus`, et c'est pour la porter que
 * `reserverCreneau` rend une raison typée plutôt qu'un booléen.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { notify } from "@/server/notifications";
import type { NotificationSeverity } from "@/server/notifications/types";
import { readUtmCookie, UTM_COOKIE_NAME } from "@/lib/utm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";
import {
  validerFormulaire,
  urlDuFormulaire,
  reservationDirecteActive,
  CHAMPS,
  type Erreurs,
  type Valeurs,
} from "@/server/calendly/formulaire-reservation";
import { deposerLaReprise } from "@/server/calendly/reprise-formulaire";
import { resoudreEventTypePourReservation } from "@/server/calendly/availability";
import { reserverCreneau } from "@/server/calendly/reservation";

/**
 * Le leurre. Même nom que sur `/contact`, pour la même raison : les robots
 * remplissent tout ce qui ressemble à un champ, et `website` en est un.
 */
export const CHAMP_LEURRE = "website";

/**
 * ## 🔴 DEUX QUOTAS, ET C'EST LA LEÇON D'UN DÉFAUT DÉJÀ PAYÉ
 *
 * Le 2026-08-24, un candidat a été bloqué par un compteur anti-spam consommé
 * AVANT le contrôle qui aurait pu échouer : ses tentatives honnêtes brûlaient
 * son quota. Il disait vrai, et on ne l'a pas cru tout de suite.
 *
 * Le même piège attend ici, en pire : ce formulaire a sept champs, dont un
 * numéro qui exige l'indicatif pays et une case à cocher facile à oublier. Se
 * tromper deux fois est NORMAL. Un quota unique de trois tentatives par heure
 * bloquerait donc des prospects sincères, en silence, à l'étape la plus proche
 * de la signature.
 *
 * D'où deux compteurs distincts :
 *
 * — **ANTI-INONDATION**, large, consommé à chaque envoi. Il n'existe que pour
 *   arrêter une machine, et 30 envois en dix minutes ne sont jamais humains.
 * — **QUOTA DE RÉSERVATION**, serré, consommé UNIQUEMENT quand on s'apprête à
 *   écrire chez Calendly. Une saisie refusée ne l'entame pas : le visiteur peut
 *   se tromper autant qu'il lui faut sans perdre son droit de réserver.
 */
const ANTI_INONDATION = { limit: 30, windowSec: 600 } as const;
const QUOTA_RESERVATION = { limit: 3, windowSec: 3_600 } as const;

/** Champ caché portant la locale : l'action n'a pas accès aux paramètres de route. */
export const CHAMP_LOCALE = "locale";

/** Où atterrit une réservation réussie. */
function urlDeConfirmation(locale: string, eventUri: string): string {
  // 🔑 On ne transmet que l'IDENTIFIANT de l'événement, jamais le nom ni
  // l'e-mail : une adresse d'URL finit dans l'historique, dans les journaux du
  // serveur et dans l'en-tête `Referer`. La page de confirmation relira le reste
  // chez Calendly.
  const uuid = eventUri.split("/").filter(Boolean).pop() ?? "";
  return `/${locale}/appel/confirme?e=${encodeURIComponent(uuid)}`;
}

async function replier(
  locale: string,
  debut: string,
  erreurs: Erreurs,
  valeurs: Valeurs,
): Promise<never> {
  await deposerLaReprise(debut, erreurs, valeurs);
  redirect(urlDuFormulaire(locale, debut));
}

export async function soumettreLaReservation(fd: FormData): Promise<void> {
  const locale = String(fd.get(CHAMP_LOCALE) ?? "fr");
  const debutBrut = String(fd.get(CHAMPS.debut) ?? "");

  // Le drapeau peut s'éteindre entre l'affichage du formulaire et son envoi —
  // c'est même tout l'intérêt d'un drapeau : pouvoir couper en une minute.
  if (!reservationDirecteActive()) redirect(`/${locale}/appel`);

  const ip = await getClientIp();

  // 1. Anti-inondation. Large par construction : il arrête une machine, pas un
  //    humain qui se trompe.
  const flot = await checkRateLimit(`reserv-flot:${ip}`, ANTI_INONDATION);
  if (!flot.allowed) {
    await replier(
      locale,
      debutBrut,
      {
        [CHAMPS.debut]:
          "Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes.",
      },
      {},
    );
  }

  // 2. Leurre. Un champ que rien n'invite à remplir, et qu'un robot remplit
  //    quand même. On rend un succès APPARENT : dire non apprendrait au robot
  //    quoi corriger, et il reviendrait mieux armé.
  const leurre = fd.get(CHAMP_LEURRE);
  if (leurre) {
    signalerHoneypot("reservation-directe", leurre);
    redirect(`/${locale}/appel/confirme?incertain=1`);
  }

  const et = await resoudreEventTypePourReservation(
    process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL ?? "",
  );
  if (!et) {
    // Ni jeton, ni event-type lisible, ou une question qu'on ne sait pas poser.
    // Le contrat de repli du module : on renvoie vers le calendrier, qui saura
    // rouvrir la page Calendly.
    //
    // 🔴 MAIS ON ALERTE, et c'est le point. Le drapeau est ALLUMÉ : quelqu'un a
    // décidé que ce formulaire devait servir. S'il se replie, il se replie pour
    // TOUT LE MONDE — le formulaire est annoncé et n'apparaît jamais. Un repli
    // qui se déclenche à chaque fois n'est pas un repli, c'est une panne
    // déguisée en bon fonctionnement, et sans cette alerte elle durerait
    // jusqu'à ce que quelqu'un s'étonne du silence des réservations.
    await prevenir(
      "repli_permanent",
      "critical",
      "resolution",
      `Le formulaire de reservation se replie alors que son drapeau est ALLUME.

` +
        `Cause probable : jeton Calendly absent ou refuse, API injoignable, ou une ` +
        `question ajoutee chez Calendly que notre formulaire ne sait pas poser ` +
        `(voir les journaux du conteneur, prefixe [calendly-availability]).

` +
        `Consequence : AUCUN visiteur n'atteint le formulaire. Ils partent tous ` +
        `chez Calendly, ce qui fonctionne — donc rien ne casse, et personne ne ` +
        `s'en apercevra sans cette alerte.`,
    );
    redirect(`/${locale}/appel`);
  }

  const jar = await cookies();
  const utm = readUtmCookie(jar.get(UTM_COOKIE_NAME)?.value);

  const validation = validerFormulaire(fd, {
    questions: et.questions,
    eventTypeUri: et.uri,
    utmSource: utm.utm_source ?? null,
    utmMedium: utm.utm_medium ?? null,
    utmCampaign: utm.utm_campaign ?? null,
  });

  if (!validation.ok) {
    // ⚠️ Inliné plutôt qu'appelé : `redirect()` est typé `never`, ce qui apprend
    // au compilateur que la suite ne s'exécute pas. Passer par la fonction
    // d'aide (qui rend `Promise<never>`) ne le lui apprend PAS — TypeScript ne
    // propage pas l'inatteignabilité à travers un `await`. Sans ça, tout le code
    // qui suit croit encore la validation possiblement en échec.
    await deposerLaReprise(debutBrut, validation.erreurs, validation.valeurs);
    redirect(urlDuFormulaire(locale, debutBrut));
  }

  // 3. Quota de reservation, consomme SEULEMENT ici : la saisie est valide et
  //    on s'apprete a ecrire chez Calendly. Une tentative refusee plus haut ne
  //    l'a pas entame — voir le commentaire de `QUOTA_RESERVATION`.
  const quota = await checkRateLimit(`reserv:${ip}`, QUOTA_RESERVATION);
  if (!quota.allowed) {
    await replier(
      locale,
      debutBrut,
      {
        [CHAMPS.debut]:
          "Vous avez deja reserve plusieurs rendez-vous recemment. Ecrivez-nous si vous en avez besoin d'un autre.",
      },
      validation.valeurs,
    );
  }

  const r = await reserverCreneau(validation.demande);

  if (r.ok) {
    if (!r.lieuVerifie) {
      // Le rendez-vous existe et le visiteur peut être confirmé. Mais nous
      // n'avons pas pu relire le format : si Calendly l'avait enregistré
      // autrement, personne ne le saurait avant le jour même.
      await prevenir(
        "reservation_non_relue",
        "warn",
        r.eventUri,
        `Reservation creee, mais le format n'a pas pu etre relu.

` +
          `Evenement : ${r.eventUri}
` +
          `Format demande : ${validation.demande.format}

` +
          `Le rendez-vous EXISTE et le visiteur a ete confirme. Si Calendly l'a ` +
          `enregistre dans un autre format, personne ne le saura avant le jour meme. ` +
          `Ouvrir l'evenement et verifier le lieu.`,
      );
    }
    redirect(urlDeConfirmation(locale, r.eventUri));
  }

  switch (r.raison) {
    case "creneau_pris":
      // Le refus le PLUS FRÉQUENT, et il se traite sur place. Renvoyer vers
      // Calendly ferait lire le même refus, en moins bien, sur une page
      // étrangère — après avoir perdu toute la saisie.
      await replier(
        locale,
        debutBrut,
        {
          [CHAMPS.debut]:
            "Ce créneau vient d'être réservé par quelqu'un d'autre. Choisissez-en un autre — le reste de votre saisie est conservé.",
        },
        validation.valeurs,
      );
      break;

    case "lieu_non_pris_en_compte":
      // 🔴 Le rendez-vous EXISTE, mais au mauvais format. On ne peut ni le
      // confirmer (le visiteur attendrait une visio et recevrait un appel), ni
      // le taire. Un humain doit trancher, et il a de quoi : `cancelUrl`.
      await prevenir(
        "reservation_au_mauvais_format",
        "critical",
        r.eventUri,
        `Reservation creee AU MAUVAIS FORMAT.

` +
          `Demande : ${validation.demande.format}
` +
          `Enregistre par Calendly : ${r.lieuEnregistre ?? "(illisible)"}
` +
          `Evenement : ${r.eventUri}
` +
          `Annuler : ${r.cancelUrl ?? "(pas de lien d'annulation)"}

` +
          `Le rendez-vous existe. Le visiteur attend le format qu'il a choisi. ` +
          `Trancher : corriger le lieu chez Calendly, ou annuler et rappeler.`,
      );
      redirect(
        `/${locale}/appel/confirme?e=${encodeURIComponent(r.eventUri.split("/").pop() ?? "")}&v=1`,
      );
      break;

    case "silence":
      // ⚠️ ON NE SAIT PAS si la réservation existe. Replier vers Calendly ferait
      // peut-être réserver deux fois. On dit la vérité au visiteur et on alerte.
      await prevenir(
        "reservation_sans_reponse",
        "critical",
        `${debutBrut}|${validation.demande.email}`,
        `Reservation SANS REPONSE de Calendly - on ignore si elle existe.

` +
          `Creneau : ${debutBrut}
` +
          `Format : ${validation.demande.format}
` +
          `Invite : ${validation.demande.email}

` +
          `Le visiteur a ete prevenu que nous verifions. VERIFIER MAINTENANT dans ` +
          `Calendly si le rendez-vous existe : s'il existe, confirmer au visiteur ; ` +
          `sinon, lui proposer de reprendre. Ne pas le laisser reserver a nouveau ` +
          `sans avoir verifie, sous peine de doublon.`,
      );
      redirect(`/${locale}/appel/confirme?incertain=1`);
      break;

    case "non_configure":
      redirect(`/${locale}/appel`);
      break;

    case "portee_manquante":
      // 🔴 PANNE TOTALE ET PERMANENTE, déguisée en cas limite. Le jeton posé
      // dans Coolify n'a pas `scheduled_events:write` : AUCUNE réservation ne
      // passera, et le repli vers Calendly fera que personne ne s'en apercevra.
      // C'est le seul échec de cette liste qui appelle une action immédiate sur
      // la configuration, pas sur un rendez-vous.
      await prevenir(
        "portee_du_jeton_manquante",
        "critical",
        "portee",
        `Le jeton Calendly n'a pas le droit d'ECRIRE. Aucune reservation ne passe.

` +
          `Portees exigees par Calendly : ${r.porteesRequises ?? "(non precisees dans la reponse)"}

` +
          `A FAIRE : regenerer un jeton avec scheduled_events:write sur ` +
          `calendly.com/integrations/api_webhooks, puis le poser dans Coolify ` +
          `(CALENDLY_API_TOKEN, portee RUN) et redeployer.

` +
          `En attendant, chaque visiteur est renvoye vers Calendly : le parcours ` +
          `FONCTIONNE, ce qui est exactement ce qui rend cette panne invisible.`,
      );
      await replier(
        locale,
        debutBrut,
        {
          [CHAMPS.debut]:
            "Nous n'avons pas pu enregistrer ce rendez-vous. Passez par le lien Calendly en bas du formulaire — il fonctionne.",
        },
        validation.valeurs,
      );
      break;

    case "refus":
      await prevenir(
        "reservation_refusee",
        "warn",
        debutBrut,
        `Calendly a refuse la reservation.

` +
          `Creneau : ${debutBrut}
` +
          `Motif rendu par l'API : ${r.detail}

` +
          `Le visiteur est revenu au formulaire, sa saisie conservee, avec le lien ` +
          `Calendly en repli. Si ce motif revient, le formulaire est casse.`,
      );
      await replier(
        locale,
        debutBrut,
        {
          [CHAMPS.debut]:
            "Nous n'avons pas pu enregistrer ce rendez-vous. Réessayez, ou passez par le lien Calendly en bas du formulaire.",
        },
        validation.valeurs,
      );
      break;

    default:
      // 🔑 CONTRÔLE D'EXHAUSTIVITÉ. Il ne sert à rien à l'exécution — il sert à
      // la COMPILATION : le jour où `reserverCreneau` gagne une raison de plus,
      // cette ligne refuse de compiler tant que le cas n'est pas traité ici.
      //
      // ⚠️ Ce garde-fou manquait il y a dix minutes, et le défaut s'est produit
      // aussitôt : `portee_manquante` a été ajoutée au type, le `switch` ne la
      // traitait pas, et le typage n'a rien dit. L'action se terminait alors
      // SANS redirection — le visiteur voyait la page se recharger, sans
      // explication et sans réservation.
      raisonNonTraitee(r);
  }
}

/**
 * Refuse à la compilation toute raison d'échec qu'on aurait oublié de traiter.
 *
 * Le paramètre est typé `never` : si une seule branche du `switch` manque,
 * TypeScript y voit passer une valeur réelle et rompt la compilation, avec le
 * nom de la raison oubliée dans son message.
 */
function raisonNonTraitee(r: never): never {
  throw new Error(`Raison de reservation non traitee : ${JSON.stringify(r)}`);
}

/**
 * Signale sans jamais faire échouer la réservation.
 *
 * 🔑 Une alerte qui lèverait remplacerait une réservation réussie par un écran
 * d'erreur — le pire échange possible. On journalise en dernier recours : c'est
 * peu, mais c'est plus qu'un `catch` vide, et c'est visible dans le conteneur.
 *
 * ⚠️ LA CLÉ DE DÉDUPLICATION PORTE UN DISCRIMINANT, et ce n'est pas un détail.
 * Dédupliquer sur le seul `kind` ferait taire le deuxième incident d'une même
 * famille pendant tout le TTL — or deux réservations sans réponse à quinze
 * minutes d'intervalle, ce sont deux personnes à rappeler, pas une.
 */
async function prevenir(
  kind: string,
  severity: NotificationSeverity,
  discriminant: string,
  corps: string,
): Promise<void> {
  try {
    await notify({
      category: "MONITORING_ALERT",
      severity,
      payload: { kind, details: { legacyBody: corps } },
      dedupKey: `reservation-directe:${kind}:${discriminant}`,
      dedupTtlSec: 900,
    });
  } catch (e) {
    console.warn(
      `[reservation-directe] alerte « ${kind} » non émise : ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
