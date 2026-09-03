/**
 * Le catalogue des e-mails — ce que la console affiche à côté de chaque aperçu.
 *
 * ## Pourquoi il existe
 *
 * 44 gabarits vivent dans `src/lib/email/templates/`, et rien ne disait quand
 * chacun partait ni qui le recevait. Pour le savoir il fallait chercher son
 * appelant dans le code — donc personne ne le savait, et cinq gabarits ont pu
 * cesser d'être envoyés sans que ça se voie.
 *
 * ## 🔑 L'EXHAUSTIVITÉ EST GARANTIE PAR LE TYPE, PAS PAR MA VIGILANCE
 *
 * `Record<EmailJobName, FicheEmail>` : ajouter un gabarit à l'union sans
 * l'inscrire ici **ne compile pas**. C'est plus fort qu'un test — l'erreur
 * arrive à l'écriture, pas à l'exécution.
 *
 * ## ⚠️ CE QUI EST DÉCLARÉ ICI PEUT MENTIR — d'où la garde
 *
 * `quand` et `source` sont écrits à la main : ils décrivent le code, mais rien
 * dans le type ne les y attache. `catalogue.spec.ts` confronte donc chaque
 * `source` déclarée aux appelants RÉELS, retrouvés en scannant `src/`. Un
 * appelant qui déménage, un gabarit qu'on cesse d'envoyer : la garde rougit.
 *
 * 🔴 Le scan doit voir les appels **sur plusieurs lignes** :
 *
 * ```ts
 * const envoi = await enqueueEmail(
 *   "qualiopi-convocation",
 * ```
 *
 * Un motif d'une seule ligne en manque 25 sur 44 — et conclut « jamais
 * envoyés » pour des gabarits que le worker envoie sous vos yeux. C'est
 * l'erreur commise le 2026-08-28 avant d'écrire ce fichier.
 */

import type { EmailJobName } from "@/server/queue/types";

export type CategorieEmail =
  "rendez-vous" | "formation" | "commerce" | "recrutement" | "rgpd" | "divers";

export const LIBELLE_CATEGORIE: Readonly<Record<CategorieEmail, string>> = {
  "rendez-vous": "Rendez-vous & Calendly",
  formation: "Formation (Qualiopi)",
  commerce: "Commerce & facturation",
  recrutement: "Recrutement",
  rgpd: "RGPD",
  divers: "Divers",
};

export interface FicheEmail {
  readonly categorie: CategorieEmail;
  /** Ce qui déclenche l'envoi, en français, du point de vue métier. */
  readonly quand: string;
  /** À qui il arrive. « interne » = à nous, pas au client. */
  readonly destinataire: string;
  /**
   * Le fichier qui l'envoie, sans le préfixe `src/`.
   *
   * `null` = **dormant** : aucun appelant. Ce n'est pas une omission, c'est un
   * constat mesuré, et la garde le vérifie dans les DEUX sens — un dormant qui
   * se met à être envoyé rougit aussi.
   */
  readonly source: string | null;
}

export const CATALOGUE: Readonly<Record<EmailJobName, FicheEmail>> = {
  // ── Rendez-vous & Calendly ────────────────────────────────────────────────
  "appel-confirme": {
    categorie: "rendez-vous",
    quand: "Dès que la réservation est vue par le worker (≤ 5 min après)",
    destinataire: "la personne qui a réservé",
    source: "server/calendly/rappels-appel.ts",
  },
  "appel-rappel-j1": {
    categorie: "rendez-vous",
    quand: "La veille de l'appel — fenêtre 24 h → 24 h 15 avant",
    destinataire: "la personne qui a réservé",
    source: "server/calendly/rappels-appel.ts",
  },
  "appel-rappel": {
    categorie: "rendez-vous",
    quand: "Une heure avant l'appel — fenêtre H-75 → H-60",
    destinataire: "la personne qui a réservé",
    source: "server/calendly/rappels-appel.ts",
  },
  "audit-confirmed": {
    categorie: "rendez-vous",
    quand: "Formulaire /contact envoyé, demande de type « audit »",
    destinataire: "le demandeur",
    source: "features/unified-contact/actions.ts",
  },
  "implementation-confirmed": {
    categorie: "rendez-vous",
    quand: "Formulaire /contact envoyé, demande de type « implémentation »",
    destinataire: "le demandeur",
    source: "features/unified-contact/actions.ts",
  },
  "contact-confirmed": {
    categorie: "rendez-vous",
    quand: "Formulaire /contact envoyé, demande générale",
    destinataire: "le demandeur",
    source: "features/unified-contact/actions.ts",
  },
  "cancellation-confirmed-by-user": {
    categorie: "rendez-vous",
    quand: "Rien ne l'envoie — l'annulation est gérée par Calendly",
    destinataire: "—",
    source: null,
  },

  // ── Formation (Qualiopi) ──────────────────────────────────────────────────
  "qualiopi-convocation": {
    categorie: "formation",
    quand: "Convocation à une session, cron quotidien (J-5)",
    destinataire: "le stagiaire",
    source: "server/qualiopi/notifications/notifications-service.ts",
  },
  "qualiopi-rappel-j7": {
    categorie: "formation",
    quand: "7 jours avant le début de la session",
    destinataire: "le stagiaire",
    source: "server/qualiopi/notifications/notifications-service.ts",
  },
  "qualiopi-positionnement": {
    categorie: "formation",
    quand: "Questionnaire de positionnement, avant l'entrée en formation",
    destinataire: "le stagiaire",
    source: "server/qualiopi/notifications/notifications-service.ts",
  },
  "qualiopi-emargement-lien": {
    categorie: "formation",
    quand: "Le jour même, lien d'émargement de la journée",
    destinataire: "le stagiaire",
    source: "server/qualiopi/emargement/envoi-liens.ts",
  },
  "qualiopi-satisfaction-j1": {
    categorie: "formation",
    quand: "Le lendemain de la fin de session",
    destinataire: "le stagiaire",
    source: "server/qualiopi/notifications/notifications-service.ts",
  },
  "qualiopi-suivi-j30": {
    categorie: "formation",
    quand: "30 jours après la fin de session",
    destinataire: "le stagiaire",
    source: "server/qualiopi/notifications/notifications-service.ts",
  },
  "qualiopi-attestation-disponible": {
    categorie: "formation",
    quand: "Quand l'attestation de fin de formation est émise",
    destinataire: "le stagiaire",
    source: "server/qualiopi/notifications/notifications-service.ts",
  },
  "qualiopi-enquete-entreprise": {
    categorie: "formation",
    quand: "Enquête de satisfaction, versant entreprise",
    destinataire: "l'entreprise cliente — jamais un stagiaire particulier",
    source: "server/qualiopi/notifications/notifications-service.ts",
  },
  "qualiopi-questionnaire-relance": {
    categorie: "formation",
    quand: "Relance d'un questionnaire resté sans réponse",
    destinataire: "le stagiaire",
    source: "server/qualiopi/notifications/notifications-service.ts",
  },
  "qualiopi-portail-acces": {
    categorie: "formation",
    quand: "Ouverture d'un accès au portail stagiaire",
    destinataire: "le stagiaire",
    source: "server/qualiopi/portail/portail-service.ts",
  },
  "qualiopi-relance-impayee": {
    categorie: "formation",
    quand: "Relance d'impayé, déclenchée à la main depuis le hub facturation",
    destinataire: "le débiteur — client OU OPCO selon la subrogation",
    source: "server/actions/qualiopi/facturation-hub.ts",
  },
  "qualiopi-alerte-interne": {
    categorie: "formation",
    quand: "Anomalie détectée sur la chaîne Qualiopi",
    destinataire: "interne",
    source: "server/qualiopi/alertes/envoi-groupe.ts",
  },

  // ── Commerce & facturation ────────────────────────────────────────────────
  "devis-envoi": {
    categorie: "commerce",
    quand: "Envoi d'un devis — passe par la corbeille de validation",
    destinataire: "le client",
    source: "server/actions/qualiopi/facturation-emails.ts",
  },
  "convention-envoi": {
    categorie: "commerce",
    quand: "Envoi de la convention à signer — passe par la corbeille",
    destinataire: "le client",
    source: "server/actions/qualiopi/piece-lien-signature.ts",
  },
  "facture-envoi": {
    categorie: "commerce",
    quand: "Émission d'une facture — passe par la corbeille de validation",
    destinataire: "le client",
    source: "server/actions/qualiopi/facturation-emails.ts",
  },
  "quote-request-received": {
    categorie: "commerce",
    quand: "Formulaire /contact envoyé, demande de devis",
    destinataire: "le demandeur",
    source: "features/unified-contact/actions.ts",
  },
  "payment-link": {
    categorie: "commerce",
    quand: "Rien ne l'envoie — Stripe est gelé",
    destinataire: "—",
    source: null,
  },
  "payment-receipt": {
    categorie: "commerce",
    quand: "Rien ne l'envoie — Stripe est gelé",
    destinataire: "—",
    source: null,
  },
  "payment-failed": {
    categorie: "commerce",
    quand: "Rien ne l'envoie — Stripe est gelé",
    destinataire: "—",
    source: null,
  },

  // ── Recrutement ───────────────────────────────────────────────────────────
  "candidature-recue": {
    categorie: "recrutement",
    quand: "Candidature déposée sur une offre d'emploi",
    destinataire: "le candidat",
    source: "features/job-application/actions.ts",
  },
  "candidature-commercial-confirmee": {
    categorie: "recrutement",
    quand: "Candidature commerciale déposée",
    destinataire: "le candidat",
    source: "features/commercial-application/actions.ts",
  },
  "candidature-commercial-recap": {
    categorie: "recrutement",
    quand: "Même dépôt que ci-dessus — la copie qui nous revient",
    destinataire: "interne",
    source: "features/commercial-application/actions.ts",
  },
  "lead-apporteur-recu": {
    categorie: "recrutement",
    quand: "Premier contact déposé sur la landing Facebook (formulaire court)",
    destinataire: "le candidat apporteur",
    source: "features/commercial-application/lead-actions.ts",
  },
  "lead-apporteur-relance": {
    categorie: "recrutement",
    quand: "J+2 puis J+7 après le premier contact, si le dossier complet n'est pas arrivé",
    destinataire: "le candidat apporteur",
    source: "features/commercial-application/relances-lead-apporteur.ts",
  },
  "vivier-information": {
    categorie: "recrutement",
    quand: "Information envoyée à une personne du vivier",
    destinataire: "le candidat en vivier",
    source: "server/vivier/stock.ts",
  },
  "formateur-magic-link": {
    categorie: "recrutement",
    quand: "Connexion sans mot de passe d'un formateur à son espace",
    destinataire: "le formateur",
    source: "server/actions/formateur/auth.actions.ts",
  },

  // ── RGPD ──────────────────────────────────────────────────────────────────
  "rgpd-demande-recue": {
    categorie: "rgpd",
    quand: "Accusé de réception d'une demande RGPD",
    destinataire: "la personne concernée",
    source: "server/qualiopi/portail/rgpd-service.ts",
  },
  "rgpd-effacement-confirme": {
    categorie: "rgpd",
    quand: "Effacement effectué, confirmation",
    destinataire: "la personne concernée",
    source: "app/api/gdpr-erase/route.ts",
  },
  "gdpr-export-link": {
    categorie: "rgpd",
    quand: "Lien d'export des données personnelles",
    destinataire: "la personne concernée",
    source: "app/api/gdpr-export/request/route.ts",
  },

  // ── Divers ────────────────────────────────────────────────────────────────
  "submission-reply": {
    categorie: "divers",
    quand: "Réponse écrite À LA MAIN par Will depuis la console — aucun LLM",
    destinataire: "l'auteur du message",
    source: "features/admin-submissions/reply-actions.ts",
  },
  "avis-recu": {
    categorie: "divers",
    quand: "Un avis client vient d'être soumis",
    destinataire: "l'auteur de l'avis",
    source: "features/review-submission/actions.ts",
  },
  "roi-report": {
    categorie: "divers",
    quand: "Rapport du simulateur de gains, à la demande",
    destinataire: "le demandeur",
    source: "features/roi-report/actions.ts",
  },
  "rappel-confirme": {
    categorie: "divers",
    quand: "Rappel confirmé depuis le parcours du simulateur de gains",
    destinataire: "le demandeur",
    source: "features/roi-report/actions.ts",
  },
  "chatbot-demande-transmise": {
    categorie: "divers",
    quand: "Le chatbot escalade une question ou capture un contact",
    destinataire: "le visiteur",
    source: "server/chatbot/tools/escalader-question.ts",
  },
  "podcast-demande-recue": {
    categorie: "divers",
    quand: "Demande de participation au podcast",
    destinataire: "le demandeur",
    source: "features/podcast-request/actions.ts",
  },
  "newsletter-confirm-optin": {
    categorie: "divers",
    quand: "Inscription newsletter — double opt-in, confirmation à cliquer",
    destinataire: "l'inscrit",
    source: "features/newsletter/actions.ts",
  },
  "ressources-magic-link": {
    categorie: "divers",
    quand: "Accès sans mot de passe à l'espace ressources",
    destinataire: "le visiteur inscrit",
    source: "server/actions/ressources/auth.actions.ts",
  },
  "documents-nouvelle-version": {
    categorie: "divers",
    quand: "Nouvelle version d'un document d'intervention",
    destinataire: "le client",
    source: "server/intervention-documents/notifications.ts",
  },
  "force-majeure-notice": {
    categorie: "divers",
    quand: "Rien ne l'envoie — gabarit écrit, jamais branché",
    destinataire: "—",
    source: null,
  },
};

/** Les gabarits que rien n'envoie. Dérivé, jamais recopié. */
export const DORMANTS: ReadonlyArray<EmailJobName> = (
  Object.keys(CATALOGUE) as EmailJobName[]
).filter((n) => CATALOGUE[n].source === null);
