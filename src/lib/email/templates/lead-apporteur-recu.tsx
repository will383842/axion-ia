// E-mail — PREMIER E-MAIL d'une personne intéressée par le réseau d'apporteurs
// d'affaires, dès qu'on a son adresse (2026-09-03, kit ajouté le 2026-09-19).
//
// Ton : chaleureux, VOUVOIEMENT (Will, 2026-09-29 : tout ce que reçoit un
// candidat vouvoie, comme les accusés de réception des offres d'emploi).
//
// Deux variantes, un seul gabarit — elles ne diffèrent que par l'accroche :
//   · `premier-contact` (défaut) — le formulaire court de la landing Facebook,
//     qui demande le kit : on confirme que c'est noté, SANS promettre d'appel
//     (décision Will 2026-09-19, B4 — l'échange de 15 minutes part sur
//     invitation, aux seuls profils retenus) ;
//   · `dossier-commence` — la personne a validé l'écran 1 du dossier et ne l'a
//     pas fini. Envoyé 30 minutes plus tard (`DELAI_KIT_DOSSIER_COMMENCE_MS`),
//     et ANNULÉ si le dossier arrive entre-temps : elle n'a rien demandé
//     d'autre que de candidater.
//
// Deux variantes du tunnel avec vidéo (2026-10-05, 03-MESSAGES-ET-DECISIONS §2) :
//   · `vsl-abandon` (A1) — l'étape 1 (prénom + e-mail) est validée, pas la
//     suivante. Envoyé 30 min plus tard, ANNULÉ dès l'étape 2, le dossier
//     complet ou une réservation. Le bouton ramène à la page (lien de reprise) ;
//   · `vsl-etape2` (B1) — l'étape 2 (téléphone + question) est validée : « C'est
//     noté » + LE bouton de réservation, qui est ici le CTA. Dit « choisissez
//     votre créneau », jamais « votre candidature est retenue » (c'est le texte
//     de l'invitation du filet à +24 h, R4) ; aucune retenue, aucun délai promis.
//     Seul e-mail automatique, avec l'invitation, à porter le lien de réservation.
//
// Il fait trois choses, dans cet ordre :
//   1. dire que c'est noté — sans délai chiffré, sans appel promis ;
//   2. donner le KIT (décision Will 2026-09-19 : tout le monde le reçoit dès
//      qu'on a son adresse) — le catalogue seul depuis JUR-T44 : le document
//      de présentation est retiré jusqu'à sa réécriture (`DOCUMENT_APPORTEUR_DIFFUSE`) ;
//   3. proposer de compléter le dossier (3 minutes, sans CV) : le CTA principal.
//
// ⛔ AUCUN lien de réservation d'appel ici. Le lien Calendly n'est envoyé
// qu'aux personnes que Will choisit, depuis la console (`apporteur-invitation-
// appel`) — distribué à tous, il saturerait son agenda.
//
// Vocabulaire : « apporteur d'affaires », jamais « commercial », « poste »,
// « recrutement » — décision Will 2026-09-03, et première pièce du faisceau
// anti-requalification (`docs/partners/ANTI-REQUALIFICATION.md`).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { BlocKitApporteur } from "./_kit-apporteur";
import { lienDeReservationDuSite } from "@/lib/calendly/lien-du-site";
import { VARIANTE_DOSSIER_COMMENCE } from "@/lib/commercial-application/kit-apporteur";
import {
  VARIANTE_VSL_ABANDON,
  VARIANTE_VSL_ETAPE2,
} from "@/lib/commercial-application/vsl-apporteur";
import type { Locale } from "../../../../prisma/generated/client";

/**
 * Nom du paramètre du jeton (`PARAM_JETON_VSL`, `identite-reservation-vsl.ts`).
 * Recopié ici : ce module-là lit la base, un gabarit d'e-mail ne l'importe pas.
 */
const PARAM_JETON_VSL = "j";

interface Payload {
  /** Prénom (seul le premier mot est dit). */
  contactName?: string;
  submissionId?: string;
  /** Lien du dossier complet — le wizard, pré-rempli par le brouillon local. */
  dossierUrl: string;
  /** `dossier-commence` pour la personne qui a quitté le dossier en cours ; `vsl-*` : tunnel vidéo. */
  variante?: string;
  /** `vsl-etape2` : le lien de réservation (bouton principal). */
  calendlyUrl?: string;
  /** `vsl-etape2` : jeton signé recopié dans le lien (`?j=`), pour préremplir la réservation. */
  jetonReservation?: string;
}

/**
 * Le lien de réservation de B1 : la page du site (`?depuis=` pour l'attribution) et,
 * quand le message en porte un, le jeton `?j=` qui préremplit le formulaire. Le
 * jeton n'est ajouté qu'à NOTRE page apporteur : jamais à une adresse Calendly
 * rendue telle quelle, ni à une page qui en porte déjà un.
 */
function lienReservationB1(p: Payload): string {
  const lien = lienDeReservationDuSite(p.calendlyUrl as string, { depuis: "email-vsl-apporteur" });
  if (!p.jetonReservation) return lien;
  try {
    const u = new URL(lien);
    if (!u.pathname.endsWith("/appel/apporteur") || u.searchParams.has(PARAM_JETON_VSL)) {
      return lien;
    }
    u.searchParams.set(PARAM_JETON_VSL, p.jetonReservation);
    return u.toString();
  } catch {
    return lien;
  }
}

const COPY = {
  fr: {
    title: "C'est noté",
    preview:
      "Le catalogue de nos prestations, et votre candidature à compléter si vous le souhaitez.",
    body: "Vous venez de nous laisser vos coordonnées pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA. Voici le catalogue de ce que vous pourrez recommander. Si votre profil correspond, nous vous proposons un échange de 15 minutes pour faire connaissance. Aucun engagement : vous décidez après.",
    titleDossier: "Votre candidature vous attend",
    previewDossier:
      "Le catalogue de nos prestations, et votre candidature à terminer : il reste quelques écrans.",
    bodyDossier:
      "Vous avez commencé votre candidature pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA. Merci ! Elle n'est pas encore arrivée : il vous reste quelques écrans.",
    // 2026-10-10 (décision de Will) — « votre demande » dans tout le tunnel vidéo :
    // ni « candidature » ni « inscription », la cible apporte déjà des affaires.
    titleAbandon: "Votre demande n'est pas terminée",
    previewAbandon: "Il vous reste une étape pour terminer votre demande.",
    bodyAbandon:
      "Vous avez commencé votre demande pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA, et il ne vous reste qu'une étape : votre numéro de téléphone et une question. Vos informations sont déjà enregistrées, il suffit de reprendre là où vous vous êtes arrêté.",
    ctaAbandon: "Terminer ma demande",
    titleEtape2: "C'est noté",
    previewEtape2: "Choisissez le créneau qui vous convient pour un échange de 15 minutes.",
    bodyEtape2:
      "Merci, votre demande pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA est bien enregistrée. Pour faire connaissance, choisissez dès maintenant le créneau qui vous convient pour un échange de 15 minutes en visio. Aucun engagement : vous décidez après.",
    ctaEtape2: "Choisir mon créneau",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    dossier:
      "Et pour que nous préparions notre échange à partir de votre situation, complétez votre candidature — trois minutes, sans CV, sans lettre de motivation. Vos coordonnées sont déjà remplies.",
    spam: "Pensez à vérifier vos spams si vous n'avez pas de nouvelles : nos e-mails s'y égarent parfois.",
    cta: "Compléter ma candidature",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Noted",
    preview: "Our catalogue of services, and your file to complete if you like.",
    body: "You just left us your details to join Axion-IA's network of business introducers. Here is the catalogue of what you will be able to recommend. If your profile is a match, we will offer you a 15-minute call to get acquainted. No commitment: you decide afterwards.",
    titleDossier: "Your application is waiting",
    previewDossier: "Our catalogue of services, and your file to finish: only a few screens left.",
    bodyDossier:
      "You started your file to join Axion-IA's network of business introducers. Thank you! It has not arrived yet: only a few screens are left.",
    titleAbandon: "Your request is not finished",
    previewAbandon: "One step left to finish your request.",
    bodyAbandon:
      "You started your request to join Axion-IA's network of business introducers, and only one step is left: your phone number and one question. Your details are already saved, just pick up where you left off.",
    ctaAbandon: "Finish my request",
    titleEtape2: "Noted",
    previewEtape2: "Pick the slot that suits you for a 15-minute call.",
    bodyEtape2:
      "Thank you, your request to join Axion-IA's network of business introducers is saved. To get acquainted, pick the slot that suits you for a 15-minute video call. No commitment: you decide afterwards.",
    ctaEtape2: "Pick my slot",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    dossier:
      "And so we can prepare our conversation around your situation, complete your file — three minutes, no resume, no cover letter. Your details are already filled in.",
    spam: "Check your spam folder if you do not hear from us: our emails sometimes end up there.",
    cta: "Complete my application",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

function estDossierCommence(p: Record<string, unknown>): boolean {
  return p["variante"] === VARIANTE_DOSSIER_COMMENCE;
}

function estVslAbandon(p: Record<string, unknown>): boolean {
  return p["variante"] === VARIANTE_VSL_ABANDON;
}

function estVslEtape2(p: Record<string, unknown>): boolean {
  return p["variante"] === VARIANTE_VSL_ETAPE2;
}

export const leadApporteurRecuSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const t = COPY[locale === "fr" ? "fr" : "en"];
  if (estVslAbandon(p)) return t.titleAbandon;
  if (estVslEtape2(p)) return t.titleEtape2;
  return estDossierCommence(p) ? t.titleDossier : t.title;
};

export function LeadApporteurRecuEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const dossierCommence = estDossierCommence(payload);
  const abandon = estVslAbandon(payload);
  // Sans lien de réservation exploitable, B1 retombe sur le comportement d'un
  // accusé ordinaire : jamais un bouton qui ne mène nulle part.
  const etape2 = estVslEtape2(payload) && Boolean(p.calendlyUrl);
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  const titre = abandon
    ? t.titleAbandon
    : etape2
      ? t.titleEtape2
      : dossierCommence
        ? t.titleDossier
        : t.title;
  const apercu = abandon
    ? t.previewAbandon
    : etape2
      ? t.previewEtape2
      : dossierCommence
        ? t.previewDossier
        : t.preview;
  const corps = abandon
    ? t.bodyAbandon
    : etape2
      ? t.bodyEtape2
      : dossierCommence
        ? t.bodyDossier
        : t.body;
  const bouton = etape2
    ? {
        label: t.ctaEtape2,
        // 2026-10-05 : NOTRE page de réservation quand l'adresse est celle de
        // l'échange apporteur, l'adresse reçue sinon (`lien-du-site.ts`).
        href: lienReservationB1(p),
      }
    : { label: abandon ? t.ctaAbandon : t.cta, href: p.dossierUrl };
  return (
    <EmailLayout
      famille="B"
      preview={apercu}
      title={titre}
      cta={bouton}
      locale={locale}
      sansReseauxSociaux
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{corps}</Text>
      <BlocKitApporteur locale={locale} />
      {abandon || etape2 ? null : <Text style={emailStyles.paragraphStyle}>{t.dossier}</Text>}
      <Text style={emailStyles.paragraphStyle}>{t.spam}</Text>
      {p.submissionId ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.refRow(String(p.submissionId))}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
