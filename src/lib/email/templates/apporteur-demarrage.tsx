// E-mails — le RÉSEAU D'APPORTEURS EN DÉMARRAGE MANUEL (2026-10-05).
//
// Tant que l'espace apporteur (Axion Partners) n'est pas ouvert, Will gère les
// apporteurs signés depuis la console : les présentations arrivent par e-mail,
// et la console envoie les réponses. Quatre messages, un seul fichier :
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
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR, getCommissionById } from "@/content/pricing";
import { FENETRE_ATTRIBUTION_APPORTEUR_MOIS } from "@/lib/commercial-application/kit-apporteur";
import { IDENTITE_LEGALE, adresseSiegeUneLigne } from "@/lib/identite-legale-ssot";
import type { Locale } from "../../../../prisma/generated/client";

/** Délai de la confirmation réputée acquise (contrat, art. 3.2 — CONFIRMATION_TACITE_JOURS). */
export const CONFIRMATION_TACITE_JOURS = 30;
/** Délai de réponse à une contestation (contrat, art. 3.3). */
const REPONSE_CONTESTATION_JOURS = 15;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com").replace(/\/+$/, "");
const LIEN_RENDEZ_VOUS = `${SITE_URL}/fr/appel?depuis=email-apporteur`;
const LIEN_POLITIQUE = `${SITE_URL}/fr/politique-confidentialite#reseau-d-apporteurs-d-affaires`;

const PCT_AUDIT = getCommissionById("com-audit").percent ?? 0;
const PCT_INTEGRATION = getCommissionById("com-integration").percent ?? 0;

export type MotifRefus = "deja-connue" | "pas-disponible" | "hors-champ";

interface Payload {
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
  /** Confirmation seulement : « Monsieur » / « Madame », et le nom de famille. */
  civilite?: string;
  nomFamille?: string;
  /** Confirmation seulement : prénom et nom de l'apporteur (art. 3.2 : ils sont communiqués). */
  nomApporteur?: string;
  /** Quelques mots de Will, ajoutés en haut du message. Facultatif. */
  motPersonnel?: string;
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
      "Répondez simplement à cet e-mail, ou écrivez-nous à contact@axion-ia.com avec pour objet « Nouvelle entreprise ». Indiquez :",
    champs: [
      "le nom de l'entreprise et son numéro SIREN ;",
      "la personne rencontrée : son nom, sa fonction, son e-mail et son téléphone ;",
      "la date de votre échange et son besoin, en une ligne.",
    ],
    prevenir:
      "Prévenez simplement la personne que vous nous transmettez ses coordonnées : nous prendrons contact avec elle de votre part.",
    ensuiteTitre: "Ensuite",
    ensuite: [
      "Nous regardons si l'entreprise est disponible et vous répondons.",
      "Si elle l'est, elle vous est réservée : la date de votre e-mail fait foi.",
      (mois: number) =>
        `Dès que nous avons pris contact avec l'entreprise de votre part, toutes ses commandes signées pendant ${mois} mois vous sont commissionnées. Vous n'avez pas à suivre le client : nous nous en occupons.`,
    ],
    commissionTitre: "Votre commission",
    formation: (eur: number) =>
      `Formation : ${eur} € HT par journée de formation au tarif public (réduite au prorata en cas de remise accordée au client).`,
    audit: (pct: string) => `Audit : ${pct} du montant HT de la facture.`,
    integration: (pct: string) => `Intégration : ${pct} du montant HT de la facture.`,
    paiement:
      "Elle vous est versée dès que le client a réglé l'intégralité de sa facture : nous établissons votre facture pour vous, puis nous faisons le virement.",
    fiche:
      "Vous trouverez en pièce jointe la fiche « Comment ça marche », à garder sous la main.",
  },
  presentationRecue: {
    subject: (e: string) => (e ? `${e} : c'est noté, elle vous est réservée` : "C'est noté, l'entreprise vous est réservée"),
    title: "Bien reçu : elle est à vous",
    preview:
      "L'entreprise est disponible. Voici ce qui se passe maintenant, et ce que vous n'avez pas à faire.",
    recu: (e: string, d: string | null) =>
      `Nous avons bien reçu votre présentation de ${e || "l'entreprise"}${d ? ` du ${d}` : ""}. Elle est disponible : nous la réservons à votre nom.`,
    suiteTitre: "La suite",
    confirmation: (personne: string | null) =>
      `Nous prenons contact avec ${personne ?? "la personne que vous avez rencontrée"} de votre part : nous lui indiquons que c'est vous qui nous avez parlé d'elle (votre prénom et votre nom, jamais vos coordonnées).`,
    protection: (mois: number, jours: number) =>
      `Dès qu'elle nous répond, ou au plus tard ${jours} jours après notre message, toutes les commandes de l'entreprise signées pendant ${mois} mois vous sont commissionnées.`,
    relais: "Nous prenons le relais : vous n'avez rien d'autre à faire.",
  },
  presentationRefusee: {
    subject: (e: string) => (e ? `Votre présentation de ${e}` : "Votre présentation"),
    title: "Cette entreprise n'est pas disponible",
    preview:
      "Merci pour votre présentation. Voici pourquoi nous ne pouvons pas vous la réserver.",
    merci: (e: string, d: string | null) =>
      `Merci pour votre présentation de ${e || "l'entreprise"}${d ? ` du ${d}` : ""}.`,
    motif: {
      "deja-connue":
        "Nous ne pouvons pas vous la réserver : elle est déjà cliente d'Axion-IA, ou elle a reçu un devis de notre part récemment.",
      "pas-disponible":
        "Nous ne pouvons pas vous la réserver : elle nous a déjà été présentée. Si elle redevient disponible, nous vous préviendrons et vous aurez 15 jours pour nous la présenter à nouveau.",
      "hors-champ":
        "Nous ne pouvons pas vous la réserver : il s'agit d'un organisme avec lequel Axion-IA travaille déjà directement (administration, financeur ou organisme de formation), ou d'une entreprise qui a cessé son activité.",
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

// ── Contrat signé ────────────────────────────────────────────────────────

export const apporteurContratSigneSubject = (_locale: Locale): string =>
  COPY_DEMARRAGE.contratSigne.subject;

export function ApporteurContratSigneEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.contratSigne;
  const [e1, e2, e3] = t.ensuite;
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
      <Text style={emailStyles.paragraphStyle}>3. {e3(FENETRE_ATTRIBUTION_APPORTEUR_MOIS)}</Text>

      <Text style={intertitre}>{t.commissionTitre}</Text>
      <Text style={puce}>• {t.formation(COMMISSION_FORMATION_PAR_JOURNEE_EUR)}</Text>
      <Text style={puce}>• {t.audit(pourcent(PCT_AUDIT))}</Text>
      <Text style={puce}>• {t.integration(pourcent(PCT_INTEGRATION))}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.paiement}</Text>

      <Text style={emailStyles.paragraphStyle}>{t.fiche}</Text>
    </EmailLayout>
  );
}

// ── Présentation reçue ───────────────────────────────────────────────────

export const apporteurPresentationRecueSubject = (_locale: Locale, payload?: Record<string, unknown>): string =>
  COPY_DEMARRAGE.presentationRecue.subject(texteOuNull((payload as Payload | undefined)?.entreprise) ?? "");

export function ApporteurPresentationRecueEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.presentationRecue;
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
      <MotPersonnel p={p} />
      <Text style={emailStyles.paragraphStyle}>
        {t.recu(texteOuNull(p.entreprise) ?? "", texteOuNull(p.datePresentation))}
      </Text>
      <Text style={intertitre}>{t.suiteTitre}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.confirmation(texteOuNull(p.personnePresentee))}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.protection(FENETRE_ATTRIBUTION_APPORTEUR_MOIS, CONFIRMATION_TACITE_JOURS)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.relais}</Text>
    </EmailLayout>
  );
}

// ── Présentation refusée ─────────────────────────────────────────────────

export const apporteurPresentationRefuseeSubject = (_locale: Locale, payload?: Record<string, unknown>): string =>
  COPY_DEMARRAGE.presentationRefusee.subject(texteOuNull((payload as Payload | undefined)?.entreprise) ?? "");

function lireMotif(v: unknown): MotifRefus {
  return v === "pas-disponible" || v === "hors-champ" ? v : "deja-connue";
}

export function ApporteurPresentationRefuseeEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.presentationRefusee;
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
      <MotPersonnel p={p} />
      <Text style={emailStyles.paragraphStyle}>
        {t.merci(texteOuNull(p.entreprise) ?? "", texteOuNull(p.datePresentation))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.motif[lireMotif(p.motif)]}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.contester(REPONSE_CONTESTATION_JOURS)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.sansConsequence}</Text>
    </EmailLayout>
  );
}

// ── Confirmation demandée à l'entreprise ─────────────────────────────────

export const entrepriseConfirmationApporteurSubject = (_locale: Locale, payload?: Record<string, unknown>): string =>
  COPY_DEMARRAGE.confirmation.subject(texteOuNull((payload as Payload | undefined)?.nomApporteur) ?? "");

export function EntrepriseConfirmationApporteurEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_DEMARRAGE.confirmation;
  const nomApporteur = texteOuNull(p.nomApporteur) ?? "";
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
      <Text style={emailStyles.paragraphStyle}>
        {t.presentation(nomApporteur, texteOuNull(p.entreprise))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.quiSommesNous}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.proposition}</Text>
      {/* Petit, après le corps : l'information de l'art. 14 RGPD (l'adresse vient
          d'un tiers). ⛔ AUCUNE question de contrôle : on ne dit jamais à
          l'entreprise qu'on vérifie (Will, 2026-10-05 : « contre-vendeur »). */}
      <Text style={{ ...emailStyles.paragraphStyle, fontSize: "13px", color: emailStyles.COLORS.textMuted }}>
        {t.info(IDENTITE_LEGALE.legalName, adresseSiegeUneLigne())}
        <a href={LIEN_POLITIQUE} style={{ color: emailStyles.COLORS.terracotta }}>
          {t.infoLien}
        </a>
        . {t.desinscription}
      </Text>
    </EmailLayout>
  );
}
