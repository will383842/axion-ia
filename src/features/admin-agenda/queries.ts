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
import { dayKeyInParis } from "@/lib/calendar-grid";
import { listerEvenements, MARQUEUR_CONSOLE } from "@/server/google-calendar/events";
import { isGoogleCalendarConfigured } from "@/server/google-calendar/auth";
import type { AgendaFenetre, AgendaItem } from "./types";

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
async function chargerCalendly(debut: Date, fin: Date): Promise<AgendaItem[]> {
  const lignes = await prisma.calendlyEvent.findMany({
    where: { startTime: { gte: debut, lt: fin } },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      eventTypeName: true,
      status: true,
      startTime: true,
      endTime: true,
      inviteeName: true,
      inviteePhone: true,
      location: true,
    },
  });

  return lignes.flatMap((e): AgendaItem[] => {
    if (!e.startTime) return [];
    const annule = STATUTS_LIBERES.has(e.status);
    return [
      {
        key: `cal_${e.id}`,
        source: "calendly",
        titre: texteOuNull(e.inviteeName) ?? e.eventTypeName,
        debut: e.startTime,
        fin: e.endTime,
        journeeEntiere: false,
        occupe: !annule,
        jour: dayKeyInParis(e.startTime),
        contact: texteOuNull(e.inviteeName),
        telephone: texteOuNull(e.inviteePhone),
        lieu: texteOuNull(e.location),
        detailHref: adminPath("fr", `contacts/appels/${e.id}`),
        googleEventId: null,
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
export async function getAgendaFenetre(debut: Date, fin: Date): Promise<AgendaFenetre> {
  const calendly = await chargerCalendly(debut, fin);

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
            detailHref: e.htmlLink,
            // Seules les indisponibilités posées ici sont retirables. La console
            // n'a aucune raison de supprimer un vrai rendez-vous, et une
            // suppression d'agenda ne se rattrape pas.
            googleEventId: e.description?.includes(MARQUEUR_CONSOLE) ? e.id : null,
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

/** Bornes `[00:00, 24:00[` d'un jour civil de Paris, en instants réels. */
export function bornesDuJourParis(jour: string): { debut: Date; fin: Date } {
  // On part de midi UTC pour ne jamais tomber du mauvais côté d'un changement
  // d'heure en construisant la date, puis on cadre sur le jour civil à Paris via
  // les clés — la même mécanique que `calendar-grid.ts`, dont c'est le métier.
  const [a, m, j] = jour.split("-").map(Number);
  const debut = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, j ?? 1, 12, 0, 0));
  // Recale sur minuit local en retirant l'écart mesuré entre l'heure UTC et
  // l'heure de Paris ce jour-là. Robuste au 25 h et au 23 h des bascules.
  const heureParis = Number(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(debut),
  );
  const minuit = new Date(debut.getTime() - heureParis * 3_600_000);
  return { debut: minuit, fin: new Date(minuit.getTime() + 24 * 3_600_000) };
}
