/**
 * Annonce publique de l'enregistrement des visios — SOURCE UNIQUE (chantier
 * visio, PR 8 « mise en service », V-15 ; ADR 0055 et 0056).
 *
 * ## Ce que ce module décide
 *
 * Tout ce que le site DIT de l'enregistrement des rendez-vous — la section
 * « Rendez-vous de découverte » de la politique de confidentialité, les
 * phrases « aucune donnée personnelle n'est transmise aux modèles d'IA » de
 * `/politique-confidentialite`, `/sous-processeurs` et `/transparence`, les
 * lignes Google Meet et Cloudflare de la liste des sous-traitants, la phrase de
 * la confirmation d'un rendez-vous en visio — bascule sur UN interrupteur :
 * `ETAT_COMPTES_RENDUS_VISIO`.
 *
 * Tant qu'il vaut `pending_activation`, le site dit exactement ce qu'il disait
 * avant ce chantier : les rendez-vous ne sont ni enregistrés ni transcrits.
 * C'est VRAI tant que rien n'est enregistré, et c'est la promesse que la garde
 * `la-notice-ne-retarde-pas-sur-la-visio.spec.ts` exige alors.
 *
 * Le jour où il passe à `active`, toutes ces phrases changent ENSEMBLE, dans
 * la même mise en ligne. Aucune ne peut rester en arrière : les gardes de
 * `src/content/__tests__/` rougissent sur la première qui promettrait encore
 * l'absence d'enregistrement ou d'IA.
 *
 * ## Pourquoi un interrupteur et pas un texte réécrit tout de suite
 *
 * Le texte « après » est ÉCRIT ici, relisible par Will, mais il ne s'affiche
 * pas encore. Réciproquement, le drapeau d'exécution `ouvert` n'enregistre
 * aucun vrai client tant que cet interrupteur n'a pas basculé
 * (`modeEffectif`, `src/server/visio/ouverture.ts`) : le site ne peut ni
 * promettre l'absence d'enregistrement pendant qu'on enregistre, ni annoncer
 * un enregistrement qui n'est pas en service. Le préavis de 30 jours ne
 * conditionne plus l'ouverture (décision de Will du 29/09) : il bloque les
 * seules rencontres des clients actifs, route par route (PR 5).
 *
 * Passer à `active` suppose, dans cet ordre (LOTS-EXECUTION §5, PR 8) :
 *   1. le texte ci-dessous LU ET ACCEPTÉ par Will (point d'arrêt : texte lu par
 *      un client) ;
 *   2. le DPA d'OpenAI signé et le partage pour l'entraînement désactivé
 *      (geste de Will dans platform.openai.com) — l'entrée « OpenAI, LLC
 *      (comptes rendus de rendez-vous) » porte alors un `dpaStatus` différent
 *      de `pending`, ce que la garde
 *      `aucun-destinataire-de-la-parole-actif-sans-cadre-ecrit.spec.ts` exige ;
 *   3. une PR d'une ligne qui change la constante ci-dessous.
 *
 * Ce module est PUR (aucun import d'exécution) : il est lu par les pages
 * publiques, par les gabarits d'e-mail et par le circuit.
 */

/** Nom EXACT de l'entrée de `subprocessors.ts` qui reçoit la parole des rendez-vous. */
export const NOM_ENTREE_COMPTES_RENDUS_VISIO = "OpenAI, LLC (comptes rendus de rendez-vous)";

/**
 * 🔑 L'INTERRUPTEUR. L'entrée `NOM_ENTREE_COMPTES_RENDUS_VISIO` de
 * `subprocessors.ts` doit porter CETTE valeur dans `activationStatus` (garde
 * `le-destinataire-des-comptes-rendus-suit-le-module-openai.spec.ts`).
 */
// `as` et non une annotation : une annotation laisserait TypeScript réduire le
// type à la seule valeur écrite, et la comparaison ci-dessous ne compilerait plus.
export const ETAT_COMPTES_RENDUS_VISIO = "pending_activation" as "active" | "pending_activation";

/** Vrai quand le site annonce l'enregistrement des visios. */
export const ANNONCE_VISIO_ACTIVE: boolean = ETAT_COMPTES_RENDUS_VISIO === "active";

/**
 * B5 (Will, 28/09, « 1 ET 2 ») : « Discutons de votre projet IA » se tient en
 * Google Meet SEULEMENT. Le site cesse de promettre le téléphone ; le réglage
 * de Calendly est un geste de Will, APRÈS la mise en ligne. Les rendez-vous
 * téléphoniques déjà pris restent servis (branche téléphone de
 * `appel-rappel.tsx` conservée).
 */
export const DISCUTONS_MEET_SEUL = true;

/**
 * La dictée après un appel téléphonique (B5, B14 : intérêt légitime 6.1.f)
 * n'est annoncée que par le texte « après » de la notice. Elle n'est donc
 * utilisable que si ce texte est publié : DÉRIVÉ, jamais réglé à la main
 * (garde `la-dictee-n-est-active-que-si-la-notice-la-mentionne.spec.ts`).
 */
export const DICTEE_ANNONCEE: boolean = ANNONCE_VISIO_ACTIVE;

/**
 * Durées de conservation annoncées (B1, ADR 0056). La notice les écrit en
 * toutes lettres ; la purge (`src/lib/rgpd-erase.ts`, planifiée par
 * `retention-purge-worker.ts`) les applique. La garde
 * `une-duree-annoncee-a-sa-purge.spec.ts` relit la notice et compare.
 */
export const CONSERVATION_VISIO = {
  /**
   * Son : effacé à la validation du compte rendu, au plus tard (jours). SOURCE
   * UNIQUE : le préavis (`CONSERVATION_SON_MAX_JOURS`) en dérive.
   */
  audioJoursMax: 30,
  /** Segments de transcription, après le rendez-vous (mois). */
  segmentsMois: 12,
  /** Dossier d'un prospect, après la dernière rencontre (ans). */
  prospectAns: 3,
  /** Dossier d'un client, après la dernière activité commune (ans). */
  clientAns: 5,
  /** Versions remplacées ou rejetées d'un compte rendu (jours). */
  versionsJours: 90,
  /** Contenu d'un fait rejeté (jours). */
  faitsRejetesJours: 30,
  /** Preuve d'accord, après la fin de conservation du dossier (ans). */
  preuvesApresDossierAns: 5,
} as const;

type Etat = "avant" | "apres";
const etat = (actif: boolean): Etat => (actif ? "apres" : "avant");

// ═════════════════════════════════════════════════════════════════════════════
// POLITIQUE DE CONFIDENTIALITÉ — section « Rendez-vous de découverte »
// ═════════════════════════════════════════════════════════════════════════════

const RDV_DECOUVERTE = {
  avant: {
    fr: "Le rendez-vous de premier contact réservé depuis la page /appel se tient en visioconférence Google Meet. Un lien de réunion vous est transmis avec la confirmation ; la réunion se déroule sur ce service tiers, dont la localisation et le cadre de transfert figurent sur /sous-processeurs. Ces rendez-vous ne sont ni enregistrés ni transcrits : aucune captation audio ou vidéo n'est réalisée, et il n'existe donc aucun enregistrement à conserver ou à demander. Seules les informations que vous saisissez au moment de la réservation — nom, adresse e-mail, téléphone et réponses aux questions du formulaire — sont conservées, dans les conditions décrites ci-dessus.",
    en: "The first-contact appointment booked from the /appel page is held by Google Meet video conference. A meeting link is sent to you with the confirmation; the meeting takes place on that third-party service, whose location and transfer framework are listed on /subprocessors. These appointments are neither recorded nor transcribed: no audio or video capture is made, so there is no recording to keep or to request. Only the information you enter when booking — name, email address, phone number and answers to the form questions — is kept, under the conditions described above.",
  },
  apres: {
    fr: "Le rendez-vous de premier contact réservé depuis la page /appel, comme les rendez-vous qui suivent pour un même projet, se tient en visioconférence Google Meet, gratuit et sans engagement. Le lien de réunion vous est transmis avec la confirmation ; la réunion se déroule sur ce service tiers, dont la localisation et le cadre de transfert figurent sur /sous-processeurs. Enregistrement, seulement avec votre accord : au début de la réunion, Williams vous demande de vive voix, à vous comme à chaque participant, si vous acceptez que l'échange soit enregistré pour en tirer un compte rendu fidèle, puis il confirme cet accord. Sans accord, rien n'est enregistré, et le rendez-vous a lieu exactement de la même façon ; vous pouvez aussi demander l'arrêt à tout moment. Aucun assistant ne rejoint la réunion : l'enregistrement est réalisé depuis le poste de Williams, en deux pistes (sa voix d'un côté, celle des autres participants de l'autre). Où va le son : il transite par nos serveurs (Hetzner, Allemagne, derrière Cloudflare) et il est conservé chiffré dans le stockage de Cloudflare au plus tard 30 jours ; il est effacé dès que le compte rendu est validé. Il est transcrit, puis le texte est analysé, par OpenAI, LLC (États-Unis ; transfert encadré par les clauses contractuelles types de la Commission européenne). OpenAI ne conserve pas le son transmis pour la transcription, conserve le texte analysé au plus 30 jours dans ses journaux de lutte contre les abus, et n'entraîne pas ses modèles sur ces données. Ce que nous en faisons : un compte rendu, relu et validé par Williams, et les informations utiles à votre projet (besoins, contraintes, délais, financement…), rangées projet par projet dans votre dossier client, chacune avec la phrase dont elle est tirée ; elles servent à préparer nos échanges suivants, nos propositions, nos devis et les questionnaires qui font avancer votre projet. Aucune décision vous concernant n'est prise de façon automatisée, et aucune analyse de votre voix, de votre visage ou de vos émotions n'est réalisée. Base légale : votre consentement (RGPD art. 6.1.a). Vous pouvez retirer votre accord à tout moment, en le disant pendant la réunion ou en écrivant à contact@axion-ia.com, sans effet sur ce qui a été fait avant le retrait (art. 7.3) ; l'enregistrement, sa transcription et les comptes rendus qui en sont tirés sont alors effacés, seule la preuve de votre accord initial étant conservée. Conservation : son, au plus tard 30 jours ; transcription, 12 mois après le rendez-vous ; compte rendu et informations tirées de l'échange, 3 ans après notre dernier rendez-vous si vous n'êtes pas devenu client, 5 ans après notre dernière activité commune (rendez-vous, facture, devis signé) si vous l'êtes ; versions remplacées ou rejetées d'un compte rendu, 90 jours ; preuve de votre accord (date, version du texte annoncé), 5 ans après la fin de la conservation de votre dossier. Personnes mentionnées : si vous parlez d'un collègue ou d'une autre personne pendant l'échange, ce qui la concerne est traité de la même façon, et elle dispose des mêmes droits (art. 14), en écrivant à contact@axion-ia.com. Dictée : après un rendez-vous téléphonique (ceux qui étaient déjà pris), Williams peut dicter un résumé ; il est transcrit et analysé par OpenAI dans les mêmes conditions, et l'appel lui-même n'est jamais enregistré. Cette dictée repose sur notre intérêt légitime (art. 6.1.f) à tenir un dossier fidèle de nos échanges ; vous pouvez vous y opposer. Vos droits : accès (art. 15), rectification (art. 16), effacement (art. 17), opposition au traitement par un modèle d'IA (art. 21), limitation et portabilité, en écrivant à contact@axion-ia.com ; vous pouvez aussi saisir la CNIL. Les informations saisies à la réservation (nom, adresse e-mail, téléphone et réponses aux questions du formulaire) sont conservées dans les conditions décrites plus haut, que vous acceptiez ou non l'enregistrement.",
    en: "The first-contact appointment booked from the /appel page, and any follow-up appointment for the same project, is held by Google Meet video conference, free and without commitment. The meeting link is sent to you with the confirmation; the meeting takes place on that third-party service, whose location and transfer framework are listed on /subprocessors. Recording, only with your consent: at the start of the meeting, Williams asks you out loud, and every other participant, whether you agree to the conversation being recorded so as to produce an accurate summary, then confirms that agreement. Without it, nothing is recorded and the meeting goes ahead exactly the same; you may also ask us to stop at any time. No bot joins the meeting: the recording is made from Williams's computer, on two tracks (his voice on one, the other participants' on the other). Where the audio goes: it passes through our servers (Hetzner, Germany, behind Cloudflare) and is kept encrypted in Cloudflare storage for 30 days at most; it is deleted as soon as the summary is approved. It is transcribed, and the text then analysed, by OpenAI, LLC (United States; transfer under the European Commission's Standard Contractual Clauses). OpenAI does not keep the audio sent for transcription, keeps the analysed text for at most 30 days in its abuse-monitoring logs, and does not train its models on this data. What we do with it: a summary, reviewed and approved by Williams, and the facts useful to your project (needs, constraints, deadlines, funding…), filed project by project in your client record, each with the sentence it comes from; they are used to prepare our next exchanges, proposals, quotes and questionnaires. No automated decision is taken about you, and no analysis of your voice, face or emotions is carried out. Legal basis: your consent (GDPR art. 6.1.a). You may withdraw your consent at any time, by saying so during the meeting or by writing to contact@axion-ia.com, without affecting what was done before (art. 7.3); the recording, its transcript and the summaries drawn from it are then erased, and only the proof of your initial consent is kept. Retention: audio, 30 days at most; transcript, 12 months after the meeting; summary and facts drawn from the conversation, 3 years after our last meeting if you have not become a client, 5 years after our last joint activity (meeting, invoice, signed quote) if you have; replaced or rejected versions of a summary, 90 days; proof of your consent (date, version of the text announced), 5 years after the end of the retention of your record. People mentioned: if you talk about a colleague or another person during the conversation, what concerns them is processed the same way, and they have the same rights (art. 14), by writing to contact@axion-ia.com. Dictation: after a phone appointment (those already booked), Williams may dictate a summary; it is transcribed and analysed by OpenAI under the same conditions, and the call itself is never recorded. This dictation rests on our legitimate interest (art. 6.1.f) in keeping an accurate record of our exchanges; you may object to it. Your rights: access (art. 15), rectification (art. 16), erasure (art. 17), objection to processing by an AI model (art. 21), restriction and portability, by writing to contact@axion-ia.com; you may also lodge a complaint with the CNIL. The information entered when booking (name, email address, phone number and answers to the form questions) is kept under the conditions described above, whether or not you accept the recording.",
  },
} as const;

/** Texte de la section « Rendez-vous de découverte » / « Discovery appointments ». */
export function sectionRendezVousDecouverte(locale: "fr" | "en", actif = ANNONCE_VISIO_ACTIVE) {
  return RDV_DECOUVERTE[etat(actif)][locale];
}

// ═════════════════════════════════════════════════════════════════════════════
// POLITIQUE DE CONFIDENTIALITÉ — compléments des autres sections (T3 à T8)
// Chaîne vide = rien à ajouter tant que l'annonce n'est pas active.
// ═════════════════════════════════════════════════════════════════════════════

const COMPLEMENTS = {
  avant: {
    fr: {
      donnees: "",
      finalites: "",
      baseLegale: "",
      conservation: "",
      hebergementIA:
        " Aucune donnée personnelle de visiteur n'est transmise aux modèles d'IA (helper `pii-safe` + hard gate code).",
      iaGenerativeIA:
        " Les prompts envoyés à ces modèles ne contiennent aucune donnée personnelle de visiteur (helper `pii-safe` + hard gate code sur la base de connaissances).",
      categories:
        "infrastructure principale, paiements & contrats, communications, analytics & observabilité, génération de contenu IA",
    },
    en: {
      donnees: "",
      finalites: "",
      baseLegale: "",
      conservation: "",
      hebergementIA:
        " No visitor personal data is sent to the AI models (`pii-safe` helper + code-level hard gate).",
      iaGenerativeIA:
        " Prompts sent to these models contain no visitor personal data (`pii-safe` helper + code-level hard gate on the knowledge base).",
      categories:
        "core infrastructure, payments & contracts, communications, analytics & observability, AI content generation",
    },
  },
  apres: {
    fr: {
      donnees:
        " Avec votre accord, l'enregistrement d'un rendez-vous en visioconférence, sa transcription et le compte rendu qui en est tiré (voir « Rendez-vous de découverte »).",
      finalites:
        " Préparation des propositions, devis et questionnaires de chaque projet, à partir des comptes rendus de rendez-vous.",
      baseLegale:
        " Consentement (art. 6.1.a) pour l'enregistrement des visioconférences, que vous pouvez retirer à tout moment sans effet sur ce qui a été fait avant (art. 7.3) ; intérêt légitime (art. 6.1.f) pour la dictée d'un résumé après un rendez-vous téléphonique.",
      conservation:
        " Enregistrements de rendez-vous, transcriptions et comptes rendus : voir la section « Rendez-vous de découverte ».",
      hebergementIA:
        " Les contenus éditoriaux du site sont produits sans aucune donnée personnelle de visiteur (helper `pii-safe` + contrôle dans le code). Une seule exception, avec votre accord : les comptes rendus de rendez-vous en visioconférence, dont le son et la transcription sont traités par OpenAI (États-Unis), dans les conditions de la section « Rendez-vous de découverte ».",
      iaGenerativeIA:
        " Les prompts de ces contenus éditoriaux ne contiennent aucune donnée personnelle de visiteur (helper `pii-safe` + contrôle dans le code sur la base de connaissances). Les comptes rendus de rendez-vous, eux, sont produits avec votre accord à partir de l'enregistrement, par OpenAI, puis relus et validés par une personne (section « Rendez-vous de découverte »).",
      categories:
        "infrastructure principale, paiements & contrats, communications, analytics & observabilité, génération de contenu IA, comptes rendus de rendez-vous par IA",
    },
    en: {
      donnees:
        " With your consent, the recording of a video-conference appointment, its transcript and the summary drawn from it (see « Discovery appointments »).",
      finalites:
        " Preparing the proposals, quotes and questionnaires of each project, from the appointment summaries.",
      baseLegale:
        " Consent (art. 6.1.a) for recording video conferences, which you may withdraw at any time without affecting what was done before (art. 7.3); legitimate interest (art. 6.1.f) for dictating a summary after a phone appointment.",
      conservation:
        " Appointment recordings, transcripts and summaries: see the « Discovery appointments » section.",
      hebergementIA:
        " The site's editorial content is produced without any visitor personal data (`pii-safe` helper + code-level check). One exception, with your consent: the summaries of video-conference appointments, whose audio and transcript are processed by OpenAI (United States), under the conditions of the « Discovery appointments » section.",
      iaGenerativeIA:
        " Prompts for this editorial content contain no visitor personal data (`pii-safe` helper + code-level check on the knowledge base). Appointment summaries, on the other hand, are produced with your consent from the recording, by OpenAI, then reviewed and approved by a person (« Discovery appointments » section).",
      categories:
        "core infrastructure, payments & contracts, communications, analytics & observability, AI content generation, AI appointment summaries",
    },
  },
} as const;

export type ComplementsNotice = (typeof COMPLEMENTS)["avant"]["fr"];

/** Compléments des sections de la politique, selon l'état de l'annonce. */
export function complementsNotice(
  locale: "fr" | "en",
  actif = ANNONCE_VISIO_ACTIVE,
): { readonly [K in keyof ComplementsNotice]: string } {
  return COMPLEMENTS[etat(actif)][locale];
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGES /sous-processeurs ET /transparence (T11, T12)
// ═════════════════════════════════════════════════════════════════════════════

const PAGES = {
  avant: {
    fr: {
      spHorsUe:
        "L'hébergement principal (Hetzner) et les outils auto-hébergés (DocuSeal, Plausible) sont en Allemagne, dans l'UE. Les transferts vers des prestataires hors UE sont encadrés par des Clauses contractuelles types (SCC) ou une décision d'adéquation. Les modèles d'IA ne reçoivent que des prompts éditoriaux, jamais de données client.",
      spIa: "Non. Les modèles d'IA ne reçoivent que des prompts éditoriaux et des contenus publics de la base de connaissances. Une barrière logicielle refuse les contenus confidentiels ou secrets, et aucune donnée personnelle client n'est transmise. L'option « zéro rétention » / opt-out d'entraînement est activée.",
      spEnBrefIa: "Aucune donnée personnelle client n'est transmise aux modèles d'IA.",
      trSousProcesseurs:
        "OpenAI, Anthropic, Perplexity sont listés exhaustivement sur la page sous-processeurs, avec leur finalité, la catégorie de données traitées (jamais de PII visiteur — helper `pii-safe` + hard gate code), la localisation des serveurs, le statut du DPA et le cadre de transfert international (Clauses Contractuelles Types + Data Privacy Framework le cas échéant).",
      trDroitsIa:
        "Les prompts envoyés aux modèles ne contiennent aucune donnée personnelle de visiteur.",
      trFaqLlm:
        "Non. Les prompts envoyés aux modèles d'IA ne contiennent aucune donnée personnelle de visiteur — un helper « pii-safe » et un hard gate au niveau du code l'interdisent. Aucune saisie de formulaire n'est utilisée pour entraîner un modèle.",
    },
    en: {
      spHorsUe:
        "Core hosting (Hetzner) and self-hosted tools (DocuSeal, Plausible) are in Germany, within the EU. Transfers to non-EU providers are framed by Standard Contractual Clauses (SCC) or an adequacy decision. AI models only receive editorial prompts, never client data.",
      spIa: "No. AI models only receive editorial prompts and public knowledge-base content. A code-level gate refuses confidential or secret content, and no client personal data is sent. Zero-retention / training opt-out is enabled.",
      spEnBrefIa: "No client personal data is sent to AI models.",
      trSousProcesseurs:
        "OpenAI, Anthropic, Perplexity are listed exhaustively on the sub-processors page, with their purpose, the category of data processed (never visitor PII — `pii-safe` helper + code-level hard gate), server location, DPA status and international transfer framework (Standard Contractual Clauses + Data Privacy Framework where applicable).",
      trDroitsIa: "Prompts sent to models contain no visitor personal data.",
      trFaqLlm:
        "No. Prompts sent to AI models contain no visitor personal data — a « pii-safe » helper and a code-level hard gate prevent it. No form submission is used to train a model.",
    },
  },
  apres: {
    fr: {
      spHorsUe:
        "L'hébergement principal (Hetzner) et les outils auto-hébergés (DocuSeal, Plausible) sont en Allemagne, dans l'UE. Les transferts vers des prestataires hors UE sont encadrés par des Clauses contractuelles types (SCC) ou une décision d'adéquation. Pour les contenus éditoriaux, les modèles d'IA ne reçoivent que des prompts éditoriaux ; les comptes rendus de rendez-vous, eux, partent chez OpenAI (États-Unis) avec votre accord.",
      spIa: "Pour nos contenus éditoriaux, non : les modèles ne reçoivent que des prompts éditoriaux et des contenus publics de la base de connaissances. Pour les rendez-vous en visioconférence, oui, et seulement si vous acceptez l'enregistrement : la transcription et le compte rendu sont produits par OpenAI, listé ci-dessous, qui n'entraîne pas ses modèles sur ces données.",
      spEnBrefIa:
        "Pour les contenus éditoriaux, aucune donnée personnelle client n'est transmise aux modèles d'IA ; les comptes rendus de rendez-vous le sont, avec l'accord des participants.",
      trSousProcesseurs:
        "OpenAI, Anthropic, Perplexity sont listés exhaustivement sur la page sous-processeurs, avec leur finalité, la catégorie de données traitées, la localisation des serveurs, le statut du DPA et le cadre de transfert international (Clauses Contractuelles Types + Data Privacy Framework le cas échéant). Les contenus éditoriaux n'utilisent aucune donnée personnelle de visiteur ; les comptes rendus de rendez-vous, produits par OpenAI avec l'accord des participants, y figurent sur une ligne distincte.",
      trDroitsIa:
        "Les prompts des contenus éditoriaux ne contiennent aucune donnée personnelle de visiteur ; les comptes rendus de rendez-vous ne sont produits qu'avec votre accord, que vous pouvez retirer à tout moment.",
      trFaqLlm:
        "Pour les contenus éditoriaux, non, leurs prompts ne contiennent aucune donnée personnelle de visiteur. Pour un rendez-vous en visioconférence, oui, et seulement avec votre accord : le son est transcrit et un compte rendu est rédigé par OpenAI, qui n'entraîne pas ses modèles sur ces données. Aucune saisie de formulaire n'est utilisée pour entraîner un modèle.",
    },
    en: {
      spHorsUe:
        "Core hosting (Hetzner) and self-hosted tools (DocuSeal, Plausible) are in Germany, within the EU. Transfers to non-EU providers are framed by Standard Contractual Clauses (SCC) or an adequacy decision. For editorial content, AI models only receive editorial prompts; appointment summaries go to OpenAI (United States) with your consent.",
      spIa: "For our editorial content, no: the models only receive editorial prompts and public knowledge-base content. For video-conference appointments, yes, and only if you accept the recording: the transcript and summary are produced by OpenAI, listed below, which does not train its models on this data.",
      spEnBrefIa:
        "For editorial content, no client personal data is sent to AI models; appointment summaries are, with the participants' consent.",
      trSousProcesseurs:
        "OpenAI, Anthropic, Perplexity are listed exhaustively on the sub-processors page, with their purpose, the category of data processed, server location, DPA status and international transfer framework (Standard Contractual Clauses + Data Privacy Framework where applicable). Editorial content uses no visitor personal data; appointment summaries, produced by OpenAI with the participants' consent, appear on a separate line.",
      trDroitsIa:
        "Prompts for editorial content contain no visitor personal data; appointment summaries are only produced with your consent, which you may withdraw at any time.",
      trFaqLlm:
        "For editorial content, no, its prompts contain no visitor personal data. For a video-conference appointment, yes, and only with your consent: the audio is transcribed and a summary written by OpenAI, which does not train its models on this data. No form submission is used to train a model.",
    },
  },
} as const;

export type TextesPagesIa = (typeof PAGES)["avant"]["fr"];

/** Phrases des pages publiques sur l'IA et les données personnelles. */
export function textesPagesIa(
  locale: "fr" | "en",
  actif = ANNONCE_VISIO_ACTIVE,
): { readonly [K in keyof TextesPagesIa]: string } {
  return PAGES[etat(actif)][locale];
}

// ═════════════════════════════════════════════════════════════════════════════
// SOUS-TRAITANTS — lignes Google Meet (T13) et Cloudflare (T18)
// ═════════════════════════════════════════════════════════════════════════════

const MEET_DONNEES = {
  avant: {
    fr: "Flux audio et vidéo de la réunion, nom affiché, adresse email du participant, adresse IP et données de connexion. Aucune de ces données n'est enregistrée ni conservée par Axion-IA.",
    en: "Audio and video streams of the meeting, display name, participant email address, IP address and connection data. None of this data is recorded or retained by Axion-IA.",
  },
  apres: {
    fr: "Flux audio et vidéo de la réunion, nom affiché, adresse email du participant, adresse IP et données de connexion. Google n'enregistre pas la réunion pour notre compte et ne reçoit rien de plus : le son de la réunion peut être enregistré par Axion-IA avec l'accord des participants, depuis le poste de son intervenant, sans passer par Google (ligne « OpenAI, LLC (comptes rendus de rendez-vous) »).",
    en: "Audio and video streams of the meeting, display name, participant email address, IP address and connection data. Google does not record the meeting for us and receives nothing more: the meeting audio may be recorded by Axion-IA with the participants' consent, from its speaker's computer, without going through Google (line « OpenAI, LLC (comptes rendus de rendez-vous) »).",
  },
} as const;

const CLOUDFLARE_STOCKAGE_SON = {
  avant: { fr: "", en: "" },
  apres: {
    fr: " Avec l'accord des participants, le son des rendez-vous en visioconférence y est aussi déposé, chiffré par nos serveurs avant l'envoi, le temps d'être transcrit : il est effacé à la validation du compte rendu, au plus tard 30 jours après le rendez-vous.",
    en: " With the participants' consent, the audio of video-conference appointments is also stored there, encrypted by our servers before upload, until it is transcribed: it is deleted when the summary is approved, at most 30 days after the meeting.",
  },
} as const;

/** Catégories de données de la ligne Google Meet. */
export function donneesMeet(locale: "fr" | "en", actif = ANNONCE_VISIO_ACTIVE): string {
  return MEET_DONNEES[etat(actif)][locale];
}

/** Phrase ajoutée aux données de la ligne Cloudflare (chaîne vide avant l'annonce). */
export function stockageSonCloudflare(locale: "fr" | "en", actif = ANNONCE_VISIO_ACTIVE): string {
  return CLOUDFLARE_STOCKAGE_SON[etat(actif)][locale];
}

// ═════════════════════════════════════════════════════════════════════════════
// CONFIRMATION D'UN RENDEZ-VOUS EN VISIO (T21 e-mail, T22 page) — sans lien
// ═════════════════════════════════════════════════════════════════════════════

const PHRASE_CONFIRMATION = {
  fr: "Si vous le souhaitez, nous pourrons enregistrer la visioconférence pour en tirer un compte rendu. Nous vous le demanderons au début, et vous pourrez refuser sans que cela change quoi que ce soit.",
  en: "If you wish, we can record the video conference to produce a summary. We will ask you at the start, and you can refuse without it changing anything.",
} as const;

/**
 * Phrase d'information de la confirmation d'un rendez-vous EN VISIO, ou `null`
 * tant que l'annonce n'est pas active (rien n'est alors enregistrable).
 */
export function phraseConfirmationVisio(
  locale: "fr" | "en",
  actif = ANNONCE_VISIO_ACTIVE,
): string | null {
  return actif ? PHRASE_CONFIRMATION[locale] : null;
}
