// E-mails — le RÉSEAU D'APPORTEURS EN DÉMARRAGE MANUEL (2026-10-05).
//
// Tant que l'espace apporteur (Axion Partners) n'est pas ouvert, Will gère les
// apporteurs signés depuis la console : les présentations arrivent par le formulaire
// « Déclarer une entreprise » du lien personnel (contrat 2.2, art. 3.2), et la console
// envoie les réponses. Quatre messages, un seul fichier :
//   · `apporteur-contrat-signe`        — le contrat est signé : comment nous présenter une entreprise ;
//   · `apporteur-presentation-recue`   — « bien reçu, elle vous est réservée » ;
//   · `apporteur-presentation-refusee` — déjà connue / pas disponible / hors champ ;
//   · `entreprise-confirmation-apporteur` — à la PERSONNE PRÉSENTÉE : confirmez-vous
//     avoir échangé avec l'apporteur ? (contrat, art. 3.2 et 3.7).
//
// Ils ne partent JAMAIS seuls : Will clique, relit l'aperçu (ce rendu exact),
// puis confirme — comme les issues de l'échange (`apporteur-issue-echange`).
//
// Même châssis que l'e-mail « Bienvenue » de l'issue retenue : famille B,
// sans rangée sociale, vouvoiement, signature du fondateur (§6.1, sans téléphone).
//
// ── Vocabulaire (anti-requalification) ────────────────────────────────────
// « présenter », « mettre en relation », « apporteur indépendant », « commission ».
// JAMAIS « mission », « objectif », « prospecter pour nous », « suivi du client » :
// l'apporteur n'a aucune obligation d'activité ni de suivi (contrat, art. 1.1 et 2.2).
//
// ── Ce que l'apporteur ne doit JAMAIS apprendre ───────────────────────────
// Qui occupe une entreprise « pas disponible » (contrat, art. 3.5). Le motif dit
// la catégorie, jamais l'occupant.

import { Text } from "@react-email/components";
import type { ReactElement } from "react";

import { EmailLayout, emailStyles } from "./_layout";
import { paragraphesLibres } from "./texte-libre-reseau";
import { ligneAPreparer, lignesBareme } from "./_bareme-apporteur";
import { PARRAINAGE_BPS, PARRAINAGE_MOIS } from "@/features/apporteurs-reseau/regles";
import { FENETRE_ATTRIBUTION_APPORTEUR_MOIS } from "@/lib/commercial-application/kit-apporteur";
import { IDENTITE_LEGALE, adresseSiegeUneLigne } from "@/lib/identite-legale-ssot";
import { SITE_URL as SITE_URL_BRUT } from "@/lib/site-url";
import type { Locale } from "../../../../prisma/generated/client";

/** Délai de la confirmation réputée acquise (contrat, art. 3.2 — CONFIRMATION_TACITE_JOURS). */
export const CONFIRMATION_TACITE_JOURS = 30;
/** Délai de réponse à une contestation (contrat, art. 3.3 : « dans les trente jours »). */
const REPONSE_CONTESTATION_JOURS = 30;

// Le filet anti-localhost de `site-url.ts` : jamais un lien localhost dans un e-mail de prod.
const SITE_URL = SITE_URL_BRUT.replace(/\/+$/, "");
const LIEN_FICHE = `${SITE_URL}/documents/apporteurs/comment-ca-marche.pdf`;
const LIEN_RENDEZ_VOUS = `${SITE_URL}/fr/appel?depuis=email-apporteur`;
const LIEN_POLITIQUE = `${SITE_URL}/fr/politique-confidentialite#reseau-d-apporteurs-d-affaires`;

const PCT_PARRAINAGE = PARRAINAGE_BPS / 100;

export type MotifRefus = "deja-connue" | "pas-disponible" | "hors-champ";

interface Payload {
  /** Manquement (art. 4.5 bis) : les faits, tels que saisis dans la console. */
  faits?: string;
  /** Manquement : avis au PARRAIN dont la part est retirée (sans les faits). */
  parrain?: boolean;
  /** Manquement : envoi de l'avoir de neutralisation seul (rattrapage de sa pièce). */
  avoirSeul?: boolean;
  /** Suspension d'une commission (art. 4.2 bis) : « suspendue » puis « levee ». */
  etat?: string;
  /** Nom de l'apporteur (ou de la personne présentée) : seul le premier mot est dit, sauf `civilite`. */
  contactName?: string;
  /** Entreprise présentée, telle que saisie. */
  entreprise?: string;
  /** « lundi 5 octobre », déjà formaté en heure de Paris. */
  datePresentation?: string;
  /** Personne présentée : « Claire Durand ». */
  personnePresentee?: string;
  /** Refus seulement. */
  motif?: MotifRefus;
  /** A1.7 : motif de la constatation « produit non commissionné ». */
  motifNonCommissionne?: string;
  /** Lien du dossier seulement : 1 = rappel J+3, 2 = rappel J+7 (absent = premier envoi). */
  rappel?: number;
  /** Confirmation seulement : « Monsieur » / « Madame », et le nom de famille. */
  civilite?: string;
  nomFamille?: string;
  /** Confirmation seulement : prénom et nom de l'apporteur (art. 3.2 : ils sont communiqués). */
  nomApporteur?: string;
  /** Quelques mots de Will, ajoutés en haut du message. Facultatif. */
  motPersonnel?: string;
  /** Lien personnel du dossier en ligne. */
  dossierUrl?: string;
  /** « À compléter » : les pièces à retransmettre, déjà formulées (« RIB : illisible »). */
  piecesARetransmettre?: string[];
  /** Vigilance : `premiere` (approche de 5 000 €) ou `renouvellement` (6 mois). */
  variante?: string;
  /** Commission facturée : montant formaté, numéro d'autofacture, échéance de paiement (J+30). */
  montant?: string;
  echeance?: string;
  /** Commission facturée avec reprise : lignes « avoir imputé » et somme réellement virée. */
  avoirs?: string[];
  sommeVirement?: string;
  /** Relevé : compensation intégrale par les reprises (art. 12.4), rien à virer. */
  compense?: boolean;
  numeroAutofacture?: string;
  /** Virement fait : « n° AXI-APP-2026-0003 » (ou « n° A, n° B ») et « 7 octobre 2026 ». */
  numeros?: string;
  dateVirement?: string;
  /** Interne : lien de la fiche de l'apporteur dans la console. */
  lienConsole?: string;
  /**
   * Texte principal réécrit par Will (paragraphes séparés par une ligne vide). Quand il
   * est présent il REMPLACE le corps par défaut (et prime sur `rappel`/`motPersonnel`) ;
   * le bonjour, le bouton d'action, les pièces à retransmettre, l'information RGPD et la
   * signature sont conservés. Rendu comme du texte (échappé), jamais en HTML.
   */
  texteLibre?: string;
}

interface Props {
  locale: Locale;
  payload: Record<string, unknown>;
}

function texteOuNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

function prenomDe(p: Payload): string {
  return (texteOuNull(p.contactName) ?? "").split(/\s+/)[0] ?? "";
}

const bonjour = (n: string) => (n ? `Bonjour ${n},` : "Bonjour,");

// ── Textes ───────────────────────────────────────────────────────────────

/**
 * « octobre 2026 » → « d'octobre 2026 » ; « novembre 2026 » → « de novembre 2026 ».
 * L'élision ne vaut que devant une voyelle (avril, août, octobre).
 */
export function moisAvecArticle(m: string): string {
  const t = m.trim();
  return /^[aeiouyàâéèêîôû]/i.test(t) ? `d'${t}` : `de ${t}`;
}

export const COPY_DEMARRAGE = {
  contratSigne: {
    // ≤ 45 caractères (§3.4).
    subject: "Votre contrat est signé : à vous de jouer",
    title: "Vous pouvez nous présenter des entreprises",
    preview:
      "Comment nous présenter une entreprise, ce qui se passe ensuite et quand vous êtes payé.",
    merci:
      "Votre contrat d'apporteur d'affaires est signé : merci, et bienvenue officiellement dans le réseau d'Axion-IA.",
    presenterTitre: "Pour nous présenter une entreprise",
    presenter:
      "Ouvrez votre lien personnel, celui de votre dossier : le formulaire « Déclarer une entreprise » vous y attend. Il demande :",
    cta: "Déclarer une entreprise",
    champs: [
      "le nom de l'entreprise et son numéro SIREN ;",
      "la personne rencontrée : son nom, sa fonction, son e-mail et son téléphone ;",
      "la date de votre échange.",
    ],
    prevenir:
      "Prévenez simplement la personne que vous nous transmettez ses coordonnées : nous prendrons contact avec elle de votre part.",
    ensuiteTitre: "Ensuite",
    ensuite: [
      "Nous vous répondons pour vous confirmer que c'est noté.",
      "L'entreprise vous est réservée : la date de votre déclaration fait foi.",
      (mois: number) =>
        `Une fois l'entreprise attribuée, toutes ses commandes signées pendant ${mois} mois à compter de votre déclaration vous sont commissionnées. Vous n'avez pas à suivre le client : nous nous en occupons.`,
    ],
    commissionTitre: "Votre commission",
    parrainage: (pct: string, mois: number) =>
      `Parrainage : si vous présentez une personne qui devient elle-même apporteur, vous touchez ${pct} des commissions nées de ses commandes signées pendant les ${mois} mois qui suivent la signature de son contrat par Axion-IA.`,
    paiement:
      "Elle vous est versée dès que la prestation est réalisée et que le client l'a entièrement payée : nous établissons votre facture pour vous, puis nous faisons le virement.",
    fiche:
      "Votre contrat signé des deux parties est en pièce jointe. La fiche « Comment ça marche » est à garder sous la main : ",
    ficheLien: "la fiche en PDF",
  },
  presentationRecue: {
    subject: (e: string) =>
      e
        ? `${e} : c'est noté, elle vous est réservée`
        : "C'est noté, l'entreprise vous est réservée",
    title: "Bien reçu : elle est à vous",
    preview: "Voici ce qui se passe maintenant, et ce que vous n'avez pas à faire.",
    recu: (e: string, d: string | null) =>
      `Nous avons bien reçu votre présentation de ${e || "l'entreprise"}${d ? ` du ${d}` : ""} : nous la réservons à votre nom.`,
    suiteTitre: "La suite",
    confirmation: (personne: string | null) =>
      `Nous prenons contact avec ${personne ?? "la personne que vous avez rencontrée"} de votre part : nous lui indiquons que c'est vous qui nous avez parlé d'elle (votre prénom et votre nom, jamais vos coordonnées).`,
    protection: (mois: number, jours: number) =>
      `Dès qu'elle nous répond, ou au plus tard ${jours} jours après notre message, l'entreprise vous est attribuée : toutes ses commandes signées pendant ${mois} mois à compter de votre déclaration vous sont commissionnées.`,
    relais: "Nous prenons le relais : vous n'avez rien d'autre à faire.",
  },
  presentationRefusee: {
    subject: (e: string) => (e ? `Votre présentation de ${e}` : "Votre présentation"),
    title: "Cette entreprise n'est pas disponible",
    preview: "Merci pour votre présentation. Voici pourquoi nous ne pouvons pas vous la réserver.",
    merci: (e: string, d: string | null) =>
      `Merci pour votre présentation de ${e || "l'entreprise"}${d ? ` du ${d}` : ""}.`,
    motif: {
      "deja-connue":
        "Nous ne pouvons pas vous la réserver : elle est déjà cliente d'Axion-IA, ou elle a reçu un devis de notre part récemment.",
      "pas-disponible":
        "Nous ne pouvons pas vous la réserver : cette entreprise est déjà suivie par Axion-IA, et nous ne pouvons pas la rattacher à votre déclaration.",
      "hors-champ":
        "Nous ne pouvons pas vous la réserver : il s'agit d'un organisme avec lequel Axion-IA travaille déjà directement (administration, organisme public ou organisme de formation), ou d'une entreprise qui a cessé son activité.",
    } satisfies Record<MotifRefus, string>,
    contester: (j: number) =>
      `Si vous pensez qu'il y a une erreur, dites-le-nous en répondant à cet e-mail : nous vous répondrons dans les ${j} jours.`,
    sansConsequence:
      "Cela n'a aucune conséquence pour vous, et vous pouvez nous présenter d'autres entreprises quand vous le souhaitez.",
  },
  confirmation: {
    // Une PRISE DE CONTACT de Williams, jamais un contrôle (Will, 2026-10-05 :
    // « il ne faut jamais dire que nous vérifions, c'est contre-vendeur »).
    // La confirmation se lit dans ce que fait la personne : elle prend rendez-vous
    // ou répond, ou cite l'apporteur au rendez-vous (« qui vous a parlé de nous ? ») ;
    // sans réponse pendant 30 jours, elle est réputée confirmée (art. 3.2).
    subject: (a: string) => (a ? `${a} m'a parlé de vous` : "On m'a parlé de vous"),
    title: "Faisons connaissance",
    preview:
      "Quelques mots sur Axion-IA, et la possibilité d'en parler 30 minutes si le sujet vous intéresse.",
    bonjour: (civ: string | null, nom: string | null, prenom: string) =>
      civ && nom ? `Bonjour ${civ} ${nom},` : bonjour(prenom),
    presentation: (a: string, e: string | null) =>
      `${a || "Une personne de notre réseau"} m'a parlé de votre intérêt pour l'intelligence artificielle${e ? ` chez ${e}` : ""}, et je me permets de vous écrire pour me présenter.`,
    quiSommesNous:
      "Je dirige Axion-IA, un cabinet qui aide les entreprises à tirer parti de l'IA : former les équipes, repérer ce qui peut être automatisé, puis le mettre en place, de bout en bout.",
    proposition:
      "Si le sujet vous intéresse, nous pouvons en parler 30 minutes, sans engagement : vous me dites où vous en êtes, je vous dis ce qui est possible.",
    info: (responsable: string, adresse: string) =>
      `Vos coordonnées nous ont été transmises par la personne citée plus haut. Qui les traite : ${responsable}, ${adresse}. ` +
      "Pourquoi : vous présenter nos services et suivre notre relation avec la personne qui nous a mis en relation. " +
      "Vos droits : accès, rectification, effacement, opposition, et réclamation auprès de la CNIL. " +
      "Tout est détaillé dans notre ",
    infoLien: "politique de confidentialité",
    desinscription:
      "Si vous ne souhaitez plus recevoir de message de notre part, un clic suffit : le lien est en bas de ce message.",
    cta: "Prendre rendez-vous",
  },
  dossierLien: {
    subject: "Votre contrat d'apporteur, en ligne",
    title: "Votre dossier et votre contrat",
    preview:
      "Environ 10 minutes : vos informations, deux documents, puis votre signature en ligne.",
    intro:
      "Voici votre lien personnel pour compléter votre dossier d'apporteur d'affaires et signer votre contrat en ligne. Comptez environ 10 minutes ; vous pouvez vous arrêter et reprendre plus tard.",
    etapes: [
      "vos coordonnées, déjà remplies ;",
      "votre numéro SIREN : nous retrouvons le reste dans le registre officiel ;",
      "votre pièce d'identité et votre RIB, en photo ou en PDF ;",
      "la lecture de votre contrat, puis votre signature.",
    ],
    ensuite:
      "Nous vérifions ensuite votre dossier et contresignons votre contrat : vous recevez alors votre exemplaire signé des deux parties.",
    cta: "Compléter mon dossier et signer mon contrat",
  },
  dossierRappel: {
    title: "Votre dossier vous attend",
    preview: "Votre lien personnel est toujours actif : une dizaine de minutes suffisent.",
    intro1:
      "Petit rappel : votre dossier d'apporteur d'affaires n'est pas encore complété. Votre lien personnel est toujours actif ; vous pouvez reprendre là où vous vous êtes arrêté.",
    intro2:
      "Dernier rappel de notre part : votre dossier d'apporteur d'affaires n'est pas encore complété. Votre lien personnel reste actif ; si vous ne souhaitez pas donner suite, vous n'avez rien à faire.",
  },
  aCompleter: {
    subject: "Votre dossier d'apporteur : un complément",
    title: "Il nous manque un élément",
    preview: "Quelques éléments à reprendre dans votre dossier, puis une nouvelle signature.",
    intro:
      "Merci pour votre dossier. Avant de contresigner votre contrat, nous avons besoin d'un complément :",
    note: "Notre message :",
    suite:
      "Votre lien personnel ouvre de nouveau votre dossier : corrigez ce qui est indiqué, puis signez à nouveau votre contrat.",
    cta: "Reprendre mon dossier",
  },
  refuse: {
    subject: "Votre dossier d'apporteur d'affaires",
    title: "Merci pour votre intérêt",
    preview: "Notre réponse à votre dossier d'apporteur d'affaires.",
    texte:
      "Merci pour le temps consacré à votre dossier. Après examen, nous ne sommes pas en mesure de donner suite : votre contrat ne sera pas contresigné et ne prendra pas effet.",
    fin: "Nous vous souhaitons une belle réussite dans vos projets.",
  },
  vigilance: {
    subject: "Deux documents pour vos commissions",
    title: "Deux documents à nous transmettre",
    preview:
      "Votre attestation URSSAF et votre extrait d'immatriculation, à déposer avec votre lien personnel.",
    premiere:
      "Bonne nouvelle : vos commissions approchent 5 000 €. À partir de ce montant, la loi nous demande deux documents (articles L.8222-1 et D.8222-5 du code du travail) :",
    renouvellement:
      "Votre attestation URSSAF de vigilance arrive à échéance : elle se renouvelle tous les six mois. Merci de nous transmettre la nouvelle :",
    documents: [
      "votre attestation URSSAF de vigilance, de moins de 6 mois (gratuite, dans votre espace URSSAF) ;",
      "un extrait de votre immatriculation : Kbis ou extrait RNE (gratuit sur data.inpi.fr).",
    ],
    documentsRenouvellement: [
      "votre attestation URSSAF de vigilance, de moins de 6 mois (gratuite, dans votre espace URSSAF).",
    ],
    rassurer:
      "Vos commissions restent acquises : seul leur versement attend ces documents. Vous continuez à nous présenter des entreprises normalement.",
    cta: "Déposer mes documents",
  },
  commandeSignee: {
    subject: (e: string) =>
      e ? `Bonne nouvelle : ${e} a signé` : "Bonne nouvelle : une commande signée",
    title: "Une commande vient d'être signée",
    preview:
      "Votre commission sera versée dès que la prestation sera réalisée et entièrement payée.",
    texte: (e: string) =>
      `${e || "Une entreprise que vous nous avez présentée"} vient de signer une commande avec Axion-IA. Merci pour cette mise en relation.`,
    suite:
      "Votre commission vous sera versée dès que la prestation sera réalisée et que le client l'aura entièrement payée ; nous établissons alors votre facture en votre nom et nous vous l'envoyons par e-mail.",
  },
  releve: {
    subject: "Votre commission est facturée",
    title: "Votre commission est facturée",
    preview: "Votre facture, établie par nos soins, est jointe à ce message.",
    texte: (montant: string) =>
      `Votre commission de ${montant || "la somme indiquée en pièce jointe"} hors taxes est facturée en votre nom et pour votre compte : la facture est jointe à ce message. Nous nous efforçons de vous verser cette commission sous deux jours ouvrés.`,
    echeance: (d: string) => (d ? `Échéance de paiement : ${d}.` : ""),
    somme: (s: string) => `Somme virée : ${s}.`,
    compense: (montant: string) =>
      `Votre commission de ${montant || "la somme indiquée en pièce jointe"} hors taxes est facturée en votre nom et pour votre compte : la facture est jointe à ce message. Les reprises en cours sur votre compte (article 4.5) s'imputent sur cette commission par compensation (article 12.4 de votre contrat) : l'avoir correspondant est joint.`,
    net: "Net : 0,00 €, rien à virer. Le solde des reprises qui n'ont pas encore été imputées s'imputera sur vos prochaines commissions.",
    facture: (n: string) =>
      `Votre facture${n ? ` n° ${n}` : ""} est établie en votre nom par Axion-IA (mandat d'autofacturation, annexe 2 de votre contrat). Vous disposez de trente jours pour la contester ; à défaut, elle est réputée acceptée.`,
  },
  manquement: {
    // Contrat 2.3, art. 4.5 bis : notification avec les faits, contestation écrite, réponse
    // motivée dans les trente jours.
    subject: "Manquement constaté sur votre déclaration",
    title: "Manquement constaté",
    preview: "Les faits, leurs conséquences et la façon de contester.",
    intro:
      "Au sujet d'une entreprise que vous nous avez présentée, nous constatons un manquement à votre contrat (article 4.5 bis). Les faits sont les suivants :",
    consequences:
      "En conséquence, aucune commission n'est due au titre de cette affaire. Celles qui vous ont déjà été versées font l'objet d'une reprise, dans les conditions de l'article 4.5.",
    contester:
      "Vous pouvez contester ce constat par écrit, en répondant simplement à cet e-mail. Nous vous répondrons de façon motivée dans les trente jours.",
    subjectParrain: "Une part de parrainage est retirée",
    subjectAvoir: "Votre avoir d'autofacture",
    avoir:
      "Vous trouverez ci-joint l'avoir d'autofacture annoncé dans notre précédent message, au sujet du manquement constaté (article 4.5 bis du contrat).",
    parrain:
      "Une affaire apportée par une personne que vous avez parrainée ne donne finalement lieu à aucune commission (article 4.5 bis du contrat). La part de parrainage qui en découlait est donc retirée ; si elle vous avait déjà été versée, elle fait l'objet d'une reprise, dans les conditions de l'article 4.5.",
  },
  nonCommissionne: {
    // Annexe 1, A1.7 : constatation écrite, avec son motif, portée à la connaissance de l'apporteur.
    subject: "Une prestation n'est pas commissionnée",
    title: "Prestation non commissionnée",
    preview: "La décision et son motif.",
    texte:
      "Une entreprise que vous nous avez présentée a commandé un produit créé après la signature de votre contrat, qui ne figure pas dans votre grille de commissions. Comme le prévoit votre contrat (annexe 1, A1.7), nous avons décidé que ce produit n'est pas commissionné, pour le motif suivant :",
    suite:
      "Cette décision ne concerne que ce produit : vos autres commissions et vos attributions en cours ne changent pas.",
  },
  commissionSuspension: {
    // Contrat 2.3, art. 4.2 bis : l'apporteur est informé de la suspension et de son issue.
    // ⛔ Aucun délai promis ; aucun nom de client ni montant (le décompte suivra).
    subjectSuspendue: "Une de vos commissions est suspendue",
    subjectLevee: "Votre commission reprend son cours",
    titleSuspendue: "Commission suspendue",
    titleLevee: "Commission libérée",
    previewSuspendue: "Le client conteste par écrit la prestation ou sa facture.",
    previewLevee: "La contestation du client est close.",
    suspendue:
      "Le client d'une entreprise que vous nous avez présentée conteste par écrit la prestation ou sa facture. Comme le prévoit votre contrat (article 4.2 bis), la commission correspondante est suspendue pendant cette contestation : elle n'est ni facturée ni versée.",
    suspendueSuite:
      "Elle vous reste attachée. Nous vous écrirons dès l'issue de la contestation : la commission sera alors versée, ou ajustée selon le prix finalement conservé.",
    levee:
      "La contestation du client est close : votre commission reprend son cours. Elle vous sera facturée et versée dans les conditions habituelles ; si le prix conservé a changé, le décompte vous l'indiquera.",
  },
  commissionAvoirClient: {
    // Art. 4.5 : la facture du client a été annulée par un avoir ALORS QUE la commission était
    // déjà facturée (pas encore versée) : elle est neutralisée par un avoir d'autofacture, joint.
    // ⛔ Aucun nom de client ni délai promis ; ce n'est PAS un manquement (pas de « faits »).
    subject: "Une de vos commissions est annulée (avoir joint)",
    title: "Commission annulée",
    preview: "La facture du client a été annulée par un avoir.",
    texte:
      "La facture d'une commande sur laquelle vous étiez commissionné a été annulée par un avoir. Comme le prévoit votre contrat (article 4.5), la somme correspondante, déjà facturée mais pas encore versée, est annulée : vous trouverez ci-joint l'avoir d'autofacture qui la neutralise.",
    suite:
      "Cela ne change rien à vos autres commissions. Si vous avez une question, répondez simplement à cet e-mail.",
  },
  dossierRecu: {
    // ⛔ Aucun délai promis : la vérification dépend des pièces reçues.
    subject: "Votre dossier d'apporteur est bien reçu",
    title: "Dossier bien reçu",
    preview: "Votre dossier et votre contrat signé nous sont bien parvenus.",
    texte: "Merci : votre dossier et votre contrat signé nous sont bien parvenus.",
    suite:
      "Nous vérifions votre dossier ; vous recevrez votre contrat contresigné par e-mail. Si un élément manque, nous vous le dirons par e-mail.",
    lien: "Votre lien personnel reste disponible pour suivre votre dossier.",
    cta: "Voir mon dossier",
  },
  virementFait: {
    // ⛔ Jamais de date d'arrivée sur le compte : elle dépend de la banque de l'apporteur.
    subject: "Votre commission est virée",
    title: "Votre commission est virée",
    preview: "Le virement de votre commission vient de partir.",
    texte: (montant: string, numeros: string, date: string) =>
      `Le virement${montant ? ` de ${montant}` : " de votre commission"}${numeros ? ` correspondant à votre facture ${numeros}` : ""} est parti${date ? ` le ${date}` : ""}.`,
    suite:
      "Selon les délais de votre banque, il apparaîtra sur votre compte dans les prochains jours. Si vous ne le voyez pas d'ici une semaine, répondez simplement à ce message.",
    merci: "Merci pour votre confiance.",
  },
  interneAVerifier: {
    subject: (n: string) =>
      n ? `Dossier apporteur à vérifier : ${n}` : "Un dossier apporteur à vérifier",
    title: "Un dossier apporteur est signé",
    preview: "Pièces à vérifier, puis oui, à compléter ou non, depuis la console.",
    texte: (n: string) =>
      `${n || "Un apporteur"} a complété son dossier et signé son contrat. Il reste à vérifier ses pièces, puis à contresigner, demander un complément ou refuser.`,
    cta: "Ouvrir sa fiche",
  },
} as const;

// ── Morceaux communs ─────────────────────────────────────────────────────

const intertitre: React.CSSProperties = {
  ...emailStyles.paragraphStyle,
  fontWeight: 700,
  margin: "20px 0 8px",
};

const puce: React.CSSProperties = { ...emailStyles.paragraphStyle, margin: "0 0 6px" };

/** « 30 % » — la typographie française. */
const pourcent = (n: number): string => `${n} %`;

function MotPersonnel({ p }: { p: Payload }): ReactElement | null {
  const mot = texteOuNull(p.motPersonnel);
  if (!mot) return null;
  return <Text style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>{mot}</Text>;
}

/** Le texte réécrit de Will, rendu paragraphe par paragraphe (échappé par React). */
function TexteLibre({ paragraphes }: { paragraphes: string[] }): ReactElement {
  return (
    <>
      {paragraphes.map((t, i) => (
        <Text key={i} style={{ ...emailStyles.paragraphStyle, whiteSpace: "pre-line" }}>
          {t}
        </Text>
      ))}
    </>
  );
}

// ── Contrat signé ────────────────────────────────────────────────────────

export const apporteurContratSigneSubject = (_locale: Locale): string =>
  COPY_DEMARRAGE.contratSigne.subject;

export function ApporteurContratSigneEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.contratSigne;
  const [e1, e2, e3] = t.ensuite;
  const libres = paragraphesLibres(p.texteLibre);
  // Le lien du dossier porte le formulaire de déclaration : bouton quand on l'a.
  const url = texteOuNull(p.dossierUrl);
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
      {...(url ? { cta: { label: t.cta, href: url }, ctaSecret: true } : {})}
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      {libres ? (
        <TexteLibre paragraphes={libres} />
      ) : (
        <>
          <MotPersonnel p={p} />
          <Text style={emailStyles.paragraphStyle}>{t.merci}</Text>

          <Text style={intertitre}>{t.presenterTitre}</Text>
          <Text style={puce}>{t.presenter}</Text>
          {t.champs.map((c) => (
            <Text key={c} style={puce}>
              • {c}
            </Text>
          ))}
          <Text style={emailStyles.paragraphStyle}>{t.prevenir}</Text>

          <Text style={intertitre}>{t.ensuiteTitre}</Text>
          <Text style={puce}>1. {e1}</Text>
          <Text style={puce}>2. {e2}</Text>
          <Text style={emailStyles.paragraphStyle}>
            3. {e3(FENETRE_ATTRIBUTION_APPORTEUR_MOIS)}
          </Text>

          <Text style={intertitre}>{t.commissionTitre}</Text>
          {/* Le MÊME barème que « Retenu » et que le contrat v2 (`_bareme-apporteur`). */}
          {lignesBareme().map((ligne) => (
            <Text key={ligne} style={puce}>
              • {ligne}
            </Text>
          ))}
          <Text style={puce}>• {t.parrainage(pourcent(PCT_PARRAINAGE), PARRAINAGE_MOIS)}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.paiement}</Text>
        </>
      )}
      {/* Hors du texte réécrivable : la fiche reste jointe même quand Will réécrit le message. */}
      <Text style={emailStyles.paragraphStyle}>
        {t.fiche}
        <a href={LIEN_FICHE} style={{ color: emailStyles.COLORS.terracotta }}>
          {t.ficheLien}
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

// ── Présentation reçue ───────────────────────────────────────────────────

export const apporteurPresentationRecueSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string =>
  COPY_DEMARRAGE.presentationRecue.subject(
    texteOuNull((payload as Payload | undefined)?.entreprise) ?? "",
  );

export function ApporteurPresentationRecueEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.presentationRecue;
  const libres = paragraphesLibres(p.texteLibre);
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      {libres ? (
        <TexteLibre paragraphes={libres} />
      ) : (
        <>
          <MotPersonnel p={p} />
          <Text style={emailStyles.paragraphStyle}>
            {t.recu(texteOuNull(p.entreprise) ?? "", texteOuNull(p.datePresentation))}
          </Text>
          <Text style={intertitre}>{t.suiteTitre}</Text>
          <Text style={emailStyles.paragraphStyle}>
            {t.confirmation(texteOuNull(p.personnePresentee))}
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            {t.protection(FENETRE_ATTRIBUTION_APPORTEUR_MOIS, CONFIRMATION_TACITE_JOURS)}
          </Text>
          <Text style={emailStyles.paragraphStyle}>{t.relais}</Text>
        </>
      )}
    </EmailLayout>
  );
}

// ── Présentation refusée ─────────────────────────────────────────────────

export const apporteurPresentationRefuseeSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string =>
  COPY_DEMARRAGE.presentationRefusee.subject(
    texteOuNull((payload as Payload | undefined)?.entreprise) ?? "",
  );

function lireMotif(v: unknown): MotifRefus {
  return v === "pas-disponible" || v === "hors-champ" ? v : "deja-connue";
}

export function ApporteurPresentationRefuseeEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.presentationRefusee;
  const libres = paragraphesLibres(p.texteLibre);
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      {libres ? (
        <TexteLibre paragraphes={libres} />
      ) : (
        <>
          <MotPersonnel p={p} />
          <Text style={emailStyles.paragraphStyle}>
            {t.merci(texteOuNull(p.entreprise) ?? "", texteOuNull(p.datePresentation))}
          </Text>
          <Text style={emailStyles.paragraphStyle}>{t.motif[lireMotif(p.motif)]}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.contester(REPONSE_CONTESTATION_JOURS)}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.sansConsequence}</Text>
        </>
      )}
    </EmailLayout>
  );
}

// ── Confirmation demandée à l'entreprise ─────────────────────────────────

export const entrepriseConfirmationApporteurSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string =>
  COPY_DEMARRAGE.confirmation.subject(
    texteOuNull((payload as Payload | undefined)?.nomApporteur) ?? "",
  );

export function EntrepriseConfirmationApporteurEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.confirmation;
  const nomApporteur = texteOuNull(p.nomApporteur) ?? "";
  const libres = paragraphesLibres(p.texteLibre);
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur"
      cta={{ label: t.cta, href: LIEN_RENDEZ_VOUS }}
    >
      <Text style={emailStyles.paragraphStyle}>
        {t.bonjour(texteOuNull(p.civilite), texteOuNull(p.nomFamille), prenomDe(p))}
      </Text>
      {libres ? (
        <TexteLibre paragraphes={libres} />
      ) : (
        <>
          <Text style={emailStyles.paragraphStyle}>
            {t.presentation(nomApporteur, texteOuNull(p.entreprise))}
          </Text>
          <Text style={emailStyles.paragraphStyle}>{t.quiSommesNous}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.proposition}</Text>
        </>
      )}
      {/* Petit, après le corps : l'information de l'art. 14 RGPD (l'adresse vient
          d'un tiers). ⛔ AUCUNE question de contrôle : on ne dit jamais à
          l'entreprise qu'on vérifie (Will, 2026-10-05 : « contre-vendeur »). */}
      <Text
        style={{
          ...emailStyles.paragraphStyle,
          fontSize: "13px",
          color: emailStyles.COLORS.textMuted,
        }}
      >
        {t.info(IDENTITE_LEGALE.legalName, adresseSiegeUneLigne())}
        <a href={LIEN_POLITIQUE} style={{ color: emailStyles.COLORS.terracotta }}>
          {t.infoLien}
        </a>
        . {t.desinscription}
      </Text>
    </EmailLayout>
  );
}

// ── Lien du dossier ──────────────────────────────────────────────────────

export const apporteurDossierLienSubject = (_locale: Locale): string =>
  COPY_DEMARRAGE.dossierLien.subject;

export function ApporteurDossierLienEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.dossierLien;
  const url = texteOuNull(p.dossierUrl);
  // Rappel (1 = J+3, 2 = J+7) : même sujet et mêmes étapes, seul l'en-tête change.
  const rappel = p.rappel === 1 || p.rappel === 2 ? p.rappel : null;
  const r = COPY_DEMARRAGE.dossierRappel;
  const libres = paragraphesLibres(p.texteLibre);
  return (
    <EmailLayout
      famille="B"
      preview={rappel ? r.preview : t.preview}
      title={rappel ? r.title : t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
      {...(url ? { cta: { label: t.cta, href: url }, ctaSecret: true } : {})}
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      {libres ? (
        <TexteLibre paragraphes={libres} />
      ) : (
        <>
          <MotPersonnel p={p} />
          <Text style={emailStyles.paragraphStyle}>
            {rappel === 1 ? r.intro1 : rappel === 2 ? r.intro2 : t.intro}
          </Text>
          {t.etapes.map((e, i) => (
            <Text key={e} style={puce}>
              {i + 1}. {e}
            </Text>
          ))}
          <Text style={emailStyles.paragraphStyle}>{t.ensuite}</Text>
        </>
      )}
      <Text style={puce}>{ligneAPreparer()}</Text>
    </EmailLayout>
  );
}

// ── À compléter ──────────────────────────────────────────────────────────

export const apporteurDossierACompleterSubject = (_locale: Locale): string =>
  COPY_DEMARRAGE.aCompleter.subject;

export function ApporteurDossierACompleterEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.aCompleter;
  const url = texteOuNull(p.dossierUrl);
  const pieces = Array.isArray(p.piecesARetransmettre)
    ? p.piecesARetransmettre.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
  const libres = paragraphesLibres(p.texteLibre);
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
      {...(url ? { cta: { label: t.cta, href: url }, ctaSecret: true } : {})}
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      {libres ? (
        <>
          <TexteLibre paragraphes={libres} />
          {/* Les pièces à retransmettre restent listées sous le texte réécrit. */}
          {pieces.map((x) => (
            <Text key={x} style={puce}>
              • {x}
            </Text>
          ))}
        </>
      ) : (
        <>
          <Text style={emailStyles.paragraphStyle}>{t.intro}</Text>
          {pieces.map((x) => (
            <Text key={x} style={puce}>
              • {x}
            </Text>
          ))}
          {texteOuNull(p.motPersonnel) ? (
            <>
              <Text style={intertitre}>{t.note}</Text>
              <MotPersonnel p={p} />
            </>
          ) : null}
          <Text style={emailStyles.paragraphStyle}>{t.suite}</Text>
        </>
      )}
    </EmailLayout>
  );
}

// ── Refus ────────────────────────────────────────────────────────────────

export const apporteurDossierRefuseSubject = (_locale: Locale): string =>
  COPY_DEMARRAGE.refuse.subject;

export function ApporteurDossierRefuseEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.refuse;
  const libres = paragraphesLibres(p.texteLibre);
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      {libres ? (
        <TexteLibre paragraphes={libres} />
      ) : (
        <>
          <Text style={emailStyles.paragraphStyle}>{t.texte}</Text>
          <MotPersonnel p={p} />
          <Text style={emailStyles.paragraphStyle}>{t.fin}</Text>
        </>
      )}
    </EmailLayout>
  );
}

// ── Vigilance (5 000 €, puis tous les 6 mois) ────────────────────────────

export const apporteurVigilanceSubject = (_locale: Locale): string =>
  COPY_DEMARRAGE.vigilance.subject;

export function ApporteurVigilanceEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.vigilance;
  const url = texteOuNull(p.dossierUrl);
  const renouvellement = p.variante === "renouvellement";
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
      {...(url ? { cta: { label: t.cta, href: url }, ctaSecret: true } : {})}
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {renouvellement ? t.renouvellement : t.premiere}
      </Text>
      {(renouvellement ? t.documentsRenouvellement : t.documents).map((d) => (
        <Text key={d} style={puce}>
          • {d}
        </Text>
      ))}
      <Text style={emailStyles.paragraphStyle}>{t.rassurer}</Text>
    </EmailLayout>
  );
}

// ── Commande signée ──────────────────────────────────────────────────────

export const apporteurCommandeSigneeSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string =>
  COPY_DEMARRAGE.commandeSignee.subject(
    texteOuNull((payload as Payload | undefined)?.entreprise) ?? "",
  );

export function ApporteurCommandeSigneeEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.commandeSignee;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.texte(texteOuNull(p.entreprise) ?? "")}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.suite}</Text>
    </EmailLayout>
  );
}

// ── Commission facturée (autofacture envoyée dès l'encaissement) ───────────────────────────────────────────────────────

export const apporteurReleveSubject = (
  _locale: Locale,
  _payload?: Record<string, unknown>,
): string => COPY_DEMARRAGE.releve.subject;

export function ApporteurReleveEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.releve;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {p.compense
          ? t.compense(texteOuNull(p.montant) ?? "")
          : t.texte(texteOuNull(p.montant) ?? "")}
      </Text>
      {Array.isArray(p.avoirs)
        ? p.avoirs.map((a) => (
            <Text key={a} style={emailStyles.paragraphStyle}>
              {texteOuNull(a)}
            </Text>
          ))
        : null}
      {p.compense ? (
        <Text style={emailStyles.paragraphStyle}>{t.net}</Text>
      ) : texteOuNull(p.sommeVirement) ? (
        <Text style={emailStyles.paragraphStyle}>
          {t.somme(texteOuNull(p.sommeVirement) ?? "")}
        </Text>
      ) : null}
      {texteOuNull(p.echeance) ? (
        <Text style={emailStyles.paragraphStyle}>{t.echeance(texteOuNull(p.echeance) ?? "")}</Text>
      ) : null}
      <Text style={emailStyles.paragraphStyle}>
        {t.facture(texteOuNull(p.numeroAutofacture) ?? "")}
      </Text>
    </EmailLayout>
  );
}

// ── Manquement ou fraude (contrat 2.3, art. 4.5 bis) ─────────────────────

export const apporteurManquementSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string =>
  (payload as Payload | undefined)?.avoirSeul
    ? COPY_DEMARRAGE.manquement.subjectAvoir
    : (payload as Payload | undefined)?.parrain
      ? COPY_DEMARRAGE.manquement.subjectParrain
      : COPY_DEMARRAGE.manquement.subject;

export function ApporteurManquementEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.manquement;
  return (
    <EmailLayout
      famille="B"
      preview={p.parrain ? t.subjectParrain : t.preview}
      title={p.parrain ? "Part de parrainage retirée" : t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      {p.avoirSeul ? (
        <>
          <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
          <Text style={emailStyles.paragraphStyle}>{t.avoir}</Text>
        </>
      ) : null}
      {p.avoirSeul ? null : (
        <>
          <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
          {p.parrain ? <Text style={emailStyles.paragraphStyle}>{t.parrain}</Text> : null}
          {p.parrain ? null : <Text style={emailStyles.paragraphStyle}>{t.intro}</Text>}
          {p.parrain ? null : (
            <Text style={{ ...emailStyles.paragraphStyle, fontStyle: "italic" }}>
              « {p.faits ?? ""} »
            </Text>
          )}
          {p.parrain ? null : <Text style={emailStyles.paragraphStyle}>{t.consequences}</Text>}
          {p.parrain ? null : <Text style={emailStyles.paragraphStyle}>{t.contester}</Text>}
        </>
      )}
    </EmailLayout>
  );
}

// ── Produit non commissionné (annexe 1, A1.7) ────────────────────────────

export const apporteurNonCommissionneSubject = (): string => COPY_DEMARRAGE.nonCommissionne.subject;

export function ApporteurNonCommissionneEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.nonCommissionne;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.texte}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, fontStyle: "italic" }}>
        « {texteOuNull(p.motifNonCommissionne) ?? ""} »
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.suite}</Text>
    </EmailLayout>
  );
}

// ── Commission suspendue, puis libérée (contrat 2.3, art. 4.2 bis) ──────

export const apporteurCommissionSuspensionSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string =>
  (payload as Payload | undefined)?.etat === "levee"
    ? COPY_DEMARRAGE.commissionSuspension.subjectLevee
    : COPY_DEMARRAGE.commissionSuspension.subjectSuspendue;

export function ApporteurCommissionSuspensionEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.commissionSuspension;
  const levee = p.etat === "levee";
  return (
    <EmailLayout
      famille="B"
      preview={levee ? t.previewLevee : t.previewSuspendue}
      title={levee ? t.titleLevee : t.titleSuspendue}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      <Text style={emailStyles.paragraphStyle}>{levee ? t.levee : t.suspendue}</Text>
      {levee ? null : <Text style={emailStyles.paragraphStyle}>{t.suspendueSuite}</Text>}
    </EmailLayout>
  );
}

// ── Commission annulée après l'avoir du client (art. 4.5) ───────────────

export const apporteurCommissionAvoirClientSubject = (
  _locale: Locale,
  _payload?: Record<string, unknown>,
): string => COPY_DEMARRAGE.commissionAvoirClient.subject;

export function ApporteurCommissionAvoirClientEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.commissionAvoirClient;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.texte}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.suite}</Text>
    </EmailLayout>
  );
}

// ── Dossier bien reçu (à la signature de l'apporteur) ────────────────────

export const apporteurDossierRecuSubject = (
  _locale: Locale,
  _payload?: Record<string, unknown>,
): string => COPY_DEMARRAGE.dossierRecu.subject;

export function ApporteurDossierRecuEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.dossierRecu;
  const url = texteOuNull(p.dossierUrl);
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
      {...(url ? { cta: { label: t.cta, href: url }, ctaSecret: true } : {})}
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.texte}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.suite}</Text>
      {url ? <Text style={emailStyles.paragraphStyle}>{t.lien}</Text> : null}
    </EmailLayout>
  );
}

// ── Virement fait (bouton « Virement fait » de la console) ───────────────

export const apporteurVirementFaitSubject = (
  _locale: Locale,
  _payload?: Record<string, unknown>,
): string => COPY_DEMARRAGE.virementFait.subject;

export function ApporteurVirementFaitEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.virementFait;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{bonjour(prenomDe(p))}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.texte(
          texteOuNull(p.montant) ?? "",
          texteOuNull(p.numeros) ?? "",
          texteOuNull(p.dateVirement) ?? "",
        )}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.suite}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.merci}</Text>
    </EmailLayout>
  );
}

// ── Interne : un dossier à vérifier ──────────────────────────────────────

export const apporteurDossierAVerifierSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string =>
  COPY_DEMARRAGE.interneAVerifier.subject(
    texteOuNull((payload as Payload | undefined)?.contactName) ?? "",
  );

export function ApporteurDossierAVerifierEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.interneAVerifier;
  const url = texteOuNull(p.lienConsole);
  return (
    <EmailLayout
      famille="A"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      {...(url ? { cta: { label: t.cta, href: url } } : {})}
    >
      <Text style={emailStyles.paragraphStyle}>{t.texte(texteOuNull(p.contactName) ?? "")}</Text>
    </EmailLayout>
  );
}

// ── Texte par défaut (pré-remplit la zone « Modifier le texte » de la console) ──

/** Gabarits dont Will peut réécrire le texte principal avant l'envoi. */
export const GABARITS_TEXTE_MODIFIABLE = [
  "apporteur-dossier-lien",
  "apporteur-dossier-a-completer",
  "apporteur-dossier-refuse",
  "apporteur-contrat-signe",
  "apporteur-presentation-recue",
  "apporteur-presentation-refusee",
  "entreprise-prise-de-contact-apporteur",
] as const;

export type GabaritTexteModifiable = (typeof GABARITS_TEXTE_MODIFIABLE)[number];

export function estTexteModifiable(g: string): g is GabaritTexteModifiable {
  return (GABARITS_TEXTE_MODIFIABLE as readonly string[]).includes(g);
}

/**
 * Le texte principal du gabarit, en texte brut, tel que l'e-mail le dit par défaut :
 * paragraphes séparés par une ligne vide, SANS le « Bonjour » (le gabarit l'ajoute),
 * sans le bouton, la signature, ni l'information RGPD (conservés autour du texte).
 * Pur. `null` pour un gabarit dont le texte n'est pas modifiable.
 */
export function texteParDefaut(gabarit: string, payload: Record<string, unknown>): string | null {
  if (!estTexteModifiable(gabarit)) return null;
  const p = payload as Payload;
  const mot = texteOuNull(p.motPersonnel);
  const avecMot = (blocs: Array<string | null>): string =>
    blocs.filter((b): b is string => b !== null && b !== "").join("\n\n");
  const liste = (xs: readonly string[], num = false): string =>
    xs.map((x, i) => `${num ? `${i + 1}.` : "•"} ${x}`).join("\n");

  switch (gabarit) {
    case "apporteur-dossier-lien": {
      const t = COPY_DEMARRAGE.dossierLien;
      const r = COPY_DEMARRAGE.dossierRappel;
      const intro = p.rappel === 1 ? r.intro1 : p.rappel === 2 ? r.intro2 : t.intro;
      return avecMot([mot, intro, liste(t.etapes, true), t.ensuite]);
    }
    case "apporteur-dossier-a-completer": {
      // Les pièces à retransmettre restent listées par le gabarit, sous ce texte.
      const t = COPY_DEMARRAGE.aCompleter;
      return avecMot([t.intro, mot ? `${t.note} ${mot}` : null, t.suite]);
    }
    case "apporteur-dossier-refuse": {
      const t = COPY_DEMARRAGE.refuse;
      return avecMot([t.texte, mot, t.fin]);
    }
    case "apporteur-contrat-signe": {
      const t = COPY_DEMARRAGE.contratSigne;
      const [e1, e2, e3] = t.ensuite;
      return avecMot([
        mot,
        t.merci,
        `${t.presenterTitre}\n${t.presenter}\n${liste(t.champs)}`,
        t.prevenir,
        `${t.ensuiteTitre}\n1. ${e1}\n2. ${e2}\n3. ${e3(FENETRE_ATTRIBUTION_APPORTEUR_MOIS)}`,
        `${t.commissionTitre}\n${lignesBareme()
          .map((ligne) => `• ${ligne}`)
          .join("\n")}\n• ${t.parrainage(pourcent(PCT_PARRAINAGE), PARRAINAGE_MOIS)}`,
        t.paiement,
        "Votre contrat signé des deux parties est en pièce jointe.",
      ]);
    }
    case "apporteur-presentation-recue": {
      const t = COPY_DEMARRAGE.presentationRecue;
      return avecMot([
        mot,
        t.recu(texteOuNull(p.entreprise) ?? "", texteOuNull(p.datePresentation)),
        `${t.suiteTitre}\n${t.confirmation(texteOuNull(p.personnePresentee))}`,
        t.protection(FENETRE_ATTRIBUTION_APPORTEUR_MOIS, CONFIRMATION_TACITE_JOURS),
        t.relais,
      ]);
    }
    case "apporteur-presentation-refusee": {
      const t = COPY_DEMARRAGE.presentationRefusee;
      return avecMot([
        mot,
        t.merci(texteOuNull(p.entreprise) ?? "", texteOuNull(p.datePresentation)),
        t.motif[lireMotif(p.motif)],
        t.contester(REPONSE_CONTESTATION_JOURS),
        t.sansConsequence,
      ]);
    }
    case "entreprise-prise-de-contact-apporteur": {
      const t = COPY_DEMARRAGE.confirmation;
      return avecMot([
        t.presentation(texteOuNull(p.nomApporteur) ?? "", texteOuNull(p.entreprise)),
        t.quiSommesNous,
        t.proposition,
      ]);
    }
  }
}
