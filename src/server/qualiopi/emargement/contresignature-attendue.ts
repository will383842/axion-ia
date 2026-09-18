/**
 * Qualiopi — LA CONTRESIGNATURE EST-ELLE ATTENDUE PAR LE FINANCEUR ? Module PUR.
 *
 * ## Le défaut que ça règle
 *
 * L'organisme apprenait la règle **au refus de règlement**. Rien, dans l'outil,
 * ne disait qu'une feuille d'émargement non contresignée par le formateur peut
 * suffire à faire recaler un dossier chez un financeur. La machinerie de
 * contresignature existait (`contresignature-service.ts`), le registre existait,
 * le dossier d'audit la mentionnait — mais **au point d'action**, l'écran
 * d'émargement, aucune phrase ne reliait ce geste à l'argent.
 *
 * ## ⛔ CE QUE CE MODULE NE FAIT PAS, ET NE DOIT JAMAIS FAIRE
 *
 * **Bloquer.** Décision de Will du 25/08/2026, verbatim : « LA CONTRESIGNATURE
 * PAS BLOQUANTE ». Ce module rend un **constat**, jamais un refus :
 *
 * - aucune fonction ne lève ;
 * - aucun type de retour ne porte de champ `bloquant`, `refus` ou `interdit` ;
 * - aucun appelant ne doit en tirer une garde de génération, un refus
 *   d'émission ou un blocage de clôture.
 *
 * On **informe au bon endroit**, on ne ferme pas la porte. Une contresignature
 * exigible rendrait des dossiers ingénérables le jour où le formateur est
 * indisponible — et le dossier perdu coûte plus cher que le dossier incomplet.
 *
 * ## ⚠️ Et l'honnêteté du libellé n'est pas de la cosmétique
 *
 * Ce qui conditionne un règlement OPCO **n'est pas réglementaire : c'est
 * contractuel**. Chaque financeur publie sa propre liste de pièces, et ces
 * listes diffèrent. En pratique la plupart réclament une feuille signée par le
 * stagiaire ET par le formateur — mais « en pratique » n'est pas « la loi
 * l'exige ».
 *
 * Écrire « obligatoire » aurait un coût réel : le jour d'un refus, l'organisme
 * irait chercher un texte qui n'existe pas au lieu d'ouvrir sa convention de
 * financement. Le module dit donc, partout : **contractuel, variable, à
 * confirmer auprès du financeur**. `contresignature-attendue.spec.ts` cherche
 * les mots interdits et rougit s'ils reviennent.
 *
 * (La jurisprudence `CAA Nantes 20/04/2021`, citée par
 * `contresignature-service.ts`, porte sur la valeur PROBANTE d'une feuille
 * devant un juge — pas sur une liste de pièces de financeur. Deux sujets
 * voisins, deux interlocuteurs différents : ne pas les mélanger ici.)
 *
 * ## 🔴 « 0/0 conforme » ne se refait pas
 *
 * `dossier-session.ts` a payé ce défaut le 2026-08-20 (incident `D3-3-01`) :
 * un ratio complet sur un dénominateur nul se lit « tout va bien », et le
 * témoin était même MEILLEUR quand la situation était pire. Le cas « aucune
 * demi-journée à contresigner » est donc un cas **nommé** — `rien_a_contresigner`
 * —, jamais un compte à zéro.
 *
 * ## 🔑 Ce module ne COMPTE rien
 *
 * La mesure « quelles demi-journées attendent une contresignature » existe déjà
 * et n'a qu'une source : `bilanContresignature` (`contresignatures-manquantes.ts`),
 * dont l'en-tête prévient — « une seule mesure, trois surfaces ; recompter
 * ailleurs fabriquerait trois vérités ». Ce module en est la **quatrième
 * lecture**, pas le quatrième calcul : il reçoit le bilan et n'ajoute que la
 * dimension que personne ne portait, **le financeur**.
 *
 * Aucun import Prisma, aucun import Next, aucun import de valeur : importable
 * par un test, une page serveur ou un worker sans effet de bord.
 */

import type { DemiJourneeAContresigner } from "./contresignatures-manquantes";

/** Reprend l'enum Prisma `FinancementType`, valeur pour valeur. */
export type FinancementSession = "direct" | "opco" | "cpf" | "france_travail" | "mixte";

/**
 * La liste que ce module prétend traiter.
 *
 * Exportée pour que le test puisse la confronter à l'enum : ajouter une valeur
 * de financement sans passer ici rougit, au lieu de tomber silencieusement dans
 * un `default` qui se tait.
 */
export const FINANCEMENTS: readonly FinancementSession[] = [
  "direct",
  "opco",
  "cpf",
  "france_travail",
  "mixte",
] as const;

/**
 * Comment on nomme le payeur à l'écran. Jamais l'identifiant machine : « OPCO »
 * se lit, « france_travail » se devine.
 */
const FINANCEUR_LIBELLE: Record<Exclude<FinancementSession, "direct">, string> = {
  opco: "votre OPCO",
  cpf: "la Caisse des Dépôts (CPF)",
  france_travail: "France Travail",
  // « mixte » = plusieurs circuits sur la même session. On ne devine pas
  // lequel : on les nomme au pluriel, et la phrase reste vraie.
  mixte: "vos financeurs (dont l'OPCO)",
};

/** Ce que le financeur attend, et pourquoi — ou l'absence d'attente. */
export interface AttenteFinanceur {
  /** Vrai si un tiers paie, donc si une liste de pièces contractuelle existe. */
  readonly attendue: boolean;
  /** Nom du payeur tel qu'affiché. `null` en direct ou sans financement connu. */
  readonly financeur: string | null;
  /**
   * La phrase honnête, réutilisable telle quelle à l'écran comme au dossier.
   * Contractuelle, variable, à confirmer — jamais « obligatoire ».
   */
  readonly pourquoi: string;
}

/** Plusieurs circuits distincts sur la même feuille : on ne devine pas lequel réclamera. */
const PLUSIEURS_FINANCEURS = "vos financeurs";

/**
 * Le financement AU DOSSIER — au niveau de la session ET de chaque inscription.
 *
 * 🔴 **Le payeur de la session n'est pas toujours le payeur effectif.** Sur une
 * session inter-entreprises, la facturation se fait PAR PARTICIPANT, selon le
 * financement de chacun (`facture-auto-regles.ts`) : `Enrollment.financementType`
 * porte l'override (R-INTER), il est écrit par `setEnrollmentFinancementAction`
 * et piloté depuis la fiche session.
 *
 * Ce module ne fabrique donc PAS une seconde façon de répondre à « qui paie ? » :
 * il applique la même résolution que `production-au-jalon.ts:376`, à savoir
 * `enrollment.financementType ?? session.financementType`, inscription par
 * inscription.
 *
 * ⚠️ La faute que ça ferme était pire qu'un silence. Une session
 * inter-entreprises se crée par défaut en `direct` (`sessions.ts:402`) ; si un
 * seul participant relève d'un OPCO, ne lire que la session faisait écrire au
 * dossier d'audit « aucun financeur tiers ne réclame de pièce » — une
 * **affirmation d'absence**, fausse, dans la pièce même que l'organisme dépose
 * chez le financeur.
 */
export interface FinancementsAuDossier {
  /** Financement porté par la session. */
  readonly session: FinancementSession | null | undefined;
  /**
   * Un élément par inscription active, dans l'ordre. `null`/`undefined` = pas
   * d'override, l'inscription relève du financement de la session.
   *
   * Vide ou absent (aucune inscription, ou appelant qui ne les charge pas) : on
   * retombe sur le seul financement de la session.
   */
  readonly parInscription?: ReadonlyArray<FinancementSession | null | undefined>;
}

/**
 * Qui paie RÉELLEMENT, sans doublon — la résolution par inscription, ou à
 * défaut le financement de la session.
 *
 * 🔑 Quand des inscriptions existent, le financement de la session **ne compte
 * pas pour lui-même** : il ne vaut que comme valeur de repli de celles qui
 * n'ont pas d'override. Si les trois inscrits d'une session `direct` relèvent
 * tous d'un OPCO, personne ne paie en direct — et le résultat le dit.
 */
export function financeursEffectifs(f: FinancementsAuDossier): readonly FinancementSession[] {
  const inscriptions = f.parInscription ?? [];
  const resolus = inscriptions.length > 0 ? inscriptions.map((i) => i ?? f.session) : [f.session];
  const connus = resolus.filter((v): v is FinancementSession => v !== null && v !== undefined);
  // `Set` conserve l'ordre d'insertion : la phrase reste stable d'un rendu à
  // l'autre, donc les tests aussi.
  return [...new Set(connus)];
}

/**
 * La contresignature du formateur est-elle attendue par un financeur ?
 *
 * ⚠️ Aucun financement connu rend `attendue: false`. Ce n'est pas un oubli : le
 * bandeau affirme « votre financeur réclamera ». Sans financement au dossier, la
 * prémisse n'est pas établie, et affirmer au hasard sur toutes les sessions du
 * registre transformerait l'information en bruit — c'est-à-dire en rien. Le
 * silence ici n'ôte aucune garde : il n'y en a aucune.
 */
export function attenteContresignature(f: FinancementsAuDossier): AttenteFinanceur {
  const effectifs = financeursEffectifs(f);

  if (effectifs.length === 0) {
    return {
      attendue: false,
      financeur: null,
      pourquoi:
        "Financement non renseigné : on ne sait pas encore quelles pièces seront réclamées.",
    };
  }

  const tiers = effectifs.filter((v): v is Exclude<FinancementSession, "direct"> => v !== "direct");

  if (tiers.length === 0) {
    return {
      attendue: false,
      financeur: null,
      pourquoi:
        "Session payée directement par le client : aucun financeur tiers ne réclame de pièce. " +
        "La contresignature du formateur reste utile à la valeur probante de la feuille, mais " +
        "elle ne conditionne ici aucun règlement.",
    };
  }

  const financeur = tiers.length === 1 ? FINANCEUR_LIBELLE[tiers[0]!] : PLUSIEURS_FINANCEURS;

  // Une partie seulement des inscrits relève d'un tiers : la feuille est UNE,
  // le dossier du financeur ne l'est pas. Le taire ferait lire « toute la
  // session est financée », ce qui est faux dans l'autre sens.
  const partiel = effectifs.includes("direct");
  const assiette = partiel
    ? `Une PARTIE des inscrits de cette session est financée par un tiers (${financeur}), le reste en direct. ` +
      `La feuille d'émargement est la même pour tous : c'est le dossier du financeur qui la réclamera.`
    : `Cette session est financée par un tiers (${financeur}).`;

  return {
    attendue: true,
    financeur,
    pourquoi:
      `${assiette} La plupart des financeurs réclament ` +
      `une feuille d'émargement signée par le stagiaire ET par le formateur pour régler le dossier. ` +
      `⚠️ La liste des pièces est contractuelle et varie d'un financeur à l'autre : elle n'est pas ` +
      `imposée par un texte — à confirmer auprès de ${financeur} avant le dépôt. ` +
      `Son absence ne bloque rien dans l'outil : ni l'attestation, ni la clôture de la session.`,
  };
}

/** Ce que l'appelant fournit : la règle (financement) et la mesure (le bilan). */
export interface EntreeConstat {
  /**
   * Le financement AU DOSSIER — session **et** overrides par inscription.
   * Pas un scalaire : une session `direct` dont un inscrit relève d'un OPCO
   * attend bel et bien la contresignature (R-INTER).
   */
  readonly financement: FinancementsAuDossier;
  /**
   * `BilanContresignature.signees` — demi-journées TERMINÉES portant au moins
   * une signature de stagiaire. C'est le dénominateur, et il peut valoir zéro :
   * le cas est nommé, jamais divisé.
   */
  readonly signees: number;
  /**
   * `BilanContresignature.aContresigner` — la LISTE, pas un compte. Un bandeau
   * qui annonce « 2 manquantes » sans dire lesquelles oblige à rouvrir la
   * feuille pour savoir où cliquer.
   */
  readonly aContresigner: ReadonlyArray<DemiJourneeAContresigner>;
}

/**
 * Le constat rendu à l'écran.
 *
 * ⛔ Aucun champ `bloquant` / `refus` / `interdit` : c'est délibéré, et c'est
 * testé. Le seul verbe de ce type est « afficher ».
 */
export type ConstatContresignature =
  | {
      readonly afficher: false;
      readonly raison:
        "non_attendue_par_le_financeur" | "financement_non_renseigne" | "tout_contresigne";
    }
  | {
      readonly afficher: true;
      /**
       * `rien_a_contresigner` — aucune demi-journée signée n'est encore
       * terminée. Cas NOMMÉ, jamais rendu par un « 0/0 » (incident `D3-3-01`).
       */
      readonly cas: "rien_a_contresigner" | "contresignatures_manquantes";
      readonly financeur: string;
      readonly titre: string;
      readonly message: string;
      /** La phrase honnête d'`attenteContresignature`, pour l'aide et le détail. */
      readonly pourquoi: string;
      /** Demi-journées concernées (terminées et signées par un stagiaire). */
      readonly nbConcernees: number;
      readonly nbContresignees: number;
      readonly manquantes: ReadonlyArray<DemiJourneeAContresigner>;
    };

/** `2026-09-01` → `01/09/2026`, sans passer par `Date` (pas de décalage de fuseau). */
function jourFR(dateISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (m === null) return dateISO;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const LIBELLE_DEMI: Record<string, string> = { matin: "matin", apres_midi: "après-midi" };

/** « 01/09/2026 après-midi ». Une valeur inconnue est CITÉE, pas maquillée. */
export function libelleCourtDemiJournee(d: DemiJourneeAContresigner): string {
  return `${jourFR(d.date)} ${LIBELLE_DEMI[d.demiJournee] ?? `« ${d.demiJournee} »`}`;
}

/** Au-delà, on cite et on annonce le reste : ni un pavé, ni un silence. */
const DETAIL_MAX = 4;

/**
 * Ce que l'écran doit dire — ou son silence, motivé.
 *
 * ⚠️ Ne lève jamais et ne rend jamais d'erreur : un constat qui casserait la
 * page d'émargement transformerait une information en panne.
 */
export function constaterContresignature(entree: EntreeConstat): ConstatContresignature {
  const attente = attenteContresignature(entree.financement);
  if (!attente.attendue || attente.financeur === null) {
    return {
      afficher: false,
      // « Non renseigné » et « payé en direct » sont deux silences différents :
      // le premier dit qu'on ne sait pas, le second qu'on sait que personne ne
      // réclamera. Les confondre ferait passer une ignorance pour une réponse.
      raison:
        financeursEffectifs(entree.financement).length === 0
          ? "financement_non_renseigne"
          : "non_attendue_par_le_financeur",
    };
  }

  const financeur = attente.financeur;

  if (entree.signees === 0) {
    // 🔴 Incident `D3-3-01` — surtout PAS « 0/0 contresignées ». Un ratio
    // complet sur un dénominateur nul se lit « tout va bien », et c'est
    // exactement l'inverse : il n'y a rien à contresigner PARCE QUE rien n'est
    // encore signé ni terminé.
    return {
      afficher: true,
      cas: "rien_a_contresigner",
      financeur,
      titre: `Rien à contresigner pour l'instant — ${financeur} en demandera`,
      message:
        `Aucune demi-journée terminée ne porte encore de signature de stagiaire : il n'y a donc ` +
        `rien à contresigner, et ce n'est pas le signe d'un dossier complet. Dès qu'une ` +
        `demi-journée sera signée et terminée, la demande partira au formateur et le manque ` +
        `s'affichera ici.`,
      pourquoi: attente.pourquoi,
      nbConcernees: 0,
      nbContresignees: 0,
      manquantes: [],
    };
  }

  if (entree.aContresigner.length === 0) {
    return { afficher: false, raison: "tout_contresigne" };
  }

  const n = entree.aContresigner.length;
  const faites = Math.max(entree.signees - n, 0);
  const detail = entree.aContresigner.slice(0, DETAIL_MAX).map(libelleCourtDemiJournee).join(", ");
  const reste = n > DETAIL_MAX ? ` (et ${n - DETAIL_MAX} autres)` : "";

  return {
    afficher: true,
    cas: "contresignatures_manquantes",
    financeur,
    titre:
      n > 1
        ? `${n} demi-journées attendent la contresignature du formateur — ${financeur} la réclamera probablement`
        : `Une demi-journée attend la contresignature du formateur — ${financeur} la réclamera probablement`,
    message:
      `${faites} contresignée${faites > 1 ? "s" : ""} sur ${entree.signees} demi-journée${entree.signees > 1 ? "s" : ""} signée${entree.signees > 1 ? "s" : ""}. ` +
      `Il manque : ${detail}${reste}. ` +
      `La demande part automatiquement au formateur le soir de chaque journée signée ; relancez-le ` +
      `si les rappels n'ont rien donné. Ce manque ne bloque ni l'attestation ni la clôture — il se ` +
      `paie au règlement.`,
    pourquoi: attente.pourquoi,
    nbConcernees: entree.signees,
    nbContresignees: faites,
    manquantes: entree.aContresigner,
  };
}
