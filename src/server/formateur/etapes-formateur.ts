/**
 * Espace formateur — QUELLES ÉTAPES DU PARCOURS LE CONCERNENT. Module PUR.
 *
 * ## Le défaut que ce module empêche
 *
 * `construireParcours` déroule les quatorze étapes d'un dossier de session. Elles
 * sont écrites pour la console : elles nomment des boutons de la console, et
 * douze d'entre elles sont gardées par `requireAdminWrite`. Les déverser telles
 * quelles sur l'accueil du formateur produirait une **liste de reproches sur des
 * gestes qu'il ne peut pas poser** — « convention non signée », « attestation non
 * émise », « suivi à froid non recueilli ». Aucun de ces gestes ne lui est
 * ouvert. Un écran qui réclame l'impossible n'est pas incomplet : il est pire que
 * vide, parce qu'on cesse de le lire.
 *
 * ## Le critère, en deux clauses — et rien d'autre
 *
 * Une étape entre dans l'accueil du formateur si, et seulement si :
 *
 * 1. **le formateur pose le geste lui-même** — en salle ou depuis son espace ;
 * 2. **ou l'étape est le préalable BLOQUANT d'un geste de la clause 1** — il ne
 *    la pose pas, mais il est le seul à en subir la conséquence, et le seul à
 *    pouvoir alerter pendant qu'il est encore temps.
 *
 * La clause 2 n'existe que pour `creneaux_emargement`, et elle est motivée ligne
 * à ligne plus bas. Elle n'est PAS une porte dérobée pour « c'est intéressant
 * quand même » : « intéressant » n'est pas un geste.
 *
 * ## Pourquoi un `Record<EtapeCle, boolean>` et pas un tableau
 *
 * 🔴 Un `Set` ou un tableau de clés incluses laisse une étape NOUVELLE tomber
 * silencieusement du bon côté (exclue par défaut) sans que personne n'ait
 * tranché. Le `Record` exhaustif fait ROUGIR le compilateur le jour où une
 * quinzième clé est ajoutée à `EtapeCle` : celui qui l'ajoute doit décider, et
 * écrire pourquoi. C'est le même patron que `borne: Date | { sansBorne }` du
 * parcours — l'absence de décision se DÉCLARE, elle ne se déduit pas.
 *
 * ## Zéro requête, zéro horloge implicite
 *
 * Ce module ne connaît ni Prisma ni `new Date()` : il reçoit des faits et une
 * date. C'est ce qui le rend testable sans base — et le contrat stub du dépôt
 * (ADR 0026) l'exige de toute façon.
 */

import type { EtapeCle } from "@/server/qualiopi/parcours/session-parcours";

/**
 * La table de décision. UNE ligne par clé d'étape, UNE raison par ligne.
 *
 * ⚠️ Ne jamais passer une ligne à `true` « pour que le formateur soit au
 * courant ». Être au courant n'est pas un geste. Si l'espace formateur gagne un
 * jour l'écran qui manque (la saisie d'évaluation, par exemple), la bascule se
 * fait ICI et le commentaire dit déjà à quelle condition.
 */
export const ETAPES_DU_FORMATEUR: Readonly<Record<EtapeCle, boolean>> = {
  /**
   * NON — c'est l'organisme qui affecte un formateur (ind. 17). Et la ligne
   * serait absurde par construction : si le formateur voit cette session, c'est
   * qu'il y est affecté. On lui réclamerait ce qui est déjà fait.
   */
  formateur_assigne: false,

  /**
   * NON — générer la convention est un acte administratif de l'organisme
   * (bloc Documents de la console). Le formateur n'a ni l'écran ni le droit.
   */
  convention_generee: false,

  /**
   * NON — le client signe par son lien, l'organisme CONTRESIGNE en dernier.
   * Deux parties, aucune n'est lui. Lui montrer une convention non signée
   * l'inquiéterait sur un circuit dont il ne tient aucun bout.
   */
  convention_signee: false,

  /**
   * NON — l'envoi part du bloc Inscriptions de la console (ind. 8). Le
   * formateur exploite le positionnement, il ne l'expédie pas.
   */
  positionnement_envoye: false,

  /**
   * NON — le stagiaire répond ; la seule action possible est la RELANCE, et
   * elle part de la console. Le formateur ne peut ni répondre à sa place ni
   * relancer.
   */
  positionnement_repondu: false,

  /**
   * NON — la convocation est automatique (planificateur J-5) puis rattrapée par
   * la console (ind. 9). De surcroît l'étape peut valoir `indetermine`, un état
   * qui demande une vérification des envois côté organisme : réclamer au
   * formateur de lever un doute sur `EmailLog` n'aurait aucun sens.
   */
  convocation_envoyee: false,

  /**
   * OUI — clause 2, et la SEULE de tout le tableau.
   *
   * `generateSessionCreneauxAction` est `requireAdminWrite` : le formateur ne
   * confirme pas les journées. Mais sans elles **aucune signature n'est
   * possible**, ni par lien ni en mode groupe. Il découvre donc le blocage
   * debout devant la salle, au moment où plus personne ne peut le lever.
   *
   * On l'affiche avec un geste RÉÉCRIT (`GESTE_FORMATEUR`) : « signalez-le à
   * l'organisme », pas « cliquez sur le bouton que vous n'avez pas ». C'est une
   * information qui lui rend une marge de manœuvre, pas un reproche.
   */
  creneaux_emargement: true,

  /**
   * NON — `emettreLiensSessionAction` est `requireAdminWrite`. Et le lui
   * réclamer serait doublement faux : son espace porte le **mode groupe**, qui
   * fait signer sans aucun lien. Cette étape ne borne donc même pas son geste.
   */
  liens_signature_emis: false,

  /**
   * OUI — clause 1, le cœur du sujet. Le formateur fait signer sur son propre
   * poste (`signerPourStagiaireAction`) puis contresigne chaque demi-journée
   * (`contresignerDemiJourneeAction`). C'est l'obligation la plus étroitement
   * sienne de tout le parcours, et la fenêtre se ferme 48 h après la fin.
   */
  emargement_signe: true,

  /**
   * NON — **et c'est le cas limite du tableau.** Évaluer les acquis est bien son
   * acte pédagogique (ind. 11), mais `createEvaluationAcquisAction` est
   * `requireAdminWrite` et AUCUN écran de l'espace formateur ne saisit une
   * évaluation. La ligne serait donc un reproche sans geste attaché.
   *
   * ⇒ À rebasculer à `true` le jour où l'espace formateur porte cette saisie.
   *    C'est la seule condition, et elle est écrite ici pour qu'on n'ait pas à
   *    la redécouvrir.
   */
  evaluation_finale: false,

  /**
   * NON — attester ENGAGE l'organisme ; c'est un acte habilité, jamais
   * automatique et jamais délégué au formateur.
   */
  attestation: false,

  /**
   * NON — l'accès est ouvert automatiquement à la convocation, et régénéré
   * depuis la console en secours. Il est de surcroît GLOBAL au stagiaire, donc
   * hors du périmètre d'une session que le formateur anime.
   */
  acces_portail: false,

  /**
   * NON — recueil automatique J+1, relances J+3 et J+10, puis reprise
   * téléphonique par l'organisme (ind. 30). Aucun de ces gestes n'est le sien.
   */
  satisfaction_chaud: false,

  /**
   * NON — recueil automatique J+30. C'est l'obligation la plus oubliée du
   * parcours, mais elle est oubliée PAR L'ORGANISME : à J+30 le formateur est
   * sur une autre mission depuis un mois.
   */
  satisfaction_froid: false,
};

/** L'étape appelle-t-elle un geste du formateur ? */
export function concerneLeFormateur(cle: EtapeCle): boolean {
  return ETAPES_DU_FORMATEUR[cle];
}

/**
 * Le geste, RÉÉCRIT pour le formateur.
 *
 * 🔴 Les `geste` du parcours nomment des boutons de la console (« onglet
 * Émargement, "Confirmer les journées" »). Rendus tels quels dans l'espace
 * formateur, ils enverraient chercher une commande introuvable — et un écran qui
 * décrit une porte qui n'existe pas est cru sur parole jusqu'à ce qu'on la
 * cherche. On ne réécrit QUE les étapes retenues : les autres ne sont jamais
 * rendues.
 */
export const GESTE_FORMATEUR: Readonly<Partial<Record<EtapeCle, string>>> = {
  creneaux_emargement:
    "Les journées n'ont pas été confirmées par l'organisme — sans elles, personne ne pourra émarger. Signalez-le avant la séance.",
  emargement_signe:
    "Ouvrez la formation, faites signer en mode groupe, puis contresignez chaque demi-journée.",
};

/**
 * Filtre une liste d'échéances sur les étapes qui concernent le formateur.
 *
 * Générique sur la forme minimale `{ etape: { cle } }` : le module reste pur et
 * n'importe rien de `echeances-service`, qui tire Prisma.
 */
export function filtrerEtapesFormateur<T extends { readonly etape: { readonly cle: EtapeCle } }>(
  echeances: ReadonlyArray<T>,
): T[] {
  return echeances.filter((e) => concerneLeFormateur(e.etape.cle));
}

const MS_JOUR = 24 * 60 * 60 * 1000;

/**
 * Fenêtre arrière — alignée sur `echeances-service` (45 j).
 *
 * Elle vaut ici pour une raison DIFFÉRENTE : le formateur n'a plus rien à
 * rattraper sur une session close depuis deux mois, mais ses étapes resteraient
 * `hors_delai` pour l'éternité et lui feraient un accueil définitivement rouge.
 */
const FENETRE_ARRIERE_JOURS = 45;

/** La forme minimale attendue d'une session du formateur. */
export interface SessionPourEcheances {
  readonly id: string;
  readonly statut: string;
  readonly dateFin: Date;
}

/**
 * 🔴 LE PÉRIMÈTRE, et la raison d'être de cette fonction.
 *
 * `prochainesEcheances({ sessionIds })` **n'applique AUCUN filtre de statut ni
 * de date** quand on lui passe des identifiants : son `where` devient
 * `{ id: { in: cible } }`, point. Le filtre « planifiée / en cours / réalisée
 * récente » n'existe que dans la branche NON ciblée.
 *
 * Or `listMyTrainingSessions` rend **toutes** les sessions du formateur, depuis
 * toujours. Lui passer la liste brute construirait le parcours de sessions
 * vieilles de deux ans — pour un coût inutile, et surtout pour un écran qui ne
 * redescendrait jamais à zéro.
 *
 * On reproduit donc ici, explicitement, la borne que le service applique tout
 * seul dans son autre branche. Les sessions annulées ou reportées sont écartées
 * d'emblée : leur parcours est REPLIÉ (zéro étape), les charger ne rendrait rien.
 */
export function sessionsDansLePerimetre(
  sessions: ReadonlyArray<SessionPourEcheances>,
  maintenant: Date,
): string[] {
  const bornePassee = new Date(maintenant.getTime() - FENETRE_ARRIERE_JOURS * MS_JOUR);
  return sessions
    .filter(
      (s) =>
        s.statut === "planifiee" ||
        s.statut === "en_cours" ||
        (s.statut === "realisee" && s.dateFin.getTime() >= bornePassee.getTime()),
    )
    .map((s) => s.id);
}
