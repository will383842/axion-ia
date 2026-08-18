/**
 * 🔴 CORRIGER LES DATES D'UNE SESSION QUAND DES PIÈCES S'APPUIENT DESSUS.
 * Module PUR.
 *
 * ## Le défaut
 *
 * `createSessionAction`, `setSessionLieuAction` et `transitionSessionAction`
 * étaient les SEULES écritures sur une session. Une date de début saisie de
 * travers — un « 09 » au lieu d'un « 10 » — n'avait donc AUCUN chemin de
 * correction. Le seul geste disponible était « Reporter » : il crée une
 * nouvelle session et laisse l'ancienne au registre en statut « Reportée ».
 *
 * Autrement dit, le registre légal gardait la trace d'un report qui n'a jamais
 * eu lieu, pour une faute de frappe. C'est un marteau-pilon, et c'est aussi une
 * FAUSSE information versée au registre : un auditeur qui lit « session
 * reportée » cherche un motif de report, et il n'y en a pas.
 *
 * ⚠️ Et « Reporter » n'est même pas la porte sûre qu'on croit :
 * `reportSessionAction` n'a AUCUNE garde de preuves. Il reporte sans un mot une
 * session dont la feuille d'émargement est déjà signée. Renvoyer vers lui au
 * motif qu'il serait « plus prudent » serait donc faux.
 *
 * ## Ce que ce module NE fait pas
 *
 * 🔴 Il n'interdit pas. C'est la doctrine déjà écrite dans
 * `presence/requalification-jours.ts`, et elle vaut a fortiori ici :
 * **corriger une coquille ne doit pas devenir une cérémonie**. Un refus dur
 * renverrait vers « Reporter », c'est-à-dire vers le défaut lui-même — sous un
 * autre nom, et sans garde.
 *
 * Il **refuse le changement SILENCIEUX** : quand des pièces s'appuient déjà sur
 * ces dates, la requalification exige un motif écrit, l'écran dit exactement ce
 * qui est en jeu, et le motif part au journal d'activité. Même patron que la
 * rectification d'une pièce (`rectificationMotif`).
 *
 * ⚠️ Miroir volontaire de `presence/requalification-jours.ts` : même forme
 * (`verdict…` + `messageRefus…`), même contrat, mêmes garanties. Les deux gardes
 * couvrent deux données distinctes — la PLAGE de la session ici, les JOURNÉES
 * réellement animées là-bas — et rien ne garantit qu'elles bougent ensemble.
 */

/** La plage de dates d'une session, réduite à ce qui la distingue. */
export interface PlageDates {
  /** Instant ISO 8601 (`Date.prototype.toISOString()`). */
  readonly dateDebut: string;
  readonly dateFin: string;
}

/**
 * Ce qui s'appuie déjà sur les dates de la session, tel que l'appelant l'a
 * compté. Aucun accès base ici : ce module doit rester testable sans DB.
 */
export interface PreuvesDates {
  /** Inscriptions dont l'émargement est SIGNÉ. */
  readonly emargementsSignes: number;
  /** Signatures électroniques non révoquées sur les pièces de la session. */
  readonly signatures: number;
  /** Liens d'émargement encore actifs (non révoqués). */
  readonly liensEmargement: number;
  /** Convocations déjà PARTIES aux stagiaires. */
  readonly convocationsEnvoyees: number;
  /** Documents générés et non annulés (convention, convocation, feuille…). */
  readonly documentsEmis: number;
  /** Créneaux de présence déjà générés. */
  readonly creneaux: number;
}

export interface VerdictDates {
  /** Les dates changent-elles réellement ? */
  readonly changement: boolean;
  /** `true` ⇒ l'écriture exige un motif. Jamais un refus définitif. */
  readonly motifRequis: boolean;
  /** Ce qui est en jeu, en toutes lettres, prêt à rendre à l'écran. */
  readonly enJeu: ReadonlyArray<string>;
}

/** Deux plages décrivent-elles le même créneau ? Comparaison sur l'instant exact. */
export function memesDates(avant: PlageDates, apres: PlageDates): boolean {
  return avant.dateDebut === apres.dateDebut && avant.dateFin === apres.dateFin;
}

/** `1 feuille` / `3 feuilles` — un message qui écrit « 1 feuilles » ne se lit plus. */
function pluriel(n: number, singulier: string, plurielMot: string): string {
  return n > 1 ? plurielMot : singulier;
}

/**
 * Que risque-t-on à réécrire ces dates ?
 *
 * 🔴 L'ordre des motifs n'est pas décoratif.
 *
 * La FEUILLE D'ÉMARGEMENT vient en premier parce que c'est la seule pièce
 * OPPOSABLE de la liste : signée, elle atteste une présence à une date donnée,
 * et elle ne se corrige plus que par une rectification au registre. Viennent
 * ensuite les SIGNATURES (et les liens qui les portent, même chaîne), puis les
 * CONVOCATIONS déjà parties — une personne prévenue s'est organisée sur ces
 * dates — puis les CRÉNEAUX, qui ne sont pas réécrits par cette action.
 *
 * `documentsEmis` est le plus large et le moins précis : placé en tête, il
 * noierait les motifs qui nomment vraiment le risque. Il figure donc juste
 * avant les créneaux.
 */
export function verdictDates(args: {
  readonly avant: PlageDates;
  readonly apres: PlageDates;
  readonly preuves: PreuvesDates;
}): VerdictDates {
  const changement = !memesDates(args.avant, args.apres);
  if (!changement) {
    // Réenregistrer à l'identique n'est pas une requalification : c'est un clic.
    // Exiger un motif ici apprendrait à en inventer un — et un motif inventé au
    // registre est pire qu'un motif absent.
    return { changement: false, motifRequis: false, enJeu: [] };
  }

  const enJeu: string[] = [];
  const {
    emargementsSignes,
    signatures,
    liensEmargement,
    convocationsEnvoyees,
    documentsEmis,
    creneaux,
  } = args.preuves;

  if (emargementsSignes > 0) {
    enJeu.push(
      `${emargementsSignes} émargement${pluriel(emargementsSignes, "", "s")} déjà signé${pluriel(emargementsSignes, "", "s")} : la feuille d'émargement atteste une présence aux dates actuelles et reste opposable. Après ce changement, la pièce et le dossier ne diront plus la même chose — il faudra la rectifier au registre.`,
    );
  }
  if (signatures > 0) {
    enJeu.push(
      `${signatures} signature${pluriel(signatures, "", "s")} électronique${pluriel(signatures, "", "s")} non révoquée${pluriel(signatures, "", "s")} : elle${pluriel(signatures, "", "s")} port${pluriel(signatures, "e", "ent")} sur des pièces qui impriment les dates actuelles.`,
    );
  }
  if (liensEmargement > 0) {
    enJeu.push(
      `${liensEmargement} lien${pluriel(liensEmargement, "", "s")} d'émargement encore actif${pluriel(liensEmargement, "", "s")} : ${pluriel(liensEmargement, "il ouvre", "ils ouvrent")} une feuille qui annonce les anciennes dates.`,
    );
  }
  if (convocationsEnvoyees > 0) {
    enJeu.push(
      `${convocationsEnvoyees} convocation${pluriel(convocationsEnvoyees, "", "s")} déjà partie${pluriel(convocationsEnvoyees, "", "s")} : ${pluriel(convocationsEnvoyees, "le stagiaire s'est organisé", "les stagiaires se sont organisés")} sur les dates annoncées. Prévenez-${pluriel(convocationsEnvoyees, "le", "les")} et réémettez la convocation.`,
    );
  }
  if (documentsEmis > 0) {
    enJeu.push(
      `${documentsEmis} document${pluriel(documentsEmis, "", "s")} déjà émis et non annulé${pluriel(documentsEmis, "", "s")} : ${pluriel(documentsEmis, "il n'est", "ils ne sont")} PAS régénéré${pluriel(documentsEmis, "", "s")} par cette action et ${pluriel(documentsEmis, "continuera", "continueront")} d'imprimer les anciennes dates.`,
    );
  }
  if (creneaux > 0) {
    enJeu.push(
      `${creneaux} créneau${pluriel(creneaux, "", "x")} de présence déjà généré${pluriel(creneaux, "", "s")} : ${pluriel(creneaux, "il n'est", "ils ne sont")} PAS réécrit${pluriel(creneaux, "", "s")} par cette action, et ${pluriel(creneaux, "portera", "porteront")} donc les anciennes dates jusqu'à correction manuelle.`,
    );
  }

  return { changement: true, motifRequis: enJeu.length > 0, enJeu };
}

/**
 * 🔴 DÉCISION — les `SessionJour` NE SONT PAS décalés par une correction de dates.
 *
 * La question se pose forcément : la session porte de nouvelles dates et
 * d'anciennes journées. Trois raisons de ne pas y toucher, dans cet ordre :
 *
 * 1. Les journées ne SONT PAS dérivées de la plage. C'est la prémisse de D14,
 *    écrite en toutes lettres dans `actions/qualiopi/session-jours.ts` :
 *    « dateDebut..dateFin ne décrit pas les jours d'une session ». Quatre
 *    journées réparties sur trois mois n'ont AUCUN décalage commun avec leur
 *    plage — un « +2 jours » appliqué à tout le monde serait une invention.
 * 2. Une journée peut porter `horairesConfirmes = true` : un humain l'a validée,
 *    et elle s'imprime sur la feuille d'émargement, qui est opposable. La
 *    réécrire ici serait exactement le changement SILENCIEUX que
 *    `presence/requalification-jours.ts` refuse — et sans même son motif.
 * 3. Les `PresenceCreneau` dérivent des journées et portent les signatures.
 *    Décaler les journées sans les créneaux ouvrirait une SECONDE divergence au
 *    lieu d'en fermer une.
 *
 * Le prix : la divergence existe. Elle doit donc SE VOIR — c'est tout l'objet de
 * cette fonction, dont le résultat est affiché en permanence sur la fiche.
 *
 * ⚠️ Toutes les chaînes sont des jours civils `AAAA-MM-JJ` en fuseau de PARIS.
 * La comparaison lexicographique est exacte sur ce format, et seulement sur lui.
 */
export function compterJoursHorsPlage(args: {
  readonly joursISO: ReadonlyArray<string>;
  readonly debutISO: string;
  readonly finISO: string;
}): number {
  return args.joursISO.filter((j) => j < args.debutISO || j > args.finISO).length;
}

/**
 * Le message de refus, quand le motif manque.
 *
 * Il NOMME ce qui est en jeu et dit quoi faire. Un refus qui se contente
 * d'« opération impossible » envoie contourner l'outil — ici, il enverrait
 * droit sur « Reporter », qui fabriquerait un faux report au registre ET ne
 * garde rien.
 */
export function messageRefusDates(enJeu: ReadonlyArray<string>): string {
  return (
    "Ces dates fondent des pièces déjà produites. " +
    enJeu.join(" ") +
    " Indiquez le motif de la correction pour continuer — il sera versé au journal."
  );
}
