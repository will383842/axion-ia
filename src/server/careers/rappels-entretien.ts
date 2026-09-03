import "server-only";

/**
 * LES RAPPELS D'ENTRETIEN — J-1 et H-1.
 *
 * ## Calque assumé de `server/calendly/rappels-appel.ts`
 *
 * Mêmes fenêtres, même cadence, même doctrine d'idempotence. Ce n'est pas une
 * copie par paresse : c'est le même problème, et il a déjà été résolu une fois
 * correctement. Ce qui diffère est ce qui devait différer — la table lue, le
 * gabarit, et le fait que l'adresse du destinataire est CHIFFRÉE ici.
 *
 * ## Les fenêtres, et pourquoi elles sont larges
 *
 * La passe tourne toutes les 5 minutes ; les fenêtres font 15 minutes, soit
 * TROIS fois la cadence. Un passage sauté — redémarrage, file saturée, hoquet
 * Redis — est rattrapé par les deux suivants. Une fenêtre égale à la cadence
 * perdrait le rappel au premier incident, et personne ne le verrait.
 *
 * Conséquence assumée : un rappel « H-1 » part entre 60 et 75 minutes avant.
 * Pour un rappel, cette imprécision n'a aucun coût.
 *
 * ## L'IDEMPOTENCE EST LA SEULE CHOSE QUI EMPÊCHE LA BOUCLE
 *
 * Avec une fenêtre de 15 minutes et une cadence de 5, chaque entretien est vu
 * TROIS FOIS. Sans marqueur, le candidat recevrait trois messages.
 *
 * 🔴 Les deux marqueurs sont DISTINCTS. Un marqueur unique pour deux moments
 * ferait taire le second : le J-1 le poserait, et le H-1 ne verrait plus aucun
 * candidat.
 *
 * 🔴 `enqueueEmail` NE LÈVE PAS : elle rend `{ enqueued }`. Écrire « envoyé »
 * sur un retour faux est le défaut `D5-1-C1` de ce dépôt — une trace qui affirme
 * un envoi qui n'a pas eu lieu interdit le rattrapage.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { enqueueEmail } from "@/server/queue/queues";

/**
 * Plafond par passage.
 *
 * Il ne protège pas d'un volume réel — il n'y a jamais cinquante entretiens
 * dans le même quart d'heure. Il protège d'un EMBALLEMENT : si un marqueur
 * cessait d'être posé (colonne perdue à une migration, erreur de requête), la
 * passe rejouerait la même liste toutes les cinq minutes. Le plafond borne les
 * dégâts, et `plafondAtteint` les rend visibles au lieu de les taire.
 */
const MAX_PAR_PASSAGE = 50;

type ChampMarqueur = "rappelJ1EnvoyeAt" | "rappelH1EnvoyeAt";

export type MomentRappel = "j1" | "h1";

interface Passage {
  readonly moment: MomentRappel;
  readonly marqueur: ChampMarqueur;
  readonly fenetre: { readonly minMinutes: number; readonly maxMinutes: number };
}

/**
 * 🔑 La table qui porte toute la différence entre les deux messages.
 *
 * Ajouter un troisième moment se fait ici et dans le gabarit — nulle part
 * ailleurs.
 */
export const PASSAGES_ENTRETIEN: readonly Passage[] = [
  // 24 h → 24 h 15.
  { moment: "j1", marqueur: "rappelJ1EnvoyeAt", fenetre: { minMinutes: 1440, maxMinutes: 1455 } },
  { moment: "h1", marqueur: "rappelH1EnvoyeAt", fenetre: { minMinutes: 60, maxMinutes: 75 } },
] as const;

export interface ResultatPassage {
  readonly ok: boolean;
  readonly moment: MomentRappel;
  /** Entretiens entrés dans la fenêtre à ce passage. */
  readonly candidats: number;
  /** Messages réellement mis en file. */
  readonly envoyes: number;
  /** Mises en file refusées — le marqueur n'est PAS posé, on réessaiera. */
  readonly echecs: number;
  /** Adresses illisibles : la clé de chiffrement manque ou est désalignée. */
  readonly adressesIllisibles: number;
  /** Présent seulement si le plafond a mordu — jamais de troncature muette. */
  readonly plafondAtteint?: true;
}

/** `{ rappelJ1EnvoyeAt: null }` — la clause qui sélectionne les non-envoyés. */
function filtreNonEnvoye(marqueur: ChampMarqueur): Record<string, null> {
  return { [marqueur]: null };
}

/** `{ rappelJ1EnvoyeAt: quand }` — la clause qui pose le marqueur. */
function marqueurPose(marqueur: ChampMarqueur, quand: Date): Record<string, Date> {
  return { [marqueur]: quand };
}

/** Heure de Paris, telle qu'on l'écrit dans un message. */
function heureParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function dateParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/**
 * Exécute UN passage.
 *
 * `nowMs` est un paramètre et non `Date.now()` : c'est ce qui rend les fenêtres
 * testables sans horloge globale.
 */
export async function executerPassageEntretien(
  p: Passage,
  nowMs: number = Date.now(),
): Promise<ResultatPassage> {
  const VIDE = {
    moment: p.moment,
    candidats: 0,
    envoyes: 0,
    echecs: 0,
    adressesIllisibles: 0,
  } as const;

  let candidats;
  try {
    candidats = await prisma.jobInterview.findMany({
      where: {
        // Un entretien annulé, tenu ou dont le candidat ne s'est pas présenté
        // n'a rien à rappeler.
        state: "planifie",
        scheduledAt: {
          gte: new Date(nowMs + p.fenetre.minMinutes * 60_000),
          lt: new Date(nowMs + p.fenetre.maxMinutes * 60_000),
        },
        ...filtreNonEnvoye(p.marqueur),
      },
      orderBy: { scheduledAt: "asc" },
      take: MAX_PAR_PASSAGE + 1,
      select: {
        id: true,
        scheduledAt: true,
        durationMin: true,
        mode: true,
        location: true,
        round: true,
        application: {
          select: { id: true, email: true, firstName: true, offerTitleSnap: true, locale: true },
        },
      },
    });
  } catch (e) {
    console.error(
      `[rappel-entretien-${p.moment}] lecture impossible : ${e instanceof Error ? e.message : String(e)}`,
    );
    return { ...VIDE, ok: false };
  }

  const plafondAtteint = candidats.length > MAX_PAR_PASSAGE;
  const aTraiter = plafondAtteint ? candidats.slice(0, MAX_PAR_PASSAGE) : candidats;
  if (plafondAtteint) {
    console.error(
      `[rappel-entretien-${p.moment}] ⚠️ plafond de ${MAX_PAR_PASSAGE} atteint : ` +
        "le marqueur cesse-t-il d'être posé ? La passe rejouerait la même liste " +
        "toutes les cinq minutes.",
    );
  }

  let envoyes = 0;
  let echecs = 0;
  let adressesIllisibles = 0;

  for (const entretien of aTraiter) {
    // 🔴 L'adresse est CHIFFRÉE au repos. On la déchiffre ici, dans le processus
    // qui a la clé, et on la passe à la file — comme le fait l'accusé de
    // réception de candidature. Une adresse illisible (clé absente ou
    // désalignée) ne consomme PAS le marqueur : c'est un problème de
    // configuration, il se corrige et la passe suivante rattrape.
    const adresse = decryptPii(entretien.application.email);
    if (!isDecryptedEmailUsable(adresse)) {
      adressesIllisibles += 1;
      console.error(
        `[rappel-entretien-${p.moment}] adresse illisible pour l'entretien ${entretien.id} — ` +
          "PII_ENCRYPTION_KEY absente ou désalignée ? Le marqueur n'est pas posé, on réessaiera.",
      );
      continue;
    }

    let miseEnFile: { enqueued: boolean } | null = null;
    try {
      miseEnFile = await enqueueEmail(
        "candidature-entretien-rappel",
        adresse,
        entretien.application.locale,
        {
          moment: p.moment,
          prenom: decryptPii(entretien.application.firstName),
          offerTitle: entretien.application.offerTitleSnap,
          heure: heureParis(entretien.scheduledAt),
          ...(p.moment === "j1" ? { date: dateParis(entretien.scheduledAt) } : {}),
          ...(entretien.durationMin ? { dureeMinutes: entretien.durationMin } : {}),
          ...(entretien.location ? { lieu: entretien.location } : {}),
          format: entretien.mode,
          tour: entretien.round,
        },
      );
    } catch (e) {
      console.warn(
        `[rappel-entretien-${p.moment}] mise en file impossible pour ${entretien.id} : ` +
          `${e instanceof Error ? e.message : String(e)}`,
      );
    }

    // 🔴 LE MARQUEUR N'EST POSÉ QUE SUR UN SUCCÈS RÉEL.
    if (!miseEnFile?.enqueued) {
      echecs += 1;
      continue;
    }

    try {
      await prisma.jobInterview.update({
        where: { id: entretien.id },
        data: marqueurPose(p.marqueur, new Date(nowMs)),
      });
      envoyes += 1;
    } catch (e) {
      // Le message est parti mais le marqueur n'a pas pu être posé : le passage
      // suivant renverra. Un doublon vaut mieux qu'un silence, et il faut que
      // ça se voie.
      console.error(
        `[rappel-entretien-${p.moment}] ⚠️ message ENVOYÉ mais marqueur NON POSÉ pour ` +
          `${entretien.id} — un doublon est possible : ${e instanceof Error ? e.message : String(e)}`,
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
    adressesIllisibles,
    ...(plafondAtteint ? { plafondAtteint: true as const } : {}),
  };
}

/** Exécute les deux passages, dans l'ordre. */
export async function envoyerRappelsEntretien(
  nowMs: number = Date.now(),
): Promise<ResultatPassage[]> {
  const resultats: ResultatPassage[] = [];
  for (const p of PASSAGES_ENTRETIEN) {
    resultats.push(await executerPassageEntretien(p, nowMs));
  }
  return resultats;
}
