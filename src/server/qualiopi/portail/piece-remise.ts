/**
 * Lot 1ter — **PRODUIRE ≠ REMETTRE**. À quel moment une pièce est-elle remise
 * au bénéficiaire ? Module PUR.
 *
 * ## La doctrine, et pourquoi elle a fallu l'écrire
 *
 * Question de Will le 16/08 : *« le plan doit prévoir que ce soit scalable et au
 * maximum automatisé, non ? »*. La réponse n'est pas « générer plus tard ».
 *
 * **La frontière n'est pas manuel / automatique. Elle est PRODUIRE / REMETTRE.**
 *
 * | | Engage l'organisme ? | Régime |
 * |---|---|---|
 * | **Produire** un brouillon | non | **automatique**, et il le FAUT à l'échelle |
 * | **Remettre**, envoyer, signer, attester | oui | gardé, humain, ou lié à un jalon |
 *
 * Ce sont **deux instants distincts**, et le défaut du 16/08 vient de les avoir
 * confondus : le système supposait que produire une pièce, c'était la montrer.
 *
 * ## Pourquoi ce module existe AVANT la génération automatique
 *
 * 🔴 Le plan est explicite : la règle de moment *« doit être étendue aux pièces
 * dans le même commit que la génération automatique, sinon ce lot recrée le
 * défaut qu'un autre vient de fermer »*.
 *
 * Aujourd'hui, presque toutes les pièces sont produites d'un clic : l'espace
 * stagiaire est juste **par accident**, parce que rien n'existe avant qu'on ne
 * le décide. Le jour où six pièces standard naissent à la création de la
 * session, elles s'y afficheront **toutes** — et le stagiaire verra sa feuille
 * d'émargement trois semaines avant la séance.
 *
 * C'est exactement le défaut constaté le 16/08 sur les questionnaires (« votre
 * retour à chaud, pendant que la formation est encore fraîche », proposé la
 * veille d'une formation qui n'avait pas commencé), transposé aux documents.
 * `questionnaire-moment.ts` l'a fermé pour les questionnaires ; ce module le
 * ferme pour les pièces, **et il le ferme d'abord**.
 *
 * ## Dérivé, jamais stocké
 *
 * Aucune colonne « remise le ». Un état stocké dérive de la réalité — une
 * session reportée, une date corrigée, et la colonne ment sans que rien ne le
 * dise. Une règle dérivée est juste par construction.
 *
 * ⚠️ Ce module décide de la VISIBILITÉ CÔTÉ BÉNÉFICIAIRE. **L'organisme voit
 * toujours tout** depuis la console : masquer à l'admin ce qu'il vient de
 * produire serait absurde, et l'auditeur doit pouvoir tout consulter.
 */

/** Ce dont la décision a besoin — minimal et sérialisable. */
export interface MomentPiece {
  /** Valeur de l'enum `DocumentType`. */
  readonly type: string;
  readonly sessionDateDebut: Date | null;
  readonly sessionDateFin: Date | null;
  /** `planifiee` · `en_cours` · `realisee` · `annulee` · `reportee`. */
  readonly sessionStatut: string | null;
}

/**
 * Jalon auquel une pièce devient visible du bénéficiaire.
 *
 * `jamais` n'est pas un oubli : ce sont les pièces de la relation organisme ↔
 * financeur, qui ne concernent pas le bénéficiaire et dont l'affichage
 * exposerait des montants et des conditions qui ne le regardent pas.
 */
export type JalonRemise =
  /** Dès que la pièce existe — elle PRÉPARE la formation. */
  | "immediat"
  /** À partir du premier jour de la séance. */
  | "jour_j"
  /** Une fois la formation réalisée. */
  | "apres_realisation"
  /** Jamais côté bénéficiaire — pièce organisme ↔ financeur. */
  | "jamais";

/**
 * Le jalon de chaque type de pièce. Table du plan, §1ter.
 *
 * 🔴 Le défaut par défaut est **`jamais`**, pas `immediat`. Un type de pièce
 * inconnu de cette table — parce qu'on vient de l'ajouter à l'enum et qu'on a
 * oublié de l'y inscrire — ne doit pas se retrouver sur l'espace du stagiaire
 * par accident. Ne rien montrer se corrige ; montrer ce qu'il ne fallait pas ne
 * se rattrape pas. Un test d'exhaustivité rougit sur tout type non déclaré.
 */
const JALONS: Readonly<Record<string, JalonRemise>> = {
  // ── Elles PRÉPARENT : les cacher jusqu'au jour J priverait le stagiaire de
  //    ce qui lui permet d'arriver informé (ind. 9, obligation d'information).
  programme: "immediat",
  reglement_interieur: "immediat",
  livret_accueil: "immediat",
  positionnement: "immediat",

  // ── Pièces contractuelles : le circuit de signature les met déjà en
  //    circulation par son propre lien. Les afficher dès leur production
  //    n'anticipe donc rien — et le bénéficiaire d'un contrat doit pouvoir
  //    relire ce qu'il signe.
  convention: "immediat",
  convention_tripartite: "immediat",
  contrat: "immediat",
  protocole_afest: "immediat",

  // ── La convocation prépare aussi. Son ENVOI reste un jalon distinct (J-5,
  //    puis rattrapage) : la voir dans son espace ne remplace pas le fait de
  //    la recevoir, et ne la déclenche pas non plus.
  convocation: "immediat",

  // ── « Le programme dit CE QUI est enseigné ; cette pièce dit QUAND, OÙ et
  //    COMMENT » (schéma Prisma). Elle sert l'indicateur 9 — l'obligation
  //    d'INFORMATION du bénéficiaire. La retenir irait contre sa raison d'être.
  organisation_action: "immediat",

  // ── 🔴 Le consentement doit être LIBRE, et le schéma le dit : pièce séparée
  //    à dessein, « un consentement enfoui dans la convention ne serait pas
  //    libre ». Il vaut « pour les stagiaires comme pour les intervenants » —
  //    donc le stagiaire doit pouvoir la lire et la signer. La masquer
  //    reviendrait à recueillir un consentement qu'on ne lui a pas montré.
  autorisation_captation: "immediat",

  // ── Le jour J, pas avant. Une feuille d'émargement visible trois semaines
  //    à l'avance n'a aucun usage et suggère un geste qu'on ne peut pas poser.
  emargement: "jour_j",

  // ── Après la séance seulement.
  releve_connexion: "apres_realisation",
  grille_evaluation: "apres_realisation",
  satisfaction: "apres_realisation",
  attestation: "apres_realisation",
  attestation_partielle: "apres_realisation",
  certificat_realisation: "apres_realisation",

  // ── 🔴 JAMAIS côté bénéficiaire — relation organisme ↔ financeur ou
  //    organisme ↔ intervenant. Elles portent des montants, des barèmes et des
  //    conditions qui ne concernent pas la personne formée.
  facture: "jamais",
  avoir: "jamais",
  devis: "jamais",
  kit_opco: "jamais",
  kit_cpf: "jamais",
  kit_france_travail: "jamais",
  lettre_mission: "jamais",
  contrat_sous_traitance: "jamais",
  inventaire_moyens: "jamais",
  procedure_sous_traitance: "jamais",

  // ── Pièces de PREUVE de l'organisme (déclaration d'activité, ind. 21). Elles
  //    portent les données personnelles d'un TIERS — le formateur. Les afficher
  //    au stagiaire diffuserait un parcours professionnel à quelqu'un qui n'a
  //    aucune raison d'y accéder. Le nom du formateur, lui, figure déjà sur la
  //    convocation et le livret d'accueil : c'est ce que le stagiaire doit
  //    savoir, et il l'a.
  cv_formateur: "jamais",
  liste_formateurs: "jamais",
};

/** Le jalon d'un type. `jamais` pour un type non déclaré — voir `JALONS`. */
export function jalonPour(type: string): JalonRemise {
  return Object.prototype.hasOwnProperty.call(JALONS, type) ? JALONS[type]! : "jamais";
}

/** Les types explicitement déclarés — pour le test d'exhaustivité. */
export const TYPES_AVEC_JALON: ReadonlyArray<string> = Object.keys(JALONS);

/** Statuts pour lesquels plus aucune pièce n'a d'objet côté bénéficiaire. */
const STATUTS_SANS_OBJET = new Set(["annulee", "reportee"]);

/**
 * Cette pièce est-elle remise au bénéficiaire MAINTENANT ?
 *
 * ⚠️ **Sans date de session, on REMET** (sauf `jamais`). Même choix que
 * `questionnaire-moment.ts`, et pour la même raison : un défaut de donnée ne
 * doit pas faire disparaître une pièce attendue. Masquer « faute de savoir »
 * transformerait un trou de données en document jamais remis — et personne ne
 * s'en apercevrait, puisque rien ne s'afficherait.
 *
 * 🔴 L'exception est `jamais`, qui ne dépend d'aucune date : une facture reste
 * invisible du bénéficiaire, session datée ou non.
 */
export function pieceEstRemise(p: MomentPiece, maintenant: Date): boolean {
  const jalon = jalonPour(p.type);
  if (jalon === "jamais") return false;

  // Session annulée ou reportée : le dossier ne demande plus rien au
  // bénéficiaire. La pièce reste au registre, côté organisme.
  if (p.sessionStatut !== null && STATUTS_SANS_OBJET.has(p.sessionStatut)) return false;

  if (jalon === "immediat") return true;

  const debut = p.sessionDateDebut;
  const fin = p.sessionDateFin ?? debut;

  if (jalon === "jour_j") {
    if (debut === null) return true;
    return maintenant.getTime() >= debut.getTime();
  }

  // apres_realisation
  if (fin === null) return true;
  // Le STATUT prime sur la date : une session close en avance est réalisée,
  // et le stagiaire doit pouvoir récupérer ses pièces sans attendre l'horloge.
  if (p.sessionStatut === "realisee") return true;
  return maintenant.getTime() >= fin.getTime();
}

/**
 * Les types qui peuvent, un jour, être remis au bénéficiaire.
 *
 * 🔴 Sert de BORNE SUPÉRIEURE aux requêtes de l'espace stagiaire. Le portail
 * porte sa propre liste de types — c'est légitime (il évite de doubler les
 * attestations, qui ont déjà leur bloc) — mais cette liste ne doit jamais
 * pouvoir déborder de celle-ci. Un test le vérifie : la vue peut être plus
 * ÉTROITE que l'autorité, jamais plus large.
 *
 * Sans cette borne, deux listes de « ce que le stagiaire voit » coexisteraient
 * et divergeraient — le jour où l'une gagne un type de pièce interne, il
 * s'afficherait sans que la seconde ne dise rien.
 */
export const TYPES_REMIS_AU_BENEFICIAIRE: ReadonlyArray<string> = Object.entries(JALONS)
  .filter(([, jalon]) => jalon !== "jamais")
  .map(([type]) => type);
