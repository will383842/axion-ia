/**
 * LE RAPPEL J-7 POUVAIT-IL PARTIR ? — une seule règle, deux lecteurs.
 *
 * Module PUR : aucun Prisma, aucun `server-only`. Il est importé par le worker
 * de crons (l'envoyeur) et par la règle d'alerte `rappel_j7_non_envoye`.
 *
 * ## Le défaut (2026-09-15)
 *
 * 🔴 #1066 avait cessé d'alerter sur une session créée moins de 24 h avant son
 * début. Le seuil était NÉCESSAIRE, pas SUFFISANT : l'envoyeur ne passe qu'une
 * fois par jour, à 08:00 UTC, et il exige que la convocation de chaque inscrit
 * soit partie depuis au moins 24 h. Une session créée 30 ou 40 h avant son début
 * ne rencontre aucun passage où ces deux conditions tiennent — et recevait
 * pourtant « Rappel J-7 jamais envoyé ».
 *
 * 🔑 La règle d'alerte comptait des HEURES ; l'envoyeur, lui, suit un
 * CALENDRIER. Deux calculs jumeaux divergent au premier changement : la règle
 * rejoue donc désormais, passage par passage, LE prédicat de l'envoyeur
 * ({@link rappelJ7EnvoyableA}).
 *
 * ## Pourquoi on lit la convocation RÉELLE, et non `createdAt`
 *
 * L'avance se calculait sur `createdAt`. Une session créée le 01/09 pour le 30/09,
 * puis avancée le 20/09 au 22/09, affichait 21 jours d'avance — alors que le
 * cron de convocation ne l'a convoquée qu'après le changement, et que le rappel
 * n'avait plus aucun passage. `convocationEnvoyeeAt` porte cette histoire ;
 * `createdAt` non.
 */

const HEURE_MS = 60 * 60 * 1000;
const JOUR_MS = 24 * HEURE_MS;

/** L'heure UTC du passage quotidien de l'envoyeur (`queues.ts`, `0 8 * * *`). */
export const HEURE_PASSAGE_RAPPEL_J7_UTC = 8;

/**
 * L'ancienneté exigée de la convocation avant de rappeler (correctif S5 : jamais
 * deux messages quasi identiques dans la même matinée).
 */
export const DELAI_APRES_CONVOCATION_MS = 24 * HEURE_MS;

/** On ne rappelle pas plus de 7,5 jours avant le début. */
export const PLAFOND_RAPPEL_J7_MS = 7.5 * JOUR_MS;

/**
 * Le cron de convocation (horaire, `handleConvocationJ5`) ne convoque qu'à
 * 5,5 jours du début au plus tôt. Relu depuis le worker par un témoin : si l'un
 * bouge sans l'autre, le spec rougit.
 */
export const PLAFOND_CONVOCATION_MS = 5.5 * JOUR_MS;

/**
 * Le passage « de 08:00 » tourne à 08:00 et quelques secondes, à la même minute
 * que la convocation horaire : selon l'ordre d'exécution, une convocation posée
 * à 08:00:05 la veille a 24 h ou pas. La règle traite donc le passage comme la
 * fenêtre [08:00 ; 09:00[ — ÉCHEC OUVERT : dans le doute, l'alerte est levée.
 */
export const MARGE_PASSAGE_MS = HEURE_MS;

export interface InscritAuPassage {
  readonly convocationEnvoyeeAt: Date | null;
}

/**
 * LE prédicat de l'envoyeur : à l'instant `instant`, le cron de rappel envoie-t-il ?
 *
 * - au moins un inscrit actif ;
 * - CHAQUE inscrit convoqué depuis plus de 24 h (jamais convoqué = non) ;
 * - la session n'a pas commencé, et commence dans 7,5 jours au plus.
 *
 * Une date illisible rend `false` : l'envoyeur n'envoie pas sur une donnée
 * douteuse. (La règle d'alerte, elle, échoue ouvert AVANT d'appeler.)
 */
export function rappelJ7EnvoyableA(
  instant: Date,
  session: { readonly dateDebut: Date; readonly inscrits: ReadonlyArray<InscritAuPassage> },
): boolean {
  const t = instant.getTime();
  const debut = session.dateDebut.getTime();
  if (!(debut > t && debut <= t + PLAFOND_RAPPEL_J7_MS)) return false;
  if (session.inscrits.length === 0) return false;
  const mur = t - DELAI_APRES_CONVOCATION_MS;
  return session.inscrits.every(
    (i) => i.convocationEnvoyeeAt !== null && i.convocationEnvoyeeAt.getTime() < mur,
  );
}

export interface InscritConstate {
  /** Arrivée dans la session : avant, l'envoyeur ne le voyait pas. */
  readonly createdAt: Date;
  readonly convocationEnvoyeeAt: Date | null;
}

export interface SessionConstatee {
  readonly createdAt: Date;
  readonly dateDebut: Date;
  /** Les inscrits ACTIFS aujourd'hui (`inscriptionsActives()`). */
  readonly inscrits: ReadonlyArray<InscritConstate>;
}

const lisible = (d: unknown): d is Date => d instanceof Date && Number.isFinite(d.getTime());

/**
 * La première convocation que le cron horaire POUVAIT poser pour un inscrit qui
 * n'en a aucune : l'heure pile suivant son arrivée, et pas avant J-5,5.
 *
 * 🔑 Une convocation MANQUÉE n'excuse pas un rappel manqué : la chaîne pouvait
 * produire les deux. Seule une convocation RÉELLEMENT partie tard (inscrit
 * arrivé tard, date avancée) retire au rappel ses passages.
 */
function convocationAuPlusTot(arrivee: number, debut: number): number {
  const plancher = Math.max(arrivee, debut - PLAFOND_CONVOCATION_MS);
  const heurePile = Math.ceil(plancher / HEURE_MS) * HEURE_MS;
  return heurePile < debut ? heurePile : Number.POSITIVE_INFINITY;
}

/**
 * Au moins UN passage de l'envoyeur pouvait-il envoyer le rappel avant le début ?
 *
 * Pour chaque passage de 08:00 UTC, on cherche le PREMIER instant de sa fenêtre
 * ({@link MARGE_PASSAGE_MS}) où la session existe, où les inscrits alors
 * présents sont tous convoqués depuis 24 h, puis on y joue
 * {@link rappelJ7EnvoyableA}. Les conditions « convoqué depuis 24 h » et
 * « à moins de 7,5 j » ne font que se remplir avec le temps, « pas commencée »
 * ne fait que se vider : si le premier instant candidat échoue, tout le passage
 * échoue.
 *
 * ⚠️ ÉCHEC OUVERT : une date illisible, ou aucun inscrit lu, rend `true`. Ne pas
 * savoir ne ferme pas une alerte.
 */
export function rappelJ7PouvaitPartir(session: SessionConstatee): boolean {
  const inscrits = session.inscrits as ReadonlyArray<InscritConstate> | undefined;
  if (!lisible(session.createdAt) || !lisible(session.dateDebut)) return true;
  if (!Array.isArray(inscrits) || inscrits.length === 0) return true;
  if (
    inscrits.some(
      (i) =>
        !lisible(i.createdAt) ||
        (i.convocationEnvoyeeAt !== null && !lisible(i.convocationEnvoyeeAt)),
    )
  ) {
    return true;
  }

  const creee = session.createdAt.getTime();
  const debut = session.dateDebut.getTime();
  const lus = inscrits.map((i) => {
    const arrivee = Math.max(i.createdAt.getTime(), creee);
    return {
      arrivee,
      convoqueA: i.convocationEnvoyeeAt?.getTime() ?? convocationAuPlusTot(arrivee, debut),
    };
  });

  // Premier passage à examiner : la veille du jour où la session existe ET
  // entre dans le plafond de 7,5 jours. Au plus une dizaine de tours.
  const origine = Math.max(creee, debut - PLAFOND_RAPPEL_J7_MS);
  const jour = Math.floor(origine / JOUR_MS) * JOUR_MS - JOUR_MS;

  for (
    let passage = jour + HEURE_PASSAGE_RAPPEL_J7_UTC * HEURE_MS;
    passage < debut;
    passage += JOUR_MS
  ) {
    const fin = passage + MARGE_PASSAGE_MS;
    let t = Math.max(passage, creee, debut - PLAFOND_RAPPEL_J7_MS);
    let presents = lus.filter((l) => l.arrivee <= t);

    // Le point fixe : relever `t` tant qu'un inscrit présent n'a pas ses 24 h,
    // ou qu'il n'y a encore personne. Chaque relèvement est une borne
    // NÉCESSAIRE ; `t` ne fait que croître, les présents aussi.
    while (t < fin) {
      if (presents.length === 0) {
        const suivante = Math.min(...lus.map((l) => l.arrivee).filter((a) => a > t));
        if (!Number.isFinite(suivante)) break;
        t = suivante;
      } else {
        const mur = Math.max(...presents.map((p) => p.convoqueA)) + DELAI_APRES_CONVOCATION_MS + 1;
        if (mur <= t) break;
        t = mur;
      }
      presents = lus.filter((l) => l.arrivee <= t);
    }

    if (
      t < fin &&
      Number.isFinite(t) &&
      rappelJ7EnvoyableA(new Date(t), {
        dateDebut: session.dateDebut,
        inscrits: presents.map((p) => ({ convocationEnvoyeeAt: new Date(p.convoqueA) })),
      })
    ) {
      return true;
    }
  }
  return false;
}
