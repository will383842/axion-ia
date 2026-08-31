/**
 * Lecture fusionnée de l'agenda — base Calendly + agenda Google (2026-08-26).
 *
 * Voir `types.ts` pour la règle de fusion et sa raison. En deux mots : la base
 * gagne sur Google pour tout ce qui vient de Calendly, parce qu'elle en détient
 * la version riche (téléphone, réponses au formulaire, liens d'annulation) là où
 * Google n'a qu'un titre et une description en texte libre.
 *
 * ⚠️ CETTE FONCTION NE THROW JAMAIS, ET C'EST STRUCTURANT. Un agenda Google
 * injoignable doit produire une page qui affiche les réservations Calendly et
 * DIT que le reste manque — pas une erreur 500, et surtout pas une journée vide.
 * Une journée vide est un mensonge : elle se lit « tu es libre » alors qu'elle
 * signifie « je n'ai pas pu regarder ».
 */

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { dayKeyInParis, fromParisLocalInput } from "@/lib/calendar-grid";
import { listerEvenements, MARQUEUR_CONSOLE } from "@/server/google-calendar/events";
import { isGoogleCalendarConfigured } from "@/server/google-calendar/auth";
import type { AgendaFenetre, AgendaItem } from "./types";
import { canalDuRendezVous } from "@/server/calendly/canal";

/**
 * Les statuts qui retirent le rendez-vous de l'occupation réelle.
 *
 * Un rendez-vous annulé reste affiché — barré — parce que le voir disparaître
 * sans trace donne l'impression d'avoir rêvé. Mais il ne compte pas comme
 * occupé : Calendly a rouvert le créneau, la console doit dire la même chose.
 */
const STATUTS_LIBERES = new Set(["canceled"]);

function texteOuNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

/**
 * Charge les réservations Calendly de la fenêtre depuis la base.
 *
 * Filtre sur `startTime` et non sur la date de capture : ce qui intéresse une
 * vue d'agenda, c'est QUAND a lieu le rendez-vous, pas quand on l'a appris. Les
 * lignes sans horaire (l'ancien Embed JS n'en fournissait pas toujours) sont
 * volontairement exclues d'une vue calendaire — elles restent visibles dans
 * l'onglet « Appels », qui est une liste et sait les porter.
 */
/**
 * @param peutVoirAppels — le rôle a-t-il le droit de lire les coordonnées des
 * prospects (`peutVoirLesAppels`, `features/admin-calendly/acces`) ?
 *
 * 🔴 CE PARAMÈTRE FERME UN JUMEAU OUBLIÉ — ajouté le 2026-08-27.
 *
 * Le 2026-08-27, la lecture de `/contacts/appels` a été fermée à
 * `super_admin | admin | editor` sur décision de Will. Cet écran-ci servait
 * exactement les mêmes données — nom et TÉLÉPHONE du prospect, tirés de la même
 * table — sans appeler `auth()` nulle part. Fermer une porte en laissant sa
 * jumelle ouverte ne ferme rien ; c'est même pire, parce que ça fabrique la
 * certitude que le sujet est clos.
 *
 * ⚠️ ON FILTRE, ON NE BLOQUE PAS L'ÉCRAN. L'agenda mêle les réservations
 * Calendly aux rendez-vous personnels de l'exploitant : le fermer entièrement
 * serait une décision de périmètre que personne n'a prise. Un rôle non habilité
 * continue donc de voir « occupé de 14 h à 14 h 45 » — ce dont il a besoin pour
 * planifier — mais plus le nom, ni le téléphone, ni le lien vers la fiche.
 *
 * Les colonnes ne sont même pas SÉLECTIONNÉES dans ce cas : une PII qu'on ne
 * lit pas ne peut pas fuiter par un journal, une trace ou une erreur.
 */
async function chargerCalendly(
  debut: Date,
  fin: Date,
  peutVoirAppels: boolean,
): Promise<AgendaItem[]> {
  const lignes = await prisma.calendlyEvent.findMany({
    where: { startTime: { gte: debut, lt: fin } },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      eventTypeName: true,
      status: true,
      startTime: true,
      endTime: true,
      inviteeName: peutVoirAppels,
      inviteePhone: peutVoirAppels,
      // ⚠️ SÉLECTIONNÉS POUR TOUS LES RÔLES, à la différence des deux au-dessus.
      //
      // Le FORMAT (téléphone / visio) est visible de tout le monde — arbitré par
      // Will le 2026-08-31 — et il se dérive de ces deux colonnes. Elles sont
      // donc lues, mais **rien de brut n'en ressort** : `lieu` reste gardé
      // ci-dessous, seul `format` traverse.
      //
      // C'est une réduction assumée de la marge que se donnait la garde du
      // 2026-08-27 (« les colonnes ne sont même pas sélectionnées »). La
      // propriété qui compte — aucune coordonnée de prospect n'atteint un rôle
      // non habilité — tient toujours ; ce qui disparaît, c'est le fait
      // qu'aucune PII ne transite en mémoire côté serveur.
      location: true,
      rawPayload: true,
    },
  });

  return lignes.flatMap((e): AgendaItem[] => {
    if (!e.startTime) return [];
    const annule = STATUTS_LIBERES.has(e.status);
    return [
      {
        key: `cal_${e.id}`,
        source: "calendly",
        // Sans habilitation, le titre retombe sur le nom du type de rendez-vous
        // — « Discutons de votre projet IA » — jamais sur celui du prospect.
        titre: peutVoirAppels ? (texteOuNull(e.inviteeName) ?? e.eventTypeName) : e.eventTypeName,
        debut: e.startTime,
        fin: e.endTime,
        journeeEntiere: false,
        occupe: !annule,
        jour: dayKeyInParis(e.startTime),
        contact: peutVoirAppels ? texteOuNull(e.inviteeName) : null,
        telephone: peutVoirAppels ? texteOuNull(e.inviteePhone) : null,
        lieu: peutVoirAppels ? texteOuNull(e.location) : null,
        // Dérivé, puis seul à traverser : le format sans la coordonnée.
        format: canalDuRendezVous(e.location, e.rawPayload),
        // Le lien mène à la fiche, qui EST gardée : le laisser produirait un
        // refus au clic. On le retire pour ne pas promettre ce qu'on refuse.
        detailHref: peutVoirAppels ? adminPath("fr", `contacts/appels/${e.id}`) : null,
        googleEventId: null,
        // Une reservation Calendly n'a pas de note de console : elle a sa fiche.
        note: null,
        annule,
      },
    ];
  });
}

/**
 * Renvoie tout ce qui occupe la fenêtre `[debut, fin[`, fusionné et trié.
 *
 * Le tri place les journées entières en tête — elles cadrent la journée, et les
 * reléguer au milieu d'une liste horaire les rendrait invisibles.
 */
export async function getAgendaFenetre(
  debut: Date,
  fin: Date,
  /**
   * Le rôle a-t-il le droit de lire les coordonnées des prospects ?
   *
   * 🔴 SANS VALEUR PAR DÉFAUT, et c'est délibéré. Un défaut à `true` ferait
   * fuiter par oubli au prochain appelant ; un défaut à `false` masquerait
   * silencieusement les données pour un administrateur légitime. L'appelant DOIT
   * trancher — le compilateur l'y oblige.
   */
  peutVoirAppels: boolean,
): Promise<AgendaFenetre> {
  const calendly = await chargerCalendly(debut, fin, peutVoirAppels);

  const googleConfigure = isGoogleCalendarConfigured();
  let google: AgendaItem[] = [];
  let googleOk = false;
  let googleRaison: string | undefined;
  let googleTronque = false;

  if (googleConfigure) {
    const res = await listerEvenements(debut.toISOString(), fin.toISOString());
    if (res.ok) {
      googleOk = true;
      googleTronque = res.tronque;
      google = res.events
        // 🔑 LA DÉDUPLICATION. Calendly réécrit chacune de ses réservations dans
        // l'agenda Google ; sans ce filtre, chaque rendez-vous apparaîtrait DEUX
        // fois — une version riche et son ombre. On garde celle de la base.
        .filter((e) => !e.fromCalendly)
        .map((e): AgendaItem => {
          const debutEv = e.startIso ? new Date(e.startIso) : null;
          return {
            key: `gg_${e.id}`,
            source: e.fromConsole ? "console" : "google",
            titre: e.summary,
            debut: debutEv,
            fin: e.endIso ? new Date(e.endIso) : null,
            journeeEntiere: e.allDay,
            occupe: e.busy,
            // Une journée entière n'a pas d'horaire : on la rattache au premier
            // jour de la fenêtre demandée, qui est celui qu'on affiche.
            jour: dayKeyInParis(debutEv ?? debut),
            contact: null,
            telephone: null,
            lieu: e.location,
            // Un événement Google qui n'est PAS une réservation Calendly n'a
            // pas de type de lieu à interroger : on ne dispose que du texte, et
            // « inconnu » est alors la réponse honnête plutôt qu'un défaut.
            format: canalDuRendezVous(e.location),
            detailHref: e.htmlLink,
            // Seules les indisponibilités posées ici sont retirables. La console
            // n'a aucune raison de supprimer un vrai rendez-vous, et une
            // suppression d'agenda ne se rattrape pas.
            googleEventId: e.description?.includes(MARQUEUR_CONSOLE) ? e.id : null,
            note: e.noteConsole,
            annule: false,
          };
        });
    } else {
      googleRaison = res.reason;
    }
  }

  const items = [...calendly, ...google].sort((a, b) => {
    if (a.journeeEntiere !== b.journeeEntiere) return a.journeeEntiere ? -1 : 1;
    const ta = a.debut?.getTime() ?? 0;
    const tb = b.debut?.getTime() ?? 0;
    return ta - tb;
  });

  return {
    items,
    diagnostics: {
      googleConfigure,
      googleOk,
      ...(googleRaison ? { googleRaison } : {}),
      googleTronque,
      nbCalendly: calendly.length,
      nbGoogle: google.length,
    },
  };
}

/**
 * Jour civil suivant, en clé `AAAA-MM-JJ`.
 *
 * Ancré à midi UTC : l'incrément se fait donc loin de toute frontière de jour,
 * et aucun changement d'heure ne peut le faire basculer d'un cran.
 */
function jourSuivant(jour: string): string {
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, j ?? 1, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Bornes `[00:00, 24:00[` d'un jour civil de Paris, en instants réels.
 *
 * 🔴 CETTE FONCTION A RENVOYÉ `Invalid Date` EN PRODUCTION (2026-08-27).
 * La version précédente lisait l'heure de Paris ainsi :
 *
 *     Number(new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", hour12: false })
 *              .format(debut))
 *
 * En français, une heure SEULE se rend « 14 h » — avec le suffixe. `Number("14 h")`
 * vaut `NaN`, `t - NaN` vaut `NaN`, et la date devient invalide. Prisma la
 * refusait alors avec un `PrismaClientValidationError`, et la page entière
 * tombait sur son écran d'erreur : l'agenda n'a jamais pu s'afficher une seule
 * fois. À noter que le même appel AVEC les minutes rend « 14:30 », sans suffixe
 * — c'est pourquoi `AgendaTimeline` faisait déjà la même chose sans casser.
 *
 * ✅ On dérive désormais de `fromParisLocalInput`, dont c'est exactement le
 * métier : il lit une heure de Paris, corrige l'offset en deux passes pour les
 * changements d'heure, et rend `null` plutôt qu'une `Invalid Date`. La borne de
 * fin est le minuit du LENDEMAIN, pas « début + 24 h » : les 23 h et 25 h des
 * bascules d'heure sont donc justes, alors que l'addition les faussait.
 */
export function bornesDuJourParis(jour: string): { debut: Date; fin: Date } {
  // Une clé illisible retombe sur aujourd'hui plutôt que de propager une date
  // invalide jusqu'à Prisma — la page doit toujours pouvoir s'afficher.
  const cle = /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : dayKeyInParis(new Date());
  const debut = fromParisLocalInput(`${cle}T00:00`);
  const fin = debut ? fromParisLocalInput(`${jourSuivant(cle)}T00:00`) : null;
  if (!debut || !fin) {
    const maintenant = new Date();
    return { debut: maintenant, fin: new Date(maintenant.getTime() + 24 * 3_600_000) };
  }
  return { debut, fin };
}
