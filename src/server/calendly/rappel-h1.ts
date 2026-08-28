/**
 * Rappel une heure avant l'appel de découverte (2026-08-28).
 *
 * ## Le défaut que ce module ferme
 *
 * Une personne qui réservait un appel ne recevait de nous **strictement rien** :
 * ni confirmation, ni rappel. Son seul signal était une invitation d'agenda
 * émise par Google au nom du compte connecté à Calendly, que Gmail flanque d'un
 * « expéditeur inconnu · Signaler comme spam ».
 *
 * Les rappels de Calendly relèvent des Workflows, une fonctionnalité payante.
 * Celui-ci est le nôtre.
 *
 * ## Pourquoi un rappel et PAS une confirmation
 *
 * Calendly envoie déjà une confirmation — l'invitation d'agenda. En doubler une
 * seconde ne rendrait pas la première moins mauvaise : cela ferait deux messages
 * pour un rendez-vous. Ce qui manquait, c'est le rappel : un appel réservé trois
 * semaines à l'avance s'oublie, et Calendly gratuit n'en envoie aucun.
 *
 * ## LA FENÊTRE, ET POURQUOI ELLE EST PLUS LARGE QUE LA CADENCE
 *
 * La passe tourne toutes les 5 minutes et cherche les rendez-vous qui commencent
 * dans 60 à 75 minutes. La fenêtre (15 min) est TROIS FOIS la cadence, et c'est
 * délibéré : si un passage est sauté — worker redémarré, base lente, file
 * saturée — les deux suivants rattrapent. Une fenêtre égale à la cadence
 * perdrait le rappel au premier hoquet, et personne ne le verrait.
 *
 * Conséquence assumée : le rappel part entre H-75 et H-60, pas à H-60 pile. Pour
 * un rappel, cette imprécision n'a aucun coût.
 *
 * ## L'IDEMPOTENCE EST LA SEULE CHOSE QUI EMPÊCHE LA BOUCLE
 *
 * Avec une fenêtre de 15 minutes et une cadence de 5, chaque rendez-vous est vu
 * TROIS FOIS. Sans marqueur, il recevrait trois rappels. `rappelEnvoyeAt` est
 * posé après l'envoi — et SEULEMENT si la mise en file a réussi.
 *
 * 🔴 `enqueueEmail` NE LÈVE PAS : elle rend `{ enqueued }`. Écrire « envoyé » sur
 * un retour faux est le défaut `D5-1-C1` de ce dépôt : une trace qui affirme un
 * envoi qui n'a pas eu lieu est PIRE que pas de trace, parce qu'elle interdit le
 * rattrapage. Ici, un échec laisse `rappelEnvoyeAt` à `null` et le passage
 * suivant réessaie — tant que le rendez-vous est encore dans la fenêtre.
 */

import { prisma } from "@/lib/prisma";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { enqueueEmail } from "@/server/queue/queues";

/** Début de la fenêtre, en minutes avant le rendez-vous. */
const FENETRE_MIN = 60;
/** Fin de la fenêtre. Trois fois la cadence du cron — voir l'en-tête. */
const FENETRE_MAX = 75;

/**
 * Plafond par passage.
 *
 * Il ne protège pas d'un volume réel — il n'y a jamais 50 appels dans le même
 * quart d'heure. Il protège d'un EMBALLEMENT : si `rappelEnvoyeAt` cessait
 * d'être posé (colonne perdue à une migration, erreur de requête), la passe
 * rejouerait la même liste toutes les 5 minutes. Le plafond borne alors les
 * dégâts, et `plafondAtteint` les rend visibles au lieu de les taire.
 */
const MAX_PAR_PASSAGE = 50;

export interface RappelH1Resultat {
  readonly ok: boolean;
  /** Rendez-vous entrés dans la fenêtre à ce passage. */
  readonly candidats: number;
  /** Rappels réellement mis en file. */
  readonly envoyes: number;
  /** Mises en file refusées — le marqueur n'est PAS posé, on réessaiera. */
  readonly echecs: number;
  /** Présent seulement si le plafond a mordu — jamais de troncature muette. */
  readonly plafondAtteint?: true;
  readonly raison?: string;
}

const VIDE = { candidats: 0, envoyes: 0, echecs: 0 } as const;

/** Heure de début, telle qu'un humain la lit à Paris. */
function heureParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Le prénom, ou à défaut ce que Calendly a transmis.
 *
 * Une salutation vide (« Bonjour , ») est pire qu'une salutation générique : la
 * première a l'air cassée, la seconde a l'air sobre.
 */
function prenomOuDefaut(nomComplet: string | null): string {
  const propre = (nomComplet ?? "").trim();
  if (!propre || propre === ERASED_PLACEHOLDER) return "";
  return propre.split(/\s+/)[0] ?? "";
}

/**
 * Envoie les rappels dus. Ne lève jamais : un cron ne doit pas rougir parce
 * qu'une base a hoqueté.
 */
export async function envoyerRappelsH1(nowMs: number = Date.now()): Promise<RappelH1Resultat> {
  const debut = new Date(nowMs + FENETRE_MIN * 60_000);
  const fin = new Date(nowMs + FENETRE_MAX * 60_000);

  let candidats: Array<{
    id: string;
    inviteeName: string | null;
    inviteeEmail: string | null;
    startTime: Date | null;
    endTime: Date | null;
    location: string | null;
    cancelUrl: string | null;
    rescheduleUrl: string | null;
  }>;
  try {
    candidats = await prisma.calendlyEvent.findMany({
      where: {
        // Un rendez-vous annulé, terminé ou marqué absent n'a rien à rappeler.
        status: "scheduled",
        startTime: { gte: debut, lt: fin },
        rappelEnvoyeAt: null,
        inviteeEmail: { not: null },
        // 🔴 Une ligne ANONYMISÉE ne reçoit rien. Son adresse est synthétique
        // (`erased:…@erased.local`) : lui écrire ferait rebondir un message vers
        // un domaine qui n'existe pas, au nom d'une personne qui a précisément
        // demandé qu'on l'oublie. Le marqueur est IMPORTÉ de la chaîne
        // d'effacement, jamais recopié.
        NOT: { inviteeName: ERASED_PLACEHOLDER },
      },
      orderBy: { startTime: "asc" },
      take: MAX_PAR_PASSAGE + 1,
      select: {
        id: true,
        inviteeName: true,
        inviteeEmail: true,
        startTime: true,
        endTime: true,
        location: true,
        cancelUrl: true,
        rescheduleUrl: true,
      },
    });
  } catch (e) {
    return {
      ok: false,
      ...VIDE,
      raison: `db_read_failed:${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const plafondAtteint = candidats.length > MAX_PAR_PASSAGE;
  const aTraiter = plafondAtteint ? candidats.slice(0, MAX_PAR_PASSAGE) : candidats;

  let envoyes = 0;
  let echecs = 0;

  for (const rdv of aTraiter) {
    if (!rdv.startTime || !rdv.inviteeEmail) continue;

    // La durée réelle, dérivée des deux bornes du rendez-vous — jamais un
    // chiffre écrit à la main. C'est le même défaut que la page annonçait :
    // « 30 minutes » recopié pendant que l'event-type en durait 45.
    const dureeMinutes = rdv.endTime
      ? Math.round((rdv.endTime.getTime() - rdv.startTime.getTime()) / 60_000)
      : null;

    let miseEnFile: { enqueued: boolean } | null = null;
    try {
      miseEnFile = await enqueueEmail("appel-rappel", rdv.inviteeEmail, "fr", {
        prenom: prenomOuDefaut(rdv.inviteeName),
        heure: heureParis(rdv.startTime),
        ...(dureeMinutes && dureeMinutes > 0 ? { dureeMinutes } : {}),
        ...(rdv.location ? { lieu: rdv.location } : {}),
        ...(rdv.cancelUrl ? { cancelUrl: rdv.cancelUrl } : {}),
        ...(rdv.rescheduleUrl ? { rescheduleUrl: rdv.rescheduleUrl } : {}),
      });
    } catch (e) {
      console.warn(
        `[appel-rappel] mise en file impossible pour ${rdv.id} : ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    // 🔴 LE MARQUEUR N'EST POSÉ QUE SUR UN SUCCÈS RÉEL. `enqueueEmail` ne lève
    // pas : elle rend `{ enqueued: false }` quand la file refuse. L'écrire quand
    // même transformerait un rappel jamais parti en rappel réputé envoyé, et
    // interdirait le rattrapage du passage suivant.
    if (!miseEnFile?.enqueued) {
      echecs += 1;
      continue;
    }

    try {
      await prisma.calendlyEvent.update({
        where: { id: rdv.id },
        data: { rappelEnvoyeAt: new Date(nowMs) },
      });
      envoyes += 1;
    } catch (e) {
      // Le message est parti mais le marqueur n'a pas pu être posé : le passage
      // suivant renverra. Un doublon vaut mieux qu'un silence, et il faut que ça
      // se voie.
      console.error(
        `[appel-rappel] ⚠️ rappel ENVOYÉ mais marqueur NON POSÉ pour ${rdv.id} — un doublon est possible : ${e instanceof Error ? e.message : String(e)}`,
      );
      envoyes += 1;
    }
  }

  return {
    ok: true,
    candidats: aTraiter.length,
    envoyes,
    echecs,
    ...(plafondAtteint ? { plafondAtteint: true as const } : {}),
  };
}
