/**
 * Qualiopi — Catalogue des alertes système (module PUR).
 *
 * Source de vérité : SPEC_PART2 §6.5. Aucun import Prisma ni Next.js —
 * importable par seeds, tests et workers sans effet de bord.
 *
 * `resolutionAuto: true` → synchroniserAlertes() résoudra automatiquement
 * l'alerte si la condition disparaît.
 */

import type { AlerteNiveau } from "../../../../prisma/generated/client";
import type { GuichetAlerte } from "./routage";

/**
 * Lot 14 §14.3 — la désescalade, et son motif quand elle n'a pas lieu.
 *
 * 🔴 Une alerte qui ne se referme pas quand sa cause disparaît transforme la
 * liste en HISTORIQUE : elle cesse de décrire l'état. C'est un choix parfois
 * légitime (un fait accompli s'acquitte, il ne s'efface pas) et parfois un
 * simple oubli — et au 16/08/2026, **rien ne permettait de distinguer les
 * deux** : six codes portaient `resolutionAuto: false` sans une ligne
 * d'explication, exactement comme les trois codes dont l'oubli avait laissé
 * des alertes ouvertes pour toujours (corrigé le 2026-08-05).
 *
 * D'où l'union : `false` EXIGE un motif, à la compilation. On ne peut plus
 * oublier en silence — on peut seulement décider, et l'écrire.
 */
type ResolutionAuto =
  | { readonly resolutionAuto: true }
  | {
      readonly resolutionAuto: false;
      /** Pourquoi cette alerte ne doit PAS se refermer toute seule. */
      readonly motifSansResolutionAuto: string;
    };

export type AlerteCatalogueEntry = {
  readonly niveau: AlerteNiveau;
  readonly titre: string;
  /**
   * Lot 14 — à QUI cette alerte s'adresse, par la nature de l'acte qu'elle
   * réclame. Voir `routage.ts` pour la définition des guichets.
   *
   * 🔴 Champ OBLIGATOIRE, et c'est tout l'intérêt : ajouter un code d'alerte
   * sans dire qui doit agir ne compile pas. Une table de routage séparée aurait
   * laissé le code oublié partir « au canal par défaut » — c'est-à-dire au
   * canal global unique qu'on vient précisément de supprimer.
   *
   * ⚠️ Le guichet est ORTHOGONAL au niveau. `niveau` dit s'il faut sursauter,
   * `guichet` dit qui a la main. Une alerte critique peut relever du
   * secrétariat, une alerte `info` de la direction.
   */
  readonly guichet: GuichetAlerte;
} & ResolutionAuto;

/**
 * Catalogue complet des ~28 codes d'alertes (SPEC_PART2 §6.5).
 *
 * Règle de nommage : snake_case, cohérent avec le schéma DB (code VarChar(80)).
 */
export const ALERTE_CATALOGUE: Record<string, AlerteCatalogueEntry> = {
  // ── Handicap ──────────────────────────────────────────────────────────────
  referent_handicap_absent: {
    niveau: "critique",
    titre: "Référent handicap absent",
    resolutionAuto: true,
    guichet: "qualite",
  },
  /**
   * La mention légale de la marque Qualiopi est servie par un REPLI.
   *
   * 🔴 2026-08-20. « La certification qualité a été délivrée au titre de la ou
   * des catégories d'actions suivantes : … » est une mention obligatoire. Sa
   * valeur venait d'un défaut codé en dur : le site affirmait une catégorie que
   * personne n'avait lue sur le certificat, et aucun `curl` ne distinguait ce
   * cas d'une valeur réellement configurée.
   *
   * `resolutionAuto` : la règle se relit à chaque passe et disparaît d'elle-même
   * dès que la catégorie est saisie — il n'y a rien à cliquer.
   */
  categories_certifiees_non_renseignees: {
    niveau: "important",
    titre: "Catégorie d'actions certifiées non renseignée",
    resolutionAuto: true,
    guichet: "qualite",
  },
  /**
   * Le catalogue soutient deux thèses opposées sur « sommes-nous certifiants ? ».
   *
   * 🔴 2026-08-23, constaté À L'ÉCRAN sur `/qualiopi/mode-auditeur` : la matrice
   * présentait « 1 formation certifiante avec code RS/RNCP renseigné » comme
   * preuve de l'indicateur 1, tout en déclarant 3, 7 ⭐ et 16 ⭐ « non
   * applicables ». Un auditeur voit cette contradiction sans ouvrir un dossier,
   * et c'est le genre de détail qui déclenche l'approfondissement.
   *
   * La cause est structurelle : l'applicabilité se lit sur
   * `Formation.typesActionQualiopi` — colonne qu'AUCUN écran n'expose — pendant
   * que la preuve se lit sur `certificationType` + `codeRncp`/`codeRs`, qui sont
   * saisissables. Les deux ne peuvent pas se contredire par accident : elles se
   * contredisent parce qu'une seule des deux a une porte d'entrée.
   *
   * `resolutionAuto` : la contradiction disparaît d'elle-même dès que l'une des
   * deux colonnes est alignée sur l'autre — il n'y a rien à cliquer ici.
   */
  catalogue_certifiant_incoherent: {
    niveau: "important",
    titre: "Le catalogue se contredit sur les actions certifiantes",
    resolutionAuto: true,
    guichet: "qualite",
  },
  /**
   * Session clôturée « réalisée » alors que des inscrits n'ont aucune trace.
   *
   * 🔴 `CONF-01` (2026-08-20). La garde de clôture ne refusait que si PAS UNE
   * SEULE inscription ne portait de trace de présence : une sur douze suffisait
   * donc à faire passer la session en « réalisée ». Les onze autres pouvaient
   * se voir délivrer une attestation sans qu'aucune preuve n'existe à leur nom,
   * et rien ne le disait.
   *
   * On n'a PAS durci le refus : le durcissement a déjà été tenté puis retiré
   * dans ce dépôt, il rendait des sessions définitivement non clôturables
   * (cf. `presence/trace-cloture.ts`). Le trou réel n'était pas l'absence de
   * blocage, c'était le SILENCE.
   *
   * ⚠️ `resolutionAuto: false` — l'alerte naît d'un ÉVÉNEMENT (la clôture), pas
   * d'un balayage quotidien. `synchroniserAlertes` ne la verrait jamais parmi
   * les candidates et la résoudrait dès le premier tour, avant que quiconque
   * l'ait lue. Même motif structurel que `besoin_adaptation_declare`.
   */
  /**
   * Le dossier de financement ne suit pas un report — il faut le refaire.
   *
   * 🔴 `D2-5-01` (2026-08-20). `financementType` est recopié sur la session de
   * remplacement, mais l'ACCORD ne l'est pas : il portait sur les dates
   * d'origine, et un financeur n'accorde pas des dates qu'il n'a pas vues.
   *
   * C'est le bon comportement. Ce qui ne l'était pas, c'est son SILENCE :
   * `validateOpcoAccord` classe l'absence d'accord en `critique`, donc la
   * session de remplacement refuse de démarrer — et l'admin le découvrait le
   * jour où il cliquait, sans savoir que le report en était la cause.
   *
   * ⚠️ `resolutionAuto: false` — l'alerte naît de l'ÉVÉNEMENT de report. Le
   * balayage quotidien ne l'émet pas et la résoudrait au premier tour.
   */
  report_accord_financement_a_refaire: {
    niveau: "important",
    titre: "Accord de financement à refaire après report",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — l'alerte naît de l'ÉVÉNEMENT de report, pas du balayage quotidien. `synchroniserAlertes` ne la verrait jamais parmi les candidates et la résoudrait au premier tour, avant lecture. Elle se résout à la main, une fois le nouvel accord enregistré.",
    guichet: "direction",
  },
  /**
   * Un e-mail a DÉFINITIVEMENT rebondi.
   *
   * 🔴 `D5-3-02` (2026-08-20). Un rebond dur était indiscernable d'une remise
   * réussie : le relais acceptait le message (`sent`), le serveur destinataire
   * le refusait ensuite, et rien ne revenait. Une convocation « envoyée »
   * pouvait n'être jamais arrivée.
   *
   * Le guichet est `administratif` : corriger une adresse est un geste
   * d'administration, pas une décision de direction ni un acte pédagogique.
   *
   * ⚠️ `resolutionAuto: false` — l'alerte naît d'un ÉVÉNEMENT reçu du relais,
   * pas d'un balayage. Elle ne serait jamais réémise, donc `synchroniserAlertes`
   * la résoudrait au premier tour, avant que quiconque l'ait lue.
   */
  email_rebond_dur: {
    niveau: "important",
    titre: "Un e-mail a définitivement rebondi",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — l'alerte naît d'un ÉVÉNEMENT reçu du relais (webhook), pas du balayage quotidien. `synchroniserAlertes` ne la verrait jamais parmi les candidates et la résoudrait au premier tour, avant lecture. Elle se résout à la main, une fois l'adresse corrigée.",
    guichet: "administratif",
  },
  cloture_trace_presence_incomplete: {
    niveau: "important",
    titre: "Session clôturée sans trace de présence pour tous les inscrits",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — l'alerte naît de l'ÉVÉNEMENT de clôture, pas du balayage quotidien. `synchroniserAlertes` ne la verrait jamais parmi les candidates et la résoudrait au premier tour, avant lecture. Elle se résout à la main, une fois la feuille complétée ou les renonçants sortis du dispositif.",
    guichet: "qualite",
  },
  /**
   * Un bénéficiaire a déclaré un besoin d'adaptation depuis son portail.
   *
   * 🔴 Vérification en production du 2026-08-04 : la déclaration n'atteignait
   * la console PAR AUCUN CHEMIN. `declarerHandicapAction` chiffrait le besoin,
   * envoyait un message Telegram, et c'est tout — `alertes_systeme` restait
   * vide, donc RIEN sur /qualiopi/a-traiter, la première page ouverte le matin.
   * Un seul canal, hors de l'outil de travail : un besoin déclaré la veille
   * d'une session pouvait n'être vu par personne. L'écran promet pourtant
   * « nous en tiendrons compte avant la formation », et l'indicateur 26 porte
   * précisément sur l'accueil des publics en situation de handicap.
   *
   * `important` et non `critique` : le dossier n'est pas en faute, il y a un
   * geste à poser avant la session. Réserver `critique` aux manquements rend
   * les alertes critiques crédibles — c'est à celles-là qu'on doit sursauter.
   *
   * ⚠️ `resolutionAuto: false`, et c'est STRUCTUREL : l'évaluateur quotidien
   * n'émet jamais ce code (l'alerte naît du geste du bénéficiaire, pas d'un
   * balayage). Le passer à `true` ferait résoudre l'alerte par le premier
   * `synchroniserAlertes` venu, avant même que quiconque l'ait lue. Elle se
   * résout à la main, quand l'adaptation a été prise en compte.
   */
  besoin_adaptation_declare: {
    niveau: "important",
    titre: "Besoin d'adaptation déclaré par un bénéficiaire",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — l'alerte naît du geste du bénéficiaire, pas du balayage quotidien. `synchroniserAlertes` ne la verrait jamais parmi les candidates et la résoudrait dès le premier tour, avant que quiconque l'ait lue. Elle se résout à la main, quand l'adaptation a été prise en compte.",
    guichet: "qualite",
  },

  // ── Vigilance URSSAF des sous-traitants (audit E2E 2026-08-19, `D5-4-01`) ──
  //
  // 🔴 Ces trois codes étaient ÉMIS par le balayage et ABSENTS de ce catalogue.
  // Conséquence en chaîne, mesurée : `guichetPourCode` rendait `undefined`,
  // `regrouperAlertes` les rangeait dans `sansGuichet`, et `envoi-groupe.ts`
  // écrivait un `console.error` sans rien envoyer — elles n'arrivaient donc dans
  // AUCUNE boîte. Et `codesAutoResolution` étant dérivé de ce catalogue, elles ne
  // se refermaient JAMAIS, même après régularisation.
  //
  // Enjeu : art. L.8222-1 du code du travail — l'organisme est solidairement
  // responsable des cotisations de son sous-traitant s'il ne s'est pas assuré de
  // sa vigilance. D'où le guichet `direction` : c'est un risque financier qui
  // engage l'entreprise, pas un sujet de conformité pédagogique.
  //
  // `resolutionAuto: true` pour les trois : le balayage quotidien les réémet tant
  // que la cause dure, donc leur fermeture automatique est exacte — et c'est ce
  // qui manquait le plus, puisqu'une alerte qui ne se referme pas finit acquittée
  // à la main pour faire taire l'écran, y compris le jour où le manquement est réel.
  vigilance_urssaf_absente: {
    niveau: "critique",
    titre: "Attestation de vigilance URSSAF absente (responsabilité solidaire)",
    resolutionAuto: true,
    guichet: "direction",
  },
  vigilance_urssaf_perimee: {
    niveau: "critique",
    titre: "Attestation de vigilance URSSAF périmée (responsabilité solidaire)",
    resolutionAuto: true,
    guichet: "direction",
  },
  vigilance_urssaf_expire_j30: {
    niveau: "important",
    titre: "Attestation de vigilance URSSAF expire dans 30 jours",
    resolutionAuto: true,
    guichet: "direction",
  },
  // Même défaut, même correctif (`D5-4-01`). Guichet `formateur` : ce sont les
  // sorties de démonstration du kit d'animation, préparées par celui qui anime.
  kit_sorties_non_pretes: {
    niveau: "important",
    titre: "Sorties de démonstration non produites",
    resolutionAuto: true,
    guichet: "formateur",
  },

  // ── Pilotage qualité ────────────────────────────────────────────────────────
  /**
   * Mentions obligatoires absentes des factures.
   *
   * 🔴 `D9-3-02` (2026-08-20). `critique` et non `important` : toute facture
   * émise est irrégulière tant que la configuration est incomplète, et
   * l'omission du n° de TVA au-delà de 150 € est **sanctionnée** (art. 1737
   * CGI). C'est un risque fiscal immédiat, pas un écart de présentation.
   *
   * Guichet `direction` : compléter l'identité légale de la société engage
   * l'entreprise, ce n'est ni un acte pédagogique ni de la saisie courante.
   */
  facture_mentions_legales_absentes: {
    niveau: "critique",
    titre: "Mentions obligatoires absentes des factures",
    resolutionAuto: true,
    guichet: "direction",
  },
  responsable_qualite_absent: {
    niveau: "important",
    titre: "Responsable qualité non désigné",
    resolutionAuto: true,
    guichet: "direction",
  },

  // ── Cycle commercial : devis & signatures ─────────────────────────────────
  /**
   * 🔴 Bug latent corrigé le 2026-08-05 : ces trois premiers codes étaient émis
   * par l'évaluateur depuis la refonte du 2026-08-01 mais ABSENTS du catalogue.
   * Or `synchroniserAlertes` ne résout automatiquement QUE les codes du
   * catalogue à `resolutionAuto: true` — un devis accepté ou une pièce signée
   * laissaient donc leur alerte OUVERTE pour toujours (résolution manuelle
   * seulement, sans que rien ne le signale).
   */
  devis_sans_reponse: {
    niveau: "important",
    titre: "Devis envoyé sans réponse depuis +7 jours",
    resolutionAuto: true,
    guichet: "direction",
  },
  signature_en_attente: {
    niveau: "important",
    titre: "Lien de signature sans signature depuis +7 jours",
    resolutionAuto: true,
    guichet: "administratif",
  },
  signature_contreseing_du: {
    niveau: "important",
    titre: "Pièce signée d'un seul côté depuis +7 jours",
    resolutionAuto: true,
    guichet: "direction",
  },
  /**
   * 🔴 LE FILET DU DÉFAUT LE PLUS SILENCIEUX DU DOMAINE (2026-09-05).
   *
   * Vécu en production : la convention `AXI-DOC-2026-039` a été signée par la
   * cliente le 2026-09-04 à 20:47 UTC, contresignée par l'organisme à 21:33, et
   * la cliente n'a **jamais reçu son exemplaire**. Un contrat de formation
   * n'existe qu'une fois remis aux deux parties : l'organisme détenait seul la
   * preuve d'un engagement réciproque.
   *
   * Ce que ce code répare et qu'aucune autre alerte ne pouvait voir : les trois
   * surfaces de rattrapage — `pieces-en-attente`, la pastille de navigation,
   * l'écran « À traiter » — filtrent toutes sur
   * `statutSignature IN (en_attente, partielle)`. Une pièce COMPLÈTE en sort.
   * `partieARelancer()` rend `null` dès qu'elle est `signee` (« signee n'a
   * personne à relancer »). Autrement dit, **le succès de la signature éteignait
   * le seul signal qui aurait pu dire qu'il restait quelque chose à faire.**
   * Le défaut se cachait dans son propre succès.
   *
   * `resolutionAuto: true` : l'envoi pose `exemplaireSigneEnvoyeAt`, la
   * condition tombe d'elle-même au tour suivant. Rien à cliquer.
   *
   * `critique` et non `important` : ce n'est pas un retard de courtoisie. La
   * pièce est due, elle est promise en toutes lettres au signataire par l'écran
   * de retour du portail, et son absence se voit lors d'un contrôle de
   * financeur — du côté du CLIENT, qui ne peut pas la produire.
   */
  exemplaire_signe_non_transmis: {
    niveau: "critique",
    titre: "Pièce intégralement signée jamais remise au signataire",
    resolutionAuto: true,
    guichet: "administratif",
  },
  /**
   * SPEC_PART5 §D.10 — échéance de validité des devis. Le statut `expire` est
   * posé par le cron `formation-crons.devis-expiration` (06:45), les alertes
   * sont levées par l'évaluateur (07:00). `devis_expire_j7` = dernière fenêtre
   * de relance ; `devis_expire` = piste à clôturer ou re-deviser.
   */
  devis_expire_j7: {
    niveau: "important",
    titre: "Devis expire dans moins de 7 jours",
    resolutionAuto: true,
    guichet: "direction",
  },
  devis_expire: {
    niveau: "info",
    titre: "Devis expiré sans suite",
    resolutionAuto: true,
    guichet: "direction",
  },
  /**
   * Déblocages du parcours vente (plan « Nouvelle vente » §1a) — tous deux
   * notifiés par email interne dès leur création (CODES_DEBLOCAGE du
   * crons-worker), pas seulement affichés : l'étape suivante attend l'admin.
   * `resolutionAuto` : la condition disparaît d'elle-même (session/parcours
   * créé, formation publiée ou cycle relancé).
   */
  devis_signe_convention: {
    niveau: "important",
    titre: "Devis signé — session et convention à créer",
    resolutionAuto: true,
    guichet: "administratif",
  },
  moteur_assemble_a_publier: {
    niveau: "important",
    titre: "Génération terminée — formation à relire et publier",
    resolutionAuto: true,
    guichet: "qualite",
  },

  // ── Référentiel des offres ────────────────────────────────────────────────
  /**
   * SPEC_PART5 §A.2 : une offre active dont la cohérence avec la page du site
   * (titre, durée, promesse, tarif) n'a pas été vérifiée depuis plus de
   * 30 jours. C'est le point d'entrée de toute vente — vendre sur un tarif
   * jamais revérifié est l'erreur la plus coûteuse du parcours commercial.
   * `resolutionAuto: true` : cliquer « Vérifier la cohérence » horodate
   * `derniereVerifCoherenceAt` et la condition disparaît.
   */
  offres_site_non_verifiees: {
    niveau: "info",
    titre: "Offre non vérifiée depuis plus de 30 jours",
    resolutionAuto: true,
    guichet: "qualite",
  },

  // ── Réclamations ──────────────────────────────────────────────────────────
  reclamation_sans_reponse_j15: {
    niveau: "critique",
    titre: "Réclamation sans réponse depuis +15 jours",
    resolutionAuto: true,
    guichet: "qualite",
  },

  // ── Émargement / présence ──────────────────────────────────────────────────
  emargement_manquant: {
    niveau: "critique",
    titre: "Émargement manquant (session réalisée)",
    resolutionAuto: true,
    guichet: "administratif",
  },
  /**
   * Angle mort structurel comblé : `emargement_manquant` ne se déclenche que sur
   * une session `realisee`, or la clôture automatique REFUSE justement de passer
   * une session en `realisee` sans trace de présence. Une session totalement non
   * émargée restait donc bloquée en `en_cours` indéfiniment, invisible du BPF,
   * des attestations et des indicateurs — sans qu'aucune alerte ne se lève.
   */
  session_bloquee_en_cours: {
    niveau: "critique",
    titre: "Session non clôturée faute d'émargement",
    resolutionAuto: true,
    guichet: "administratif",
  },
  // 🔴 LE JOUR MÊME, pas trois jours après.
  //
  // Constaté sur AXI-SESS-2026-005 : la stagiaire n'a jamais pu émarger, et
  // aucune alerte ne pouvait le dire TANT QU'IL ÉTAIT ENCORE TEMPS.
  //   · R03 `emargement_manquant` exige `statut = "realisee"` — or la clôture
  //     automatique REFUSE de passer en `realisee` une session dont personne
  //     n'a de trace de présence. La session reste `en_cours`, et R03 ne la
  //     voit jamais.
  //   · R03ter `session_bloquee_en_cours` se déclenche à J+3 — soit un jour
  //     APRÈS l'expiration des jetons (fenêtre de 48 h après la fin).
  // Les deux CONSTATENT ; aucune ne GARDE. Celle-ci se lève pendant que le
  // rattrapage est encore possible.
  session_sans_dispositif_emargement: {
    niveau: "critique",
    titre: "Session en cours sans dispositif de signature",
    resolutionAuto: true,
    guichet: "administratif",
  },

  // 🔴 L'ANGLE MORT QUE LES TROIS AUTRES LAISSAIENT OUVERT (2026-08-17).
  //
  // Les liens SONT partis, et personne n'a signé. Aucune des trois règles
  // existantes ne le voit :
  //   · R03 `emargement_manquant` exige `statut = "realisee"` ;
  //   · R03ter `session_bloquee_en_cours` attend J+3 — un jour APRÈS
  //     l'expiration des jetons ;
  //   · `session_sans_dispositif_emargement` exige qu'AUCUN lien vivant
  //     n'existe. Or le cron de 06:00 vient précisément d'en créer : elle est
  //     donc éteinte PAR CONSTRUCTION sur les sessions qu'il a servies.
  //
  // Résultat : une session servie par le cron mais jamais signée restait
  // muette jusqu'à J+3. Le dispositif était en place, et c'est justement ce
  // qui empêchait de voir que personne ne s'en servait.
  //
  // ⚠️ Celle-ci se lève pendant que le rattrapage est ENCORE POSSIBLE : les
  // jetons vivent jusqu'à 48 h après la fin, une signature reste recevable.
  emargement_aucune_signature: {
    niveau: "critique",
    titre: "Liens d'émargement partis, aucune signature",
    resolutionAuto: true,
    guichet: "administratif",
  },
  /**
   * 🔴 LES QUATRE RÈGLES D'ÉMARGEMENT NE SAVENT COMPTER QUE JUSQU'À ZÉRO
   * (audit du 2026-09-04, trou n°9).
   *
   * `emargement_manquant` porte `sansAucuneTraceDePresence()`,
   * `session_bloquee_en_cours` et `emargement_aucune_signature` portent
   * `enrollments: { none: … }`. Toutes trois posent la même question — « pas
   * UNE seule trace ? » — et une session où onze inscrits sur douze ont signé
   * y répond « non ». Le douzième est donc invisible : la session se clôture,
   * `attestations-auto` délivre, et personne n'apprend rien avant l'audit.
   *
   * Le cas partiel n'était pas totalement muet : `cloture_trace_presence_incomplete`
   * le dit — mais À LA CLÔTURE, c'est-à-dire quand la feuille n'est plus
   * signable et que le geste possible se réduit à « sortir du dispositif ceux
   * qui ont renoncé ». Celle-ci se lève PENDANT que la session vit, tant qu'un
   * émargement peut encore être recueilli. Les deux ne disent pas la même
   * chose au même moment, et c'est pour cela qu'elles coexistent.
   *
   * `important` et non `critique` : la session a des preuves, elle n'en a pas
   * assez. Le critique est réservé au dossier entièrement vide — sans quoi
   * l'administrateur apprend à ignorer les critiques d'émargement, et il en
   * reste trois.
   */
  emargement_partiel: {
    niveau: "important",
    titre: "Émargement incomplet : une partie des inscrits n'a aucune trace",
    resolutionAuto: true,
    guichet: "administratif",
  },
  /**
   * 🔴 2026-08-24, cahier D5 — la mesure existait, elle sortait en
   * `console.error`. Un journal de conteneur n'est lu par personne le lendemain.
   */
  rappel_j7_non_envoye: {
    niveau: "important",
    titre: "Rappel J-7 jamais envoyé",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "IRRÉVERSIBLE — la condition (`rappelJ7EnvoyeAt` nulle sur une session DÉJÀ " +
      "commencée) ne disparaîtra jamais : le rappel n'est plus envoyable après le " +
      "début. Une résolution automatique attendrait un événement qui ne peut pas " +
      "se produire. L'écart s'acquitte à la main, une fois consigné.",
    guichet: "administratif",
  },
  /**
   * 🔴 2026-08-25, cahier D3-4 — le taux de présence se calcule sur les créneaux
   * EXISTANTS. Une journée déclarée sans créneaux disparaît du dénominateur, et
   * le taux affiche 100 % sur une session à moitié couverte — chiffre qui part
   * ensuite sur l'attestation et le certificat de réalisation.
   */
  journee_sans_creneaux: {
    niveau: "important",
    titre: "Journée déclarée sans créneau de présence",
    // Le geste existe et il est immédiat : « Générer les créneaux ». Dès qu'il
    // est posé, la règle cesse de produire la candidate et l'alerte se referme
    // d'elle-même — c'est exactement le cas d'une résolution automatique.
    resolutionAuto: true,
    guichet: "administratif",
  },

  /**
   * 🔴 LA CONVOCATION DU STAGIAIRE N'ÉTAIT SURVEILLÉE PAR PERSONNE
   * (audit du 2026-09-04, trou n°5).
   *
   * `Enrollment.convocationEnvoyeeAt` porte au schéma le récit d'un défaut déjà
   * payé : « vérifié en production le 15/08/2026, AUCUNE convocation n'était
   * jamais partie, sur tout l'historique ». La colonne a été créée pour rendre
   * le cron RATTRAPANT — mais elle n'est lue que par le cron lui-même, comme
   * garde de son propre envoi. Personne ne surveille l'état qu'elle décrit.
   *
   * Autrement dit : si le cron ne tourne pas, ou tourne et échoue, la colonne
   * reste nulle et le silence est parfait — exactement la situation d'août,
   * qu'il a fallu aller CHERCHER en production pour la découvrir.
   *
   * `critique` : la convocation est une obligation d'information (indicateur 9)
   * et, plus concrètement, un stagiaire non convoqué ne vient pas. Le geste
   * reste possible à J-2, il ne l'est plus le jour même.
   */
  convocation_stagiaire_manquante: {
    niveau: "critique",
    titre: "Stagiaire non convoqué à moins de 2 jours du début",
    resolutionAuto: true,
    guichet: "administratif",
  },
  /**
   * 🔴 UNE SESSION À DISTANCE SANS LIEN DE CONNEXION (audit du 2026-09-04,
   * trou n°3).
   *
   * `TrainingSession.lieuVisioUrl` n'apparaissait NULLE PART dans l'évaluateur.
   * `session_contact_sur_place_absent` couvre le distanciel, mais ne regarde
   * que le contact à joindre — et sort en `info`, « c'est gênant, pas
   * bloquant ». Sans lien, ce n'est plus gênant : la formation n'a pas lieu.
   *
   * ⚠️ Le lien manquant ne se rattrape pas le matin même : il doit figurer dans
   * la convocation du stagiaire et dans celle du formateur, toutes deux déjà
   * parties à J-2. D'où `critique`, au même niveau que l'absence de convention.
   */
  session_distanciel_sans_lien: {
    niveau: "critique",
    titre: "Session à distance sans lien de connexion",
    resolutionAuto: true,
    guichet: "administratif",
  },
  /**
   * 🔴 PLUS D'INSCRITS QUE DE PLACES (audit du 2026-09-04, trou n°12).
   *
   * `nbParticipantsPrevus` n'était lu que par les écrans et les devis : aucune
   * règle ne comparait jamais l'effectif réel à l'effectif vendu. Le
   * dépassement se découvre alors dans la salle, ou sur la facture.
   *
   * Ce n'est pas qu'un problème de chaises : l'effectif conditionne le montant
   * conventionné, la prise en charge OPCO au barème « par stagiaire », et
   * l'engagement pédagogique pris au catalogue (indicateur 17). Un groupe plus
   * nombreux que prévu est une modification de la convention, pas un détail
   * d'intendance.
   */
  effectif_depasse: {
    niveau: "important",
    titre: "Plus d'inscrits que l'effectif prévu",
    resolutionAuto: true,
    guichet: "administratif",
  },

  // ── Formateur ──────────────────────────────────────────────────────────────
  /**
   * ⚠️ Le titre dit « à J-7 » mais la règle escalade : sur une session DÉJÀ
   * DÉMARRÉE sans formateur principal, elle émet en `critique`, avec son propre
   * titre (« Session démarrée sans formateur principal »).
   *
   * 🔴 C'est une divergence catalogue ↔ émission, et elle est DÉCLARÉE ici
   * plutôt que subie : l'audit du 2026-09-04 a relevé que trois codes émettent
   * un niveau différent de celui catalogué sans que rien ne le dise, si bien
   * qu'on ne peut plus distinguer une escalade voulue d'un oubli. Le niveau
   * ci-dessous est celui du cas NOMINAL (l'alerte de garde, à J-7) ; le
   * `critique` est le cas dégradé, où l'obligation n'est plus imminente mais
   * dépassée. Il serait plus grave de cataloguer `critique` : la garde à J-7,
   * qui est le cas fréquent, crierait alors tous les jours.
   */
  session_sans_formateur: {
    niveau: "important",
    titre: "Session à J-7 sans formateur principal",
    resolutionAuto: true,
    guichet: "administratif",
  },

  // ── Animation (kit documentaire) ──────────────────────────────────────────
  /**
   * Le diaporama de salle (slot `diaporama` du kit, le .pptx projeté) n'est pas
   * déposé dans la bibliothèque alors qu'une session démarre sous 7 jours.
   * Jointure PAR CONVENTION `Formation.slug === interventionSlug`, résolue
   * strictement (vente/kit-formation.ts) : une formation sur-mesure ou
   * dupliquée n'a pas de kit → PAS d'alerte (le formateur dépose son support où
   * il veut ; une alerte insoluble apprendrait à ignorer les alertes).
   * `resolutionAuto` : disparaît d'elle-même dès le .pptx déposé.
   */
  diaporama_manquant_session: {
    niveau: "important",
    titre: "Diaporama non déposé pour une session imminente",
    resolutionAuto: true,
    guichet: "formateur",
  },
  // 🔴 Recette du 2026-09-03/04 — la convocation du formateur transporte
  // fidèlement le contact sur place et les consignes d'accès… quand ils sont
  // saisis. Vides, l'e-mail ne les affiche simplement pas : le formateur reçoit
  // une adresse et une salle, personne à demander à l'accueil, et aucune idée
  // de la manière d'entrer. Le message a l'air complet et il est inutilisable
  // à la porte. Rien ne le signalait — la seule façon de s'en apercevoir était
  // que le formateur appelle depuis le trottoir.
  //
  // Guichet ADMINISTRATIF : c'est lui qui vend la session et qui appelle le
  // client pour obtenir le nom de l'hôte, pas le formateur ni la qualité.
  session_contact_sur_place_absent: {
    niveau: "important",
    titre: "Session sans contact sur place ni consignes d'accès",
    resolutionAuto: true,
    guichet: "administratif",
  },

  // ── Satisfaction ──────────────────────────────────────────────────────────
  /**
   * Lot 1 §1.4 — l'un des DEUX seuls codes qui manquaient au parcours.
   *
   * 🔴 Trouvé le 2026-08-17 en construisant la checklist : sur les quatorze
   * étapes d'un dossier de session, douze avaient déjà leur code d'alerte. Le
   * positionnement, non — alors qu'il porte l'indicateur 8 à lui seul, et que
   * c'est l'étape ratée sur le premier dossier réel (répondu APRÈS le début de
   * la formation, où il ne positionne plus rien).
   *
   * `administratif` : envoyer et relancer un questionnaire n'engage pas
   * l'organisme. C'est la colonne déléguable de la matrice du Lot 10.
   *
   * `resolutionAuto: true`, contrairement à `satisfaction_manquante` : ici la
   * cause disparaît AVANT la séance et le geste redevient sans objet dès que la
   * session commence. Garder l'alerte ouverte ensuite n'apprendrait rien —
   * l'écart, lui, est porté par la checklist du dossier, qui ne l'efface pas.
   */
  positionnement_sans_reponse: {
    niveau: "important",
    titre: "Questionnaire de positionnement sans réponse",
    resolutionAuto: true,
    guichet: "administratif",
  },
  /**
   * Lot 1 §1.4 — le second code manquant.
   *
   * Le recueil à froid est l'obligation la plus facilement oubliée du
   * parcours : elle tombe un mois après la fin, quand le dossier a quitté tous
   * les écrans. L'indicateur 30 exige pourtant un recueil TRACÉ.
   *
   * ⚠️ Même famille que `satisfaction_manquante`, et même raisonnement pour la
   * résolution : la relance porte le rattrapage, l'alerte reste la trace qu'il
   * a fallu relancer. C'est ce fait-là que l'auditeur regarde.
   */
  suivi_froid_manquant: {
    niveau: "important",
    titre: "Suivi à froid (J+30) sans réponse",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "Même raisonnement que `satisfaction_manquante` (SPEC_PART2 §6.5, « Non (relance auto) ») : la relance porte le rattrapage, l alerte reste la TRACE que le recueil à froid n a pas eu lieu spontanément. La refermer parce que le stagiaire a fini par répondre effacerait le fait qu il a fallu relancer — or c est ce fait que l auditeur regarde (ind. 30).",
    guichet: "administratif",
  },
  satisfaction_manquante: {
    niveau: "important",
    titre: "Questionnaire de satisfaction non rempli",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "SPEC_PART2 §6.5 — « Non (relance auto) ». La relance du questionnaire porte le rattrapage ; l alerte, elle, reste la TRACE que le retour n a pas été recueilli. La refermer parce que le stagiaire a fini par répondre effacerait le fait qu il a fallu relancer — or c est ce fait que l auditeur regarde (ind. 30).",
    guichet: "administratif",
  },
  satisfaction_sous_seuil: {
    niveau: "important",
    titre: "Taux de satisfaction sous le seuil",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "SPEC_PART2 §6.5 — « Non (action corrective) ». La moyenne peut remonter d elle-même dès que d autres réponses arrivent ; refermer l alerte à ce moment-là effacerait la tâche AVANT que l analyse et le plan d action (ind. 30 et 32) aient eu lieu.",
    guichet: "qualite",
  },

  // ── Évaluation des acquis ──────────────────────────────────────────────────
  evaluation_acquis_manquante: {
    niveau: "critique",
    titre: "Évaluation finale des acquis manquante",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "SPEC_PART2 §6.5 — « Non ». Une session réalisée sans évaluation finale des acquis est un manquement au sens de l indicateur 11 : il s acquitte quand l évaluation a été VALIDÉE par un habilité, pas quand une ligne apparaît en base.",
    guichet: "formateur",
  },

  // ── Attestations ──────────────────────────────────────────────────────────
  attestation_non_envoyee: {
    niveau: "important",
    titre: "Attestation non envoyée au stagiaire",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "SPEC_PART2 §6.5 — « Non ». L attestation est un droit du stagiaire (L.6353-1). Le manquement se solde par un geste tracé, pas par la disparition du signal.",
    guichet: "administratif",
  },

  // ── Qualiopi expiration ────────────────────────────────────────────────────
  qualiopi_expire_j90: {
    niveau: "important",
    titre: "Certification Qualiopi expire dans 90 jours",
    resolutionAuto: true,
    guichet: "qualite",
  },
  qualiopi_expire_j30: {
    niveau: "critique",
    titre: "Certification Qualiopi expire dans 30 jours",
    resolutionAuto: true,
    guichet: "qualite",
  },
  qualiopi_expire: {
    niveau: "critique",
    titre: "Certification Qualiopi expirée",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "SPEC_PART2 §6.5 — « Non », là où _j90 et _j30 portent « Oui si renouvelée ». Les paliers d avertissement se referment seuls ; celui-ci constate que la certification EST expirée, et l acquittement est la trace que la direction l a vu.",
    guichet: "direction",
  },

  // ── BPF ──────────────────────────────────────────────────────────────────
  bpf_a_deposer_j60: {
    niveau: "info",
    titre: "Bilan Pédagogique et Financier à déposer (J-60)",
    resolutionAuto: true,
    guichet: "qualite",
  },
  bpf_a_deposer_j30: {
    niveau: "important",
    titre: "Bilan Pédagogique et Financier à déposer (J-30)",
    resolutionAuto: true,
    guichet: "qualite",
  },
  bpf_a_deposer_j7: {
    niveau: "critique",
    titre: "Bilan Pédagogique et Financier à déposer (J-7)",
    resolutionAuto: true,
    guichet: "direction",
  },
  bpf_en_retard: {
    niveau: "critique",
    titre: "Bilan Pédagogique et Financier en retard",
    resolutionAuto: true,
    guichet: "direction",
  },

  // ── Veille ────────────────────────────────────────────────────────────────
  veille_inactive_j45: {
    niveau: "important",
    titre: "Aucune entrée de veille depuis 45 jours",
    resolutionAuto: true,
    guichet: "qualite",
  },

  // ── Emails en attente de validation ───────────────────────────────────────
  //
  // 🔴 Vérification E2E 2026-07-26. La corbeille de validation retient les
  // emails commerciaux (devis, facture, relance d'impayé) jusqu'à approbation.
  // Rien ne signalait qu'un email y dormait : un devis pouvait être « marqué
  // envoyé » côté admin sans jamais partir. `compterEnAttente()` existait sans
  // aucun appelant — c'est ici qu'il sert.
  emails_en_attente_validation: {
    niveau: "important",
    titre: "Des emails attendent votre validation",
    resolutionAuto: true,
    guichet: "administratif",
  },

  // ── Formateurs ────────────────────────────────────────────────────────────
  cv_formateur_perime: {
    niveau: "important",
    titre: "CV formateur non mis à jour depuis 12 mois",
    resolutionAuto: true,
    guichet: "formateur",
  },

  // ── Cycle de vie du formateur sur une session (2026-09-03) ────────────────
  // Une session vendue pouvait rester sans formateur CONFIRMÉ sans qu'aucune
  // alerte ne le dise. Les quatre codes se résolvent d'eux-mêmes : dès qu'un
  // formateur est (ré)affecté, a répondu, ou que les dates ne se croisent
  // plus, le balayage suivant les ferme. Guichet : le secrétariat, qui affecte
  // et convoque — sauf l'habilitation, qui est une conformité (ind.21/22).
  formateur_mission_refusee: {
    niveau: "critique",
    titre: "Mission refusée — session sans formateur",
    resolutionAuto: true,
    guichet: "administratif",
  },
  formateur_mission_sans_reponse: {
    niveau: "important",
    titre: "Formateur sans réponse à la proposition de mission",
    resolutionAuto: true,
    guichet: "administratif",
  },
  formateur_indisponible_sur_session: {
    niveau: "critique",
    titre: "Formateur indisponible sur les dates de la session",
    resolutionAuto: true,
    guichet: "administratif",
  },
  // 🔴 Recette du 2026-09-03 — le trou que les trois codes ci-dessus laissaient
  // ouvert, et il s'ouvrait au pire moment. `formateur_mission_sans_reponse`
  // exige `en_attente` ET `dateDebut > now` ; le cron `missions-formateur`
  // passe la proposition en `expiree` au moment EXACT où la session démarre.
  // L'alerte qui disait « Camille n'a pas répondu » disparaissait donc quand
  // le risque cessait d'être un risque pour devenir un fait. Et
  // `session_sans_formateur` ne prend pas le relais : elle exige
  // `formateurPrincipalId: null`, or l'expiration ne retire pas l'affectation.
  // Vérifié en base sur AXI-SESS-2026-010 : zéro alerte sur le formateur.
  formateur_mission_expiree: {
    niveau: "critique",
    titre: "Session démarrée sans réponse du formateur",
    resolutionAuto: true,
    guichet: "administratif",
  },
  // 🔴 2026-09-04 — le silence tranché AVANT le démarrage.
  //
  // `formateur_mission_sans_reponse` prévient qu'on attend ; celle-ci constate
  // qu'on n'attend plus : l'échéance est passée, l'affectation est retirée, la
  // session n'a PLUS de formateur. C'est une bascule d'état, pas une relance —
  // et le geste attendu n'est pas le même : appeler devient réaffecter.
  formateur_mission_sans_reponse_delai: {
    niveau: "critique",
    titre: "Délai dépassé — session libérée, formateur à réaffecter",
    resolutionAuto: true,
    guichet: "administratif",
  },
  // Le formateur écrit APRÈS l'échéance, depuis son lien devenu inerte. Sans ce
  // code, son message n'aurait nulle part où atterrir : il tomberait dans une
  // boîte que personne ne relie à la session. Ne se résout pas seule — quelqu'un
  // doit l'avoir lue.
  formateur_message_apres_delai: {
    niveau: "important",
    titre: "Message d'un formateur après l'échéance de réponse",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "Un message adressé à l'organisme n'a pas de « cause » qui disparaîtrait : " +
      "il a été écrit, il reste à lire. Une résolution automatique le ferait sortir " +
      "de la liste sans que personne ne l'ait ouvert — c'est-à-dire perdre la seule " +
      "chose que le formateur pouvait encore nous dire une fois son lien inerte.",
    guichet: "administratif",
  },
  formateur_non_habilite_assigne: {
    niveau: "important",
    titre: "Formateur principal non habilité sur cette formation",
    resolutionAuto: true,
    guichet: "qualite",
  },
  /**
   * 🔴 LE SEUL RISQUE DU CYCLE FORMATEUR QUI ÉTAIT 100 % MUET (audit du
   * 2026-09-04, trou n°1).
   *
   * Un formateur se désiste d'une session qu'il devait animer. Le fait est
   * consigné au registre des incidents (`faitIntervenant: desistement`, ou
   * `annulation_tardive`) — et là, plus rien. Le registre n'est lu que par
   * `sous_traitant_incidents_repetes`, qui exige **DEUX faits sur 24 mois** et
   * regarde en arrière, vers la reconduction. La session qui tombe DEMAIN,
   * elle, n'est signalée par aucun des sept codes du cycle formateur : ils
   * partent tous d'une `MissionFormateur` restée sans réponse, or ici la
   * réponse a été donnée, puis reprise.
   *
   * ⚠️ CE CODE NE LIT PAS `MissionFormateurStatut.retiree`, contrairement à ce
   * que l'audit proposait — et c'est une correction de l'audit, vérifiée dans
   * le code. `retiree` n'est jamais posé que sur une mission `en_attente`, par
   * l'ORGANISME (`retirerMissionsEnAttente`, `proposerMission`), quand un autre
   * formateur a accepté ou qu'on change d'avis. C'est la ménagerie normale du
   * dispositif : en faire une alerte critique produirait du bruit à chaque
   * co-animation proposée à deux. Le désistement du formateur, lui, n'a qu'une
   * seule trace : l'incident.
   *
   * `critique` : à la différence de `sous_traitant_incidents_repetes` — qui
   * INFORME pour la reconduction — celle-ci porte sur une session encore à
   * venir ou en cours. Il y a un client à prévenir et un remplaçant à trouver,
   * et le temps disponible est ce qui manque.
   */
  formateur_desiste_session: {
    niveau: "critique",
    titre: "Formateur désisté — session sans intervenant confirmé",
    resolutionAuto: true,
    guichet: "administratif",
  },
  /**
   * 🔴 UNE RC PRO QUI TOMBE HORS SOUS-TRAITANCE NE DISAIT RIEN (audit du
   * 2026-09-04, trou n°11 — implémenté PARTIELLEMENT, et le partiel est motivé).
   *
   * `rcProAttestationUrl` / `rcProEcheanceAt` sont des colonnes de `Trainer`,
   * portées par TOUS les formateurs. Mais `regleVigilanceSousTraitance` filtre
   * sur `statut: "sous_traitant"` : une attestation versée à la fiche d'un
   * formateur salarié ou dirigeant expirait sans que rien ne le dise.
   *
   * ⚠️ CE CODE NE COUVRE QUE L'EXPIRATION, jamais l'ABSENCE — et c'est
   * délibéré. `requisPourStatut` (`trainers/conformite.ts`) est la source de
   * vérité des pièces exigées : elle n'exige la RC pro d'aucun statut, et la RC
   * pro de l'organisme couvre déjà ses salariés. Réclamer chaque nuit une pièce
   * que personne ne doit fournir produirait une alerte que NUL GESTE ne ferme —
   * c'est le motif écrit trois fois dans ce fichier pour lequel on n'alerte
   * jamais sur un devoir qui n'existe pas.
   *
   * Le distinguo est celui que la règle sous-traitance pose déjà : « RC pro
   * absente → IMPORTANT, elle n'est pas exigée à l'entrée ; RC pro expirée →
   * CRITIQUE, elle existait, elle est tombée ». Ici seul le second cas a un
   * sens, et il l'a quel que soit le statut : une couverture versée au dossier
   * puis périmée est un fait, pas une exigence.
   *
   * ⛔ La vigilance URSSAF n'est PAS étendue. `vigilanceRequise` la réserve à
   * l'indépendant, et c'est le droit qui le veut (art. L.8222-1 vise le
   * donneur d'ordre d'un PRESTATAIRE). L'exiger d'un salarié serait faux, et
   * l'alerte serait insoluble. Voir le rapport de session.
   */
  formateur_rc_pro_expiree: {
    niveau: "critique",
    titre: "Attestation RC pro d'un formateur expirée",
    resolutionAuto: true,
    guichet: "qualite",
  },
  formateur_rc_pro_expire_j60: {
    niveau: "important",
    titre: "Attestation RC pro d'un formateur expire dans 60 jours",
    resolutionAuto: true,
    guichet: "qualite",
  },

  // ── Sous-traitants ────────────────────────────────────────────────────────
  sous_traitant_qualiopi_expire_j60: {
    niveau: "important",
    titre: "Qualiopi sous-traitant expire dans 60 jours",
    resolutionAuto: true,
    guichet: "qualite",
  },
  sous_traitant_qualiopi_expire: {
    niveau: "critique",
    titre: "Qualiopi sous-traitant expiré (sessions futures en cours)",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "SPEC_PART2 §6.5 — « Non », là où _j60 porte « Oui si renouvelée ». Des sessions futures sont déjà positionnées sur un sous-traitant non certifié : la situation s acquitte, elle ne s efface pas.",
    guichet: "qualite",
  },
  // ── Vigilance sous-traitance (art. 4 et 8 de la procédure) [2026-08-03] ────
  //
  // 🔴 Le contrat-cadre est le SEUL de ces trois manques qui bloque l'indicateur
  // 27 : sans lui, l'intervenant n'est pas compté comme conforme, quelles que
  // soient ses autres pièces. D'où le niveau critique.
  sous_traitant_contrat_cadre_manquant: {
    niveau: "critique",
    titre: "Sous-traitant sans contrat-cadre signé",
    resolutionAuto: true,
    guichet: "direction",
  },
  // ⚠️ ABSENCE de RC pro = « important », pas « critique ». Décision Will du
  // 2026-08-03 : la RC pro n'est PAS exigée à l'entrée, pour ne pas réduire le
  // vivier d'intervenants. Une alerte critique permanente sur un état
  // délibérément accepté apprendrait à ignorer les alertes critiques — et ce
  // sont celles-là qui doivent faire réagir. Cf. PROCEDURE § 4.2.
  sous_traitant_rc_pro_absente: {
    niveau: "important",
    titre: "Sous-traitant sans attestation RC pro",
    resolutionAuto: true,
    guichet: "qualite",
  },
  // 🔴 EXPIRATION, en revanche, est critique : l'attestation existait, elle a
  // été acceptée, et elle est tombée. C'est une régression de vigilance, pas un
  // état accepté.
  sous_traitant_rc_pro_expiree: {
    niveau: "critique",
    titre: "Attestation RC pro sous-traitant expirée",
    resolutionAuto: true,
    guichet: "qualite",
  },
  sous_traitant_rc_pro_expire_j60: {
    niveau: "important",
    titre: "Attestation RC pro sous-traitant expire dans 60 jours",
    resolutionAuto: true,
    guichet: "qualite",
  },
  // Art. 8 : les pièces se revérifient annuellement. Rappel 30 jours avant.
  sous_traitant_verification_annuelle_due: {
    niveau: "important",
    titre: "Vérification annuelle d'un sous-traitant à effectuer",
    resolutionAuto: true,
    guichet: "qualite",
  },
  // Art. 8 : les incidents pèsent à la reconduction. « important » et non
  // « critique » — l'alerte informe, elle n'interdit pas d'affecter.
  sous_traitant_incidents_repetes: {
    niveau: "important",
    titre: "Intervenant externe : incidents répétés",
    resolutionAuto: true,
    guichet: "qualite",
  },

  // ── OPCO / financement ────────────────────────────────────────────────────
  opco_sans_accord: {
    niveau: "important",
    titre: "Session dans 7 jours sans accord OPCO",
    resolutionAuto: true,
    guichet: "direction",
  },
  opco_formation_demarree_sans_accord: {
    niveau: "critique",
    titre: "Formation démarrée sans accord OPCO",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "SPEC_PART2 §6.5 — « Non ». FAIT ACCOMPLI : la formation a démarré sans accord, le risque financier est déjà pris. Un accord obtenu après coup ferait disparaître l alerte comme si de rien n était, alors que c est précisément l écart qu il faut avoir vu.",
    guichet: "direction",
  },
  convention_tripartite_manquante: {
    niveau: "critique",
    titre: "Convention tripartite manquante (subrogation OPCO)",
    resolutionAuto: true,
    guichet: "direction",
  },
  // Référentiel OPCO versionné (Lot 5) : le barème en vigueur d'un OPCO a un
  // relevé portail périmé (> config `bareme_opco_validite_mois`, défaut 12 mois).
  bareme_opco_perime: {
    niveau: "important",
    titre: "Barème OPCO à rafraîchir (relevé trop ancien)",
    resolutionAuto: true,
    guichet: "direction",
  },
  // [T17.1 — S7] Convention de formation (L.6353-1) non établie avant démarrage (off.9).
  convention_formation_manquante: {
    niveau: "critique",
    titre: "Convention de formation manquante avant démarrage",
    resolutionAuto: true,
    guichet: "direction",
  },

  // ── Facturation ───────────────────────────────────────────────────────────
  /**
   * 🔴 PLUS ÉMIS depuis 2026-08-02 — conservé DÉLIBÉRÉMENT, ne pas supprimer.
   *
   * Le palier J30 est déjà couvert par une `RelanceProposee` actionnable dans le
   * hub facturation. Faire tomber les deux pour le même fait créait deux signaux
   * concurrents, avec deux cycles de vie : l'admin envoyait la relance, la
   * proposition passait `envoyee`, et l'alerte restait ouverte à côté sans plus
   * rien vouloir dire. Division du travail retenue (cf. `evaluateur.ts`) :
   * J1/J15/J30 = relance proposée (action) ; J60 = alerte critique (escalade).
   *
   * Pourquoi garder l'entrée : `synchroniserAlertes` ne résout automatiquement
   * que les codes PRÉSENTS dans ce catalogue avec `resolutionAuto: true`. La
   * retirer figerait à vie les alertes `facture_impayee_j30` déjà en base — y
   * compris sur des factures depuis longtemps réglées.
   */
  facture_impayee_j30: {
    niveau: "important",
    titre: "Facture impayée depuis +30 jours",
    resolutionAuto: true,
    guichet: "direction",
  },
  facture_impayee_j60: {
    niveau: "critique",
    titre: "Facture impayée depuis +60 jours",
    resolutionAuto: true,
    guichet: "direction",
  },
  /**
   * Filet de sécurité du circuit de recouvrement.
   *
   * Une facture émise sans `echeanceAt` n'est relançable par RIEN : le cron de
   * retard compare `echeanceAt < now`, et aucune comparaison SQL n'est vraie
   * pour NULL. La créance vieillit sans jamais apparaître nulle part.
   *
   * Le cron répare désormais ces lignes tout seul (cf. `handleFacturesRetard`),
   * mais cette alerte reste utile : elle couvre la fenêtre entre la création et
   * le passage quotidien, et surtout elle DÉNONCE un chemin de création
   * défaillant — si elle revient, c'est qu'un émetteur a de nouveau oublié la
   * colonne. `resolutionAuto` : elle disparaît d'elle-même dès l'échéance posée.
   */
  facture_sans_echeance: {
    niveau: "important",
    titre: "Facture émise sans date d'échéance",
    resolutionAuto: true,
    guichet: "direction",
  },
  /**
   * Relance envoyée, restée sans effet.
   *
   * Demande explicite du propriétaire : « des alertes pour me dire les relances
   * passées ». Envoyer une relance n'est pas un résultat — c'est le résultat qui
   * compte. Une relance partie il y a plus de quinze jours sans le moindre
   * encaissement depuis signale que le palier suivant est dû, ou qu'une décision
   * l'est (échéancier, mise en demeure, recouvrement).
   *
   * `resolutionAuto` : disparaît d'elle-même dès que la facture est soldée.
   */
  relance_sans_effet: {
    niveau: "important",
    titre: "Relance envoyée sans effet depuis +15 jours",
    resolutionAuto: true,
    guichet: "direction",
  },
  /**
   * 🔴 TOUTE LA CHAÎNE DE RECOUVREMENT COMMENCE APRÈS L'ÉMISSION (audit du
   * 2026-09-04, trou n°10).
   *
   * `facture_impayee_j60`, `facture_sans_echeance`, `relance_sans_effet`,
   * `financeur_paiement_en_retard` : les quatre partent d'une
   * `FactureFormation` qui EXISTE. La prestation livrée et jamais facturée est
   * en dehors de leur champ à toutes — et c'est le seul cas où l'argent ne
   * revient pas sans que personne ne le remarque, puisqu'il n'y a pas de ligne
   * à vieillir dans la balance âgée.
   *
   * ⚠️ J+15 après la fin, et pas le lendemain : la clôture, l'émargement et
   * l'attestation passent d'abord, et facturer avant d'avoir clos revient à
   * facturer un effectif qu'on n'a pas encore arrêté.
   *
   * ⚠️ Une session à 0 € n'est jamais candidate : une action financée
   * intégralement hors facture (interne, offerte) n'a rien à émettre, et
   * l'alerte serait insoluble.
   *
   * `direction` : émettre une facture ENGAGE l'organisme — c'est la frontière
   * que `HABILITATIONS` trace, et les trois codes voisins la respectent déjà.
   */
  session_realisee_non_facturee: {
    niveau: "important",
    titre: "Session réalisée jamais facturée",
    resolutionAuto: true,
    guichet: "direction",
  },

  // ── Dossiers de financement (suivi OPCO / France Travail) ────────────────
  // 🔴 2026-07-31 — `echeanceFinanceurAt` existait au schéma (« les OPCO paient
  // à 30-60 j ») et RIEN ne le lisait : un financeur en retard ne déclenchait
  // rien, un dossier envoyé sans réponse restait invisible. Le suivi reposait
  // sur la mémoire de l'admin — exactement ce que le tableau d'alertes existe
  // pour remplacer.
  dossier_financement_sans_reponse: {
    niveau: "important",
    titre: "Dossier de financement envoyé sans réponse depuis +30 jours",
    resolutionAuto: true,
    guichet: "direction",
  },
  financeur_paiement_en_retard: {
    niveau: "critique",
    titre: "Paiement du financeur en retard (échéance dépassée)",
    resolutionAuto: true,
    guichet: "direction",
  },

  // ── IA / système ──────────────────────────────────────────────────────────
  // Émise par le worker engine (qualiopi-formation-engine-worker) sur échec
  // définitif de génération IA (tentatives BullMQ épuisées).
  // 🔴 Audit du 2026-08-01 — titre aligné sur celui réellement écrit par le
  // worker (métier, sans jargon « dead letter queue ») : cette entrée n'est que
  // documentaire (le titre effectif est fixé à la création), mais une
  // divergence induirait en erreur quiconque lit ce catalogue comme référence.
  job_ia_echoue: {
    niveau: "important",
    titre: "Génération IA d'une formation en échec",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — levée par l'échec d'un job, pas par le balayage quotidien : la résolution automatique l'effacerait au tour suivant. Un échec s'acquitte à la main, une fois la cause comprise.",
    guichet: "direction",
  },

  // ── RGPD ──────────────────────────────────────────────────────────────────
  /**
   * 🔴 `info` POUR UN DÉLAI LÉGAL DÉJÀ DÉPASSÉ (audit du 2026-09-04, trou n°10
   * — recalibrage).
   *
   * Le niveau `info` a été relevé comme une erreur de calibrage, et il l'est :
   * l'article 12.3 du RGPD donne UN MOIS pour répondre à une demande
   * d'effacement. Quand cette alerte se lève, le délai n'est pas « bientôt
   * atteint », il est PASSÉ — le manquement est constitué et opposable devant
   * la CNIL. Un niveau `info` range ce fait à côté d'un devis expiré, dans la
   * colonne qu'on parcourt en diagonale.
   *
   * `important` et non `critique` : le critique est réservé, dans ce catalogue,
   * à ce qui empêche une action de se tenir ou fait perdre la certification.
   * Ici l'organisme est en faute et doit répondre sous quelques jours, mais
   * rien ne s'arrête. C'est le même arbitrage que `attestation_non_envoyee`,
   * autre droit du bénéficiaire non honoré.
   */
  suppression_rgpd_j30: {
    niveau: "important",
    titre: "Demande de suppression RGPD non traitée depuis 30 jours",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "SPEC_PART2 §6.5 — « Non ». Une demande d effacement non traitée sous 30 jours est un dépassement de délai RGPD : il reste à documenter même une fois la suppression faite.",
    guichet: "qualite",
  },
  /**
   * 🔴 CINQ CODES ÉMIS SANS ENTRÉE ICI — le défaut du 2026-08-05 était REVENU
   * (audit du 2026-09-04, trou n°5).
   *
   * Le mécanisme est mécanique et il a déjà coûté deux fois : `guichetPourCode`
   * rend `undefined` pour un code inconnu (`routage.ts`), l'alerte est rangée
   * en `sansGuichet` par `envoi-groupe.ts` — elle n'arrive donc dans AUCUNE
   * boîte — et elle est absente de `codesAutoResolution`, donc ouverte pour
   * toujours. Une alerte qui n'atteint personne et ne se ferme jamais est pire
   * qu'une alerte absente : elle occupe la place de celle qui aurait servi.
   *
   * ⚠️ Ces cinq codes naissent d'un GESTE (un envoi retenu, une écriture de
   * corbeille refusée, une réponse hors délai), jamais du balayage quotidien.
   * `resolutionAuto: true` les ferait donc résoudre au premier
   * `synchroniserAlertes`, avant lecture — c'est la garde que
   * `routage.spec.ts` fait respecter pour tous les codes hors balayage.
   */
  email_corbeille_indisponible: {
    niveau: "critique",
    titre: "Un email à relire n'a pas pu être mis en attente — il n'est PAS parti",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — levée par `enqueueEmail` (`server/queue/queues.ts`) quand Postgres refuse l'écriture de la corbeille, jamais par `evaluerAlertes`. Le message N'EST PAS PARTI et ne repartira pas tout seul : l'alerte doit survivre au rétablissement de la base, sinon elle disparaîtrait à l'instant précis où le renvoi devient possible.",
    guichet: "administratif",
  },
  /**
   * Le positionnement d'entrée répondu APRÈS le début de la session.
   *
   * ⚠️ À ne pas confondre avec `positionnement_sans_reponse`, qui garde à J-2
   * pendant qu'il est encore temps. Celui-ci CONSTATE : la réponse est arrivée,
   * mais elle est datée après la formation, et aucune évaluation initiale n'a
   * donc été versée au dossier (indicateur 4). Le geste n'est pas le même —
   * relancer d'un côté, documenter l'impossibilité de l'autre.
   */
  positionnement_hors_delai: {
    niveau: "important",
    titre: "Positionnement d'entrée répondu après le début de la session",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "IRRÉVERSIBLE — la date de réponse ne changera pas, et une évaluation « avant formation » datée après la formation ne redeviendra jamais recevable. La condition ne peut pas disparaître : l'écart s'acquitte à la main, une fois le positionnement recueilli autrement ou son impossibilité notée au dossier.",
    guichet: "qualite",
  },
  /**
   * Trois codes pour trois motifs de retenue, et non un seul — le geste diffère.
   *
   * `rebond_dur` appelle une CORRECTION d'adresse puis un renvoi : tant qu'elle
   * n'est pas faite, la personne ne recevra ni convocation, ni attestation, ni
   * facture. `desabonne` et `oppose` n'appellent RIEN : le retrait est honoré,
   * l'alerte est une trace. Les fondre en un code unique obligerait à lire le
   * message pour savoir s'il y a quelque chose à faire.
   */
  email_retenu_rebond_dur: {
    niveau: "important",
    titre: "Envoi retenu : l'adresse a déjà rebondi définitivement",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — levée par `retenirSiNecessaire` (`server/email/suppression.ts`) à l'instant de l'envoi, jamais par `evaluerAlertes`. Corriger l'adresse ne renvoie pas le message retenu : l'alerte doit rester ouverte jusqu'à ce que quelqu'un ait réémis l'envoi depuis son écran d'origine.",
    guichet: "administratif",
  },
  email_retenu_desabonne: {
    niveau: "important",
    titre: "Envoi marketing retenu : la personne s'est désabonnée",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — levée à l'instant de l'envoi, jamais par `evaluerAlertes`. Aucune action n'est attendue (le retrait est honoré) : l'alerte est une TRACE, et une trace que la mécanique effacerait au tour suivant ne prouverait rien.",
    guichet: "administratif",
  },
  email_retenu_oppose: {
    niveau: "important",
    titre: "Envoi marketing retenu : la personne s'est opposée à la prospection",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — levée à l'instant de l'envoi, jamais par `evaluerAlertes`. Comme `email_retenu_desabonne`, c'est une trace d'opposition honorée : elle doit survivre au balayage qui ne la voit pas.",
    guichet: "administratif",
  },

  // ── Pilotage — cadence trimestrielle (LOT 4) ──────────────────────────────
  // Non bloquante (décision B4) : gatée par la clé de config
  // `revue_trimestrielle_activee` (défaut true).
  revue_trimestrielle_a_faire: {
    niveau: "info",
    titre: "Revue trimestrielle à réaliser",
    resolutionAuto: true,
    guichet: "qualite",
  },

  // ── Chaîne d'envoi d'e-mails (audit du 2026-08-16) ────────────────────────
  //
  // Ces deux codes sont émis par `verifierSanteEmails()` (server/email/health.ts),
  // appelé par le cron horaire `formation-crons.email-sante`. Ils comblent le
  // trou le plus coûteux du système : jusqu'ici, RIEN ne lisait `email_logs` à
  // la recherche d'échecs, et Sentry n'a jamais reçu une seule erreur de worker.
  // Un mot de passe SMTP expiré coupait donc tous les envois en silence.
  //
  // ⚠️ `resolutionAuto: false` pour les deux, et c'est STRUCTUREL — même piège
  // que `besoin_adaptation_declare` ci-dessus. Ces alertes ne naissent pas du
  // balayage de `evaluerAlertes()` mais d'un cron distinct ; les passer à `true`
  // les ferait résoudre par le premier `synchroniserAlertes` venu, avant même
  // que quiconque les ait lues. Elles se résolvent à la main, une fois la
  // chaîne réparée et un envoi de contrôle passé.
  //
  // `critique` assumé pour les deux : la chaîne porte convocations, attestations
  // et questionnaires — les indicateurs 4, 9, 11, 30 et 32 en dépendent. Il n'y
  // a pas de version « on verra demain » d'une convocation non partie.
  emails_en_echec: {
    niveau: "critique",
    titre: "Envois d'e-mails en échec",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — levée par la sonde de santé e-mail (`server/email/health.ts`), jamais par `evaluerAlertes`. La passer à `true` la ferait résoudre au premier `synchroniserAlertes`, alors que le relais est peut-être toujours injoignable.",
    guichet: "direction",
  },
  emails_bloques_en_file: {
    niveau: "critique",
    titre: "E-mails enfilés mais jamais envoyés",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — même origine que `emails_en_echec` : la sonde de santé e-mail, hors du balayage quotidien.",
    guichet: "direction",
  },
  // ── Trois codes que la sonde levait SANS être déclarés ici (2026-08-31).
  //
  // La sonde `server/email/health.ts` lève cinq codes ; ce catalogue n'en
  // connaissait que deux. Les trois autres arrivaient donc en console sans
  // niveau, sans guichet et sans titre de référence — c'est-à-dire sans
  // personne à qui les adresser. Le contrôle
  // `la-sonde-et-le-catalogue-ne-divergent-pas.spec.ts` DÉRIVE désormais la
  // liste de la sonde elle-même : un sixième code ne pourra plus arriver muet.
  emails_sante_non_mesurable: {
    // 🔑 `critique`, et ce n'est pas un excès de zèle. Cette alerte ne dit pas
    // qu'un envoi a échoué : elle dit que PLUS RIEN n'est mesurable. Tant
    // qu'elle est ouverte, l'absence des quatre autres alertes ne prouve rien.
    // C'est l'alerte qui invalide les autres — la sous-classer reviendrait à
    // ranger derrière les constats celle qui les rend caducs.
    niveau: "critique",
    titre: "La surveillance des e-mails n'a rien pu mesurer",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — levée par la sonde de santé e-mail, hors du balayage d'`evaluerAlertes`. Et surtout : elle doit être fermée à la main APRÈS un envoi de contrôle, sinon on résoudrait l'aveu d'aveuglement sans avoir rien vérifié.",
    guichet: "direction",
  },
  emails_approuves_abandonnes: {
    // Lot 3 (audit e-mails 2026-09-02). La transition « à valider → approuvé »
    // est commitée AVANT la mise en file : si le conteneur meurt entre les deux
    // (redéploiement), la ligne reste « approuvé », invisible des deux listes de
    // la corbeille, ni ré-approuvable ni refusable. Le contrôle horaire les
    // remet en attente et lève ce code.
    niveau: "critique",
    titre: "Des e-mails approuvés ne sont jamais partis",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — levée par la sonde de santé e-mail, hors du balayage d'`evaluerAlertes`. Le balayage a remis ces e-mails dans la corbeille ; ce qui ferme l'alerte, c'est de les RELIRE et de les approuver de nouveau, pas leur retour en liste.",
    guichet: "direction",
  },
  emails_rebonds: {
    niveau: "critique",
    titre: "E-mails rejetés par le destinataire",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — même origine que `emails_en_echec` : la sonde de santé e-mail. Un rebond ne « disparaît » pas de lui-même : il se traite (adresse corrigée, destinataire recontacté autrement), et c'est ce geste-là qui ferme l'alerte.",
    guichet: "direction",
  },
  emails_rebonds_non_detectes: {
    // Même raisonnement que `emails_sante_non_mesurable` : ce code dit que
    // l'INSTRUMENT est débranché, pas qu'un rebond a eu lieu. Tant qu'il est
    // ouvert, un compteur de rebonds à zéro ne veut rien dire.
    niveau: "critique",
    titre: "Aucun rebond d'e-mail ne peut être détecté",
    resolutionAuto: false,
    motifSansResolutionAuto:
      "STRUCTUREL — la sonde la lève tant que `ZEPTOMAIL_WEBHOOK_KEY` est absente. Elle se ferme quand la clé est posée ET qu'un rebond de contrôle a été reçu — pas avant, sous peine de refermer sur un instrument toujours muet.",
    guichet: "direction",
  },
} as const;

/**
 * Convertit un niveau de spec (CRITIQUE/IMPORTANT/INFO) vers l'enum Prisma.
 * Insensible à la casse.
 */
export function niveauFromSpec(s: string): AlerteNiveau {
  switch (s.toUpperCase()) {
    case "CRITIQUE":
      return "critique";
    case "IMPORTANT":
      return "important";
    default:
      return "info";
  }
}
