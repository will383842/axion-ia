/**
 * Qualiopi — La REMISE du contrat de travail au salarié (module PUR).
 *
 * Aucune lecture Prisma, aucune horloge implicite : ce module décide sur des
 * valeurs, et l'appelant lui donne l'heure.
 *
 * ## 🔴 Pourquoi la remise doit être OBSERVÉE, et pas supposée
 *
 * Le contrat est produit, le salarié est prévenu, la pièce l'attend dans son
 * espace. Reste un fait que le logiciel ne voit pas : **est-ce qu'il a son
 * exemplaire ?** Le contrat annonce lui-même « deux exemplaires originaux ». Si
 * cette remise a lieu, tout va bien. Si elle n'a pas lieu — quelqu'un est en
 * déplacement, quelqu'un oublie — rien ne le dit, rien ne compte les jours, et
 * personne ne l'apprend avant un conseil de prud'hommes.
 *
 * C'est le motif que ce dépôt a payé plusieurs fois, d'un cran plus loin : un
 * contrat complet que personne n'annonçait, puis un contrat annoncé dont la
 * remise ne reposait sur rien d'observable. Le dernier maillon était encore un
 * humain qu'on suppose.
 *
 * ## ⚠️ CE QUI REND LE CDD DIFFÉRENT, ET SEUL DIFFÉRENT
 *
 * L'art. L.1242-13 impose la TRANSMISSION du CDD au salarié dans les deux jours
 * ouvrables suivant l'embauche. Le manquement n'est pas une amende : c'est la
 * **requalification en contrat à durée indéterminée** (art. L.1245-1). Un CDI,
 * lui, ne porte aucun délai de cette nature — le remettre reste une obligation
 * de l'employeur, mais son retard ne requalifie rien.
 *
 * La règle ci-dessous ne surveille donc QUE le CDD. Étendre la surveillance au
 * CDI produirait une alerte sans conséquence attachée, et une alerte sans
 * conséquence apprend à ignorer les alertes.
 *
 * ## ⛔ CE MODULE NE CALCULE PAS « DEUX JOURS OUVRABLES », ET C'EST DÉLIBÉRÉ
 *
 * « Ouvrables » suppose les samedis, les dimanches et les onze jours fériés —
 * dont deux mobiles. Une date fausse sur un délai de REQUALIFICATION serait pire
 * qu'aucune date : elle ferait croire qu'on a jusque-là.
 *
 * La surveillance s'arme donc **dès le jour de l'embauche**, pendant que le
 * délai court, et le message énonce la règle sans prétendre la dater. Une alerte
 * n'a pas à prononcer un verdict après coup : elle doit rappeler pendant qu'il
 * est encore temps d'agir. Alerter tôt est utile ; alerter juste est impossible
 * ici ; alerter tard ne sert à rien.
 */

/** Délai légal de transmission d'un CDD, en jours OUVRABLES (art. L.1242-13). */
export const DELAI_REMISE_CDD_JOURS_OUVRABLES = 2;

/** Ce qu'il faut savoir d'un salarié pour dire si sa remise est en souffrance. */
export interface SalarieRemise {
  readonly statut: "salarie" | "sous_traitant" | "dirigeant";
  readonly contratType: "cdi" | "cdd" | null;
  /** Entrée en fonction. C'est elle qui arme le délai, pas la date du contrat. */
  readonly dateEmbauche: Date | null;
  /** Remise consignée. `null` = personne n'a encore dit que le salarié l'a. */
  readonly contratRemisAt: Date | null;
  /** Un contrat a-t-il été ÉTABLI ? Sans pièce, il n'y a rien à remettre. */
  readonly contratEtabli: boolean;
}

/**
 * La remise de ce contrat est-elle en souffrance ?
 *
 * 🔑 Cinq conditions, et chacune retire un faux positif que l'alerte aurait
 * produit sans elle :
 *
 *   · SALARIÉ — un sous-traitant n'a pas de contrat de travail, un dirigeant
 *     relève de son mandat social ;
 *   · CDD — seul le CDD porte le délai de l'art. L.1242-13 (cf. l'en-tête) ;
 *   · contrat ÉTABLI — sans pièce produite, il n'y a rien à remettre, et
 *     réclamer la remise d'un document inexistant enverrait chercher une erreur
 *     là où il n'y a qu'une étape non faite ;
 *   · embauche COMMENCÉE — le délai part de l'entrée en fonction. Un contrat
 *     signé trois semaines à l'avance n'est en retard de rien ;
 *   · remise NON consignée — c'est la question posée.
 *
 * ⚠️ `dateEmbauche` au jour même compte comme commencée : le délai court dès le
 * premier jour. Comparer en strictement supérieur ferait taire l'alerte
 * précisément le jour où elle est le plus utile.
 */
export function remiseCddEnSouffrance(s: SalarieRemise, now: Date): boolean {
  if (s.statut !== "salarie") return false;
  if (s.contratType !== "cdd") return false;
  if (!s.contratEtabli) return false;
  if (s.contratRemisAt !== null) return false;
  if (s.dateEmbauche === null) return false;
  return s.dateEmbauche.getTime() <= now.getTime();
}

/**
 * Depuis combien de jours CALENDAIRES l'embauche a-t-elle commencé ?
 *
 * ⚠️ CALENDAIRES, et le nom le dit : ce nombre sert à situer l'ancienneté du
 * manquement dans un message (« embauché depuis 5 jours »), JAMAIS à décider si
 * le délai légal est dépassé. Le décider supposerait de compter les jours
 * ouvrables, ce que ce module refuse de faire — cf. l'en-tête.
 *
 * `null` quand l'embauche n'a pas commencé : un nombre négatif se lirait comme
 * un retard à rebours.
 */
export function joursDepuisEmbauche(dateEmbauche: Date | null, now: Date): number | null {
  if (dateEmbauche === null) return null;
  const ms = now.getTime() - dateEmbauche.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

/**
 * Le message d'alerte, qui énonce la règle sans prétendre la dater.
 *
 * 🔑 Il nomme la CONSÉQUENCE — la requalification — parce qu'une alerte qui dit
 * seulement « à faire » se range derrière les autres. Celle-ci ne se rattrape
 * pas en payant : c'est la nature même du contrat qui bascule.
 */
export function messageRemiseCdd(nomPrenom: string, joursEcoules: number | null): string {
  const anciennete =
    joursEcoules === null
      ? ""
      : joursEcoules === 0
        ? " Son embauche commence aujourd'hui."
        : ` Son embauche a commencé il y a ${joursEcoules} jour${joursEcoules > 1 ? "s" : ""}.`;
  return (
    `Le CDD de ${nomPrenom} a été établi, et sa remise au salarié n'est pas consignée.` +
    anciennete +
    ` Un CDD doit lui être transmis dans les ${DELAI_REMISE_CDD_JOURS_OUVRABLES} jours ouvrables` +
    " suivant l'embauche (art. L.1242-13) ; au-delà, il est requalifiable en contrat à durée" +
    " indéterminée (art. L.1245-1). Remettez-lui son exemplaire, puis consignez la date sur sa" +
    " fiche — c'est cette date qui éteint l'alerte."
  );
}
