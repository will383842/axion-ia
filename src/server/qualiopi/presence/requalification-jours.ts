/**
 * 🔴 REQUALIFIER LES JOURNÉES D'UNE SESSION QUAND DES PREUVES EXISTENT DÉJÀ.
 * Module PUR.
 *
 * ## Le défaut, trouvé le 2026-08-17 en auditant le Lot 3
 *
 * `saveSessionJoursAction` fait `deleteMany` puis `createMany` sur
 * `SessionJour` — **sans regarder** si quelque chose s'appuie déjà sur ces
 * journées. Or elles ne sont pas une donnée de confort :
 *
 *   · la **feuille d'émargement** les IMPRIME. Une fois le PDF émis, il porte
 *     « 10 et 11 septembre » — et il est opposable ;
 *   · les **créneaux de présence** en sont dérivés, et ce sont eux qui portent
 *     les signatures ;
 *   · l'**attestation** s'appuie sur le taux de présence, donc sur ces créneaux.
 *
 * Réécrire les journées après coup fait **diverger la pièce et la base**, en
 * silence. L'auditeur qui rapproche les deux trouve deux vérités, et l'organisme
 * n'a aucune trace de laquelle il défendait.
 *
 * ⚠️ L'en-tête de `session-jours.ts` traite déjà le cas voisin — retirer une
 * journée ne supprime pas les créneaux, *« une preuve effacée ne se corrige
 * pas »*. Le raisonnement est juste ; il ne couvrait simplement pas ce
 * cas-ci : la pièce DÉJÀ ÉMISE.
 *
 * ## Ce que ce module NE fait pas
 *
 * 🔴 Il n'interdit pas. Corriger une coquille de date doit rester possible —
 * c'est même le défaut D4 du plan (« corriger une coquille exige de créer une
 * session et d'en laisser une Reportée au registre »). Interdire ici
 * reproduirait ce défaut sous un autre nom.
 *
 * Il **refuse le changement SILENCIEUX** : quand des preuves existent, la
 * requalification exige un motif écrit, et l'écran dit exactement ce qui est en
 * jeu. C'est le même patron que la rectification d'une pièce (`rectificationMotif`).
 */

/** Une journée déclarée, réduite à ce qui la distingue. */
export interface JourDeclare {
  /** Jour civil ISO — `AAAA-MM-JJ`. */
  readonly date: string;
  readonly heureDebut: string;
  readonly heureFin: string;
}

/** Ce qui s'appuie déjà sur les journées, tel que l'appelant l'a chargé. */
export interface PreuvesExistantes {
  /** Feuilles d'émargement ÉMISES et non annulées. */
  readonly feuillesEmargement: number;
  /** Inscriptions dont l'émargement est signé. */
  readonly emargementsSignes: number;
  /** Créneaux de présence déjà générés. */
  readonly creneaux: number;
}

export interface VerdictRequalification {
  /** Les journées changent-elles réellement ? */
  readonly changement: boolean;
  /**
   * `true` ⇒ l'écriture exige un motif. Jamais un refus définitif.
   */
  readonly motifRequis: boolean;
  /**
   * Ce qui est en jeu, en toutes lettres, prêt à rendre à l'écran.
   * Vide si rien n'est en jeu.
   */
  readonly enJeu: ReadonlyArray<string>;
}

/**
 * Deux listes de journées décrivent-elles la même chose ?
 *
 * ⚠️ Comparaison sur (date, heureDebut, heureFin) et INSENSIBLE à l'ordre : le
 * formulaire peut réordonner sans que rien ne change. Comparer les tableaux
 * position par position ferait crier au changement sur un simple tri — et une
 * garde qui crie à tort cesse d'être lue.
 */
export function memesJournees(
  avant: ReadonlyArray<JourDeclare>,
  apres: ReadonlyArray<JourDeclare>,
): boolean {
  if (avant.length !== apres.length) return false;
  const cle = (j: JourDeclare): string => `${j.date}|${j.heureDebut}|${j.heureFin}`;
  const a = [...avant].map(cle).sort();
  const b = [...apres].map(cle).sort();
  return a.every((v, i) => v === b[i]);
}

/**
 * Que risque-t-on à réécrire ces journées ?
 *
 * 🔴 L'ordre des motifs n'est pas décoratif : la feuille d'émargement vient en
 * PREMIER parce que c'est la seule pièce OPPOSABLE de la liste. Un émargement
 * signé sans feuille émise se corrige encore ; une feuille émise qui ment ne se
 * corrige que par une rectification au registre.
 */
export function verdictRequalification(args: {
  readonly avant: ReadonlyArray<JourDeclare>;
  readonly apres: ReadonlyArray<JourDeclare>;
  readonly preuves: PreuvesExistantes;
}): VerdictRequalification {
  const changement = !memesJournees(args.avant, args.apres);
  if (!changement) {
    // Réenregistrer à l'identique n'est pas une requalification : c'est un
    // clic. Exiger un motif ici apprendrait à en inventer un.
    return { changement: false, motifRequis: false, enJeu: [] };
  }

  const enJeu: string[] = [];
  const { feuillesEmargement, emargementsSignes, creneaux } = args.preuves;

  if (feuillesEmargement > 0) {
    enJeu.push(
      `${feuillesEmargement} feuille${feuillesEmargement > 1 ? "s" : ""} d'émargement déjà émise${feuillesEmargement > 1 ? "s" : ""} : elle${feuillesEmargement > 1 ? "s" : ""} imprime${feuillesEmargement > 1 ? "nt" : ""} les journées actuelles et reste${feuillesEmargement > 1 ? "nt" : ""} opposable${feuillesEmargement > 1 ? "s" : ""}. Après ce changement, la pièce et le dossier ne diront plus la même chose — il faudra la rectifier au registre.`,
    );
  }
  if (emargementsSignes > 0) {
    enJeu.push(
      `${emargementsSignes} émargement${emargementsSignes > 1 ? "s" : ""} déjà signé${emargementsSignes > 1 ? "s" : ""} : la signature atteste une présence sur les journées d'origine.`,
    );
  }
  if (creneaux > 0) {
    enJeu.push(
      `${creneaux} créneau${creneaux > 1 ? "x" : ""} de présence déjà généré${creneaux > 1 ? "s" : ""} : ils ne sont PAS réécrits par cette action, et porteront donc les anciennes dates jusqu'à correction manuelle.`,
    );
  }

  return { changement: true, motifRequis: enJeu.length > 0, enJeu };
}

/**
 * Le message de refus, quand le motif manque.
 *
 * Il NOMME ce qui est en jeu et dit quoi faire — un refus qui se contente de
 * « opération impossible » envoie contourner l'outil, et c'est exactement ce
 * qu'on cherche à éviter sur une donnée à valeur probante.
 */
export function messageRefus(enJeu: ReadonlyArray<string>): string {
  return (
    "Ces journées fondent des pièces déjà produites. " +
    enJeu.join(" ") +
    " Indiquez le motif de la requalification pour continuer — il sera versé au journal."
  );
}
