/**
 * Les trois messages d'un appel de découverte : confirmation, J-1, H-1.
 *
 * Ce module remplace `rappel-h1.ts` (2026-08-28, matin), dont il reprend
 * intégralement la logique. Il ne l'étend pas par copie : les trois passages
 * partagent **le même cœur**, et ne diffèrent que par leur configuration.
 *
 * ## Le défaut que ce module ferme
 *
 * Une personne qui réservait un appel ne recevait de nous **strictement rien**.
 * Son seul signal était une invitation d'agenda émise par Google au nom du
 * compte connecté à Calendly, que Gmail flanque d'un « expéditeur inconnu ·
 * Signaler comme spam ».
 *
 * ## 🔑 POURQUOI UN SEUL CŒUR ET PAS TROIS MODULES
 *
 * Les trois passages partagent exactement la même mécanique délicate : la
 * fenêtre plus large que la cadence, le plafond par passage, le refus d'écrire
 * un marqueur sur un envoi qui n'a pas eu lieu, l'exclusion des lignes
 * anonymisées. Trois copies auraient signifié trois endroits où corriger le
 * jour où l'une de ces règles change — et c'est toujours celle qu'on oublie qui
 * envoie un message à quelqu'un qui a demandé son effacement.
 *
 * Ce qui varie tient dans `PASSAGES` : un nom de job, un marqueur, une fenêtre.
 *
 * ## LA FENÊTRE, ET POURQUOI ELLE EST PLUS LARGE QUE LA CADENCE
 *
 * La passe tourne toutes les 5 minutes. Les fenêtres des rappels font 15
 * minutes — TROIS FOIS la cadence, délibérément : si un passage est sauté
 * (worker redémarré, base lente, file saturée), les deux suivants rattrapent.
 * Une fenêtre égale à la cadence perdrait le rappel au premier hoquet, et
 * personne ne le verrait.
 *
 * Conséquence assumée : le rappel part entre H-75 et H-60, pas à H-60 pile.
 * Pour un rappel, cette imprécision n'a aucun coût.
 *
 * ⚠️ **La confirmation n'a PAS de fenêtre** — elle part dès que la réservation
 * est vue, donc au prochain tick (≤ 5 min). Elle est bornée par le bas
 * seulement : `startTime > maintenant`, pour ne jamais confirmer un rendez-vous
 * déjà passé. C'est ce qui protège des lignes anciennes le jour où la colonne
 * est ajoutée à `NULL` sur toute la table.
 *
 * ## L'IDEMPOTENCE EST LA SEULE CHOSE QUI EMPÊCHE LA BOUCLE
 *
 * Avec une fenêtre de 15 minutes et une cadence de 5, chaque rendez-vous est vu
 * TROIS FOIS. Sans marqueur, il recevrait trois messages.
 *
 * 🔴 Les trois marqueurs sont **DISTINCTS**. Un marqueur unique pour trois
 * moments ferait taire les deux derniers : le premier envoi le poserait, et les
 * passages suivants ne verraient plus aucun candidat.
 *
 * 🔴 `enqueueEmail` NE LÈVE PAS : elle rend `{ enqueued }`. Écrire « envoyé »
 * sur un retour faux est le défaut `D5-1-C1` de ce dépôt : une trace qui affirme
 * un envoi qui n'a pas eu lieu est PIRE que pas de trace, parce qu'elle interdit
 * le rattrapage.
 */

import { prisma } from "@/lib/prisma";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { enqueueEmail } from "@/server/queue/queues";
import type { MomentAppel } from "@/lib/email/templates/appel-rappel";

/**
 * Plafond par passage.
 *
 * Il ne protège pas d'un volume réel — il n'y a jamais 50 appels dans le même
 * quart d'heure. Il protège d'un EMBALLEMENT : si un marqueur cessait d'être
 * posé (colonne perdue à une migration, erreur de requête), la passe rejouerait
 * la même liste toutes les 5 minutes. Le plafond borne les dégâts, et
 * `plafondAtteint` les rend visibles au lieu de les taire.
 */
const MAX_PAR_PASSAGE = 50;

/** Le marqueur d'idempotence propre à chaque moment. */
type ChampMarqueur = "confirmationEnvoyeeAt" | "rappelJ1EnvoyeAt" | "rappelEnvoyeAt";

interface Passage {
  readonly moment: MomentAppel;
  readonly job: "appel-confirme" | "appel-rappel-j1" | "appel-rappel";
  readonly marqueur: ChampMarqueur;
  /** `null` = pas de fenêtre : tout rendez-vous à venir est candidat. */
  readonly fenetre: { readonly minMinutes: number; readonly maxMinutes: number } | null;
  /** La confirmation cite la date ; les rappels disent « demain » ou rien. */
  readonly avecDate: boolean;
}

/**
 * 🔑 La table qui porte TOUTE la différence entre les trois messages.
 *
 * Ajouter un quatrième moment (J-7 ?) se fait ici et dans `COPY` du gabarit —
 * nulle part ailleurs.
 */
export const PASSAGES: readonly Passage[] = [
  {
    moment: "confirmation",
    job: "appel-confirme",
    marqueur: "confirmationEnvoyeeAt",
    fenetre: null,
    avecDate: true,
  },
  {
    // 24 h → 24 h 15. Même largeur que H-1 : trois fois la cadence.
    moment: "j1",
    job: "appel-rappel-j1",
    marqueur: "rappelJ1EnvoyeAt",
    fenetre: { minMinutes: 1440, maxMinutes: 1455 },
    avecDate: false,
  },
  {
    moment: "h1",
    job: "appel-rappel",
    marqueur: "rappelEnvoyeAt",
    fenetre: { minMinutes: 60, maxMinutes: 75 },
    avecDate: false,
  },
] as const;

export interface PassageResultat {
  readonly ok: boolean;
  readonly moment: MomentAppel;
  /** Rendez-vous entrés dans la fenêtre à ce passage. */
  readonly candidats: number;
  /** Messages réellement mis en file. */
  readonly envoyes: number;
  /** Mises en file refusées — le marqueur n'est PAS posé, on réessaiera. */
  readonly echecs: number;
  /** Présent seulement si le plafond a mordu — jamais de troncature muette. */
  readonly plafondAtteint?: true;
  readonly raison?: string;
}

/** Heure de début, telle qu'un humain la lit à Paris. */
function heureParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Date de début, telle qu'un humain la lit à Paris (« mardi 2 septembre »). */
function dateParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/**
 * Le prénom, ou à défaut ce que Calendly a transmis.
 *
 * Une salutation vide (« Bonjour , ») est pire qu'une salutation générique : la
 * première a l'air cassée, la seconde a l'air sobre. Le gabarit rend « Bonjour, »
 * quand cette fonction retourne une chaîne vide.
 */
function prenomOuDefaut(nomComplet: string | null): string {
  const propre = (nomComplet ?? "").trim();
  if (!propre || propre === ERASED_PLACEHOLDER) return "";
  return propre.split(/\s+/)[0] ?? "";
}

/**
 * Le filtre du marqueur, en objets Prisma explicites.
 *
 * ⚠️ Écrit par `switch` et non par clé dynamique : une clé calculée
 * (`{ [p.marqueur]: null }`) passe le typage de Prisma sans qu'il vérifie que le
 * champ existe. Une faute de frappe donnerait alors un `where` qui ne filtre
 * rien — donc un message à chaque passage, à chaque personne.
 */
function filtreNonEnvoye(marqueur: ChampMarqueur) {
  switch (marqueur) {
    case "confirmationEnvoyeeAt":
      return { confirmationEnvoyeeAt: null };
    case "rappelJ1EnvoyeAt":
      return { rappelJ1EnvoyeAt: null };
    case "rappelEnvoyeAt":
      return { rappelEnvoyeAt: null };
  }
}

/** Le marqueur à poser, même raison qu'au-dessus. */
function marqueurPose(marqueur: ChampMarqueur, quand: Date) {
  switch (marqueur) {
    case "confirmationEnvoyeeAt":
      return { confirmationEnvoyeeAt: quand };
    case "rappelJ1EnvoyeAt":
      return { rappelJ1EnvoyeAt: quand };
    case "rappelEnvoyeAt":
      return { rappelEnvoyeAt: quand };
  }
}

/**
 * Exécute UN passage. Ne lève jamais : un cron ne doit pas rougir parce qu'une
 * base a hoqueté.
 */
export async function executerPassage(
  p: Passage,
  nowMs: number = Date.now(),
): Promise<PassageResultat> {
  const VIDE = { moment: p.moment, candidats: 0, envoyes: 0, echecs: 0 } as const;

  const bornesTemps = p.fenetre
    ? {
        gte: new Date(nowMs + p.fenetre.minMinutes * 60_000),
        lt: new Date(nowMs + p.fenetre.maxMinutes * 60_000),
      }
    : // Confirmation : tout ce qui est encore à venir. La borne basse est
      // essentielle — sans elle, l'ajout de la colonne à `NULL` ferait écrire à
      // tous les rendez-vous passés de l'historique.
      { gt: new Date(nowMs) };

  let candidats;
  try {
    candidats = await prisma.calendlyEvent.findMany({
      where: {
        // Un rendez-vous annulé, terminé ou marqué absent n'a rien à dire.
        status: "scheduled",
        startTime: bornesTemps,
        ...filtreNonEnvoye(p.marqueur),
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
      miseEnFile = await enqueueEmail(p.job, rdv.inviteeEmail, "fr", {
        moment: p.moment,
        prenom: prenomOuDefaut(rdv.inviteeName),
        heure: heureParis(rdv.startTime),
        ...(p.avecDate ? { date: dateParis(rdv.startTime) } : {}),
        ...(dureeMinutes && dureeMinutes > 0 ? { dureeMinutes } : {}),
        ...(rdv.location ? { lieu: rdv.location } : {}),
        ...(rdv.cancelUrl ? { cancelUrl: rdv.cancelUrl } : {}),
        ...(rdv.rescheduleUrl ? { rescheduleUrl: rdv.rescheduleUrl } : {}),
      });
    } catch (e) {
      console.warn(
        `[${p.job}] mise en file impossible pour ${rdv.id} : ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    // 🔴 LE MARQUEUR N'EST POSÉ QUE SUR UN SUCCÈS RÉEL.
    if (!miseEnFile?.enqueued) {
      echecs += 1;
      continue;
    }

    try {
      await prisma.calendlyEvent.update({
        where: { id: rdv.id },
        data: marqueurPose(p.marqueur, new Date(nowMs)),
      });
      envoyes += 1;
    } catch (e) {
      // Le message est parti mais le marqueur n'a pas pu être posé : le passage
      // suivant renverra. Un doublon vaut mieux qu'un silence, et il faut que ça
      // se voie.
      console.error(
        `[${p.job}] ⚠️ message ENVOYÉ mais marqueur NON POSÉ pour ${rdv.id} — un doublon est possible : ${e instanceof Error ? e.message : String(e)}`,
      );
      envoyes += 1;
    }
  }

  return {
    ok: true,
    moment: p.moment,
    candidats: aTraiter.length,
    envoyes,
    echecs,
    ...(plafondAtteint ? { plafondAtteint: true as const } : {}),
  };
}

/**
 * Exécute les trois passages, dans l'ordre.
 *
 * ⚠️ L'ordre compte à la marge : un rendez-vous réservé pour dans 70 minutes
 * reçoit sa confirmation ET son rappel H-1 au même tick. C'est voulu — le
 * supprimer demanderait de taire l'un des deux, et taire une confirmation parce
 * que l'appel est proche est le mauvais choix : c'est justement là qu'elle sert.
 */
export async function envoyerMessagesAppel(
  nowMs: number = Date.now(),
): Promise<readonly PassageResultat[]> {
  const resultats: PassageResultat[] = [];
  for (const p of PASSAGES) {
    resultats.push(await executerPassage(p, nowMs));
  }
  return resultats;
}
