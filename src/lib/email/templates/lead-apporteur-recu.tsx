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
import { VARIANTE_DOSSIER_COMMENCE } from "@/lib/commercial-application/kit-apporteur";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Prénom (seul le premier mot est dit). */
  contactName?: string;
  submissionId?: string;
  /** Lien du dossier complet — le wizard, pré-rempli par le brouillon local. */
  dossierUrl: string;
  /** `dossier-commence` pour la personne qui a quitté le dossier en cours. */
  variante?: string;
}

const COPY = {
  fr: {
    title: "C'est noté",
    preview: "Le catalogue de nos prestations, et votre dossier à compléter si vous le souhaitez.",
    body: "Vous venez de nous laisser vos coordonnées pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA. Voici le catalogue de ce que vous pourrez recommander. Si votre profil correspond, nous vous proposons un échange de 15 minutes pour faire connaissance. Aucun engagement : vous décidez après.",
    titleDossier: "Votre dossier vous attend",
    previewDossier:
      "Le catalogue de nos prestations, et votre dossier à terminer : il reste quelques écrans.",
    bodyDossier:
      "Vous avez commencé votre dossier pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA. Merci ! Il n'est pas encore arrivé : il vous reste quelques écrans.",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    dossier:
      "Et pour que nous préparions notre échange à partir de votre situation, complétez votre dossier — trois minutes, sans CV, sans lettre de motivation. Vos coordonnées sont déjà remplies.",
    spam: "Pensez à vérifier vos spams si vous n'avez pas de nouvelles : nos e-mails s'y égarent parfois.",
    cta: "Compléter mon dossier",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Noted",
    preview: "Our catalogue of services, and your file to complete if you like.",
    body: "You just left us your details to join Axion-IA's network of business introducers. Here is the catalogue of what you will be able to recommend. If your profile is a match, we will offer you a 15-minute call to get acquainted. No commitment: you decide afterwards.",
    titleDossier: "Your file is waiting",
    previewDossier: "Our catalogue of services, and your file to finish: only a few screens left.",
    bodyDossier:
      "You started your file to join Axion-IA's network of business introducers. Thank you! It has not arrived yet: only a few screens are left.",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    dossier:
      "And so we can prepare our conversation around your situation, complete your file — three minutes, no resume, no cover letter. Your details are already filled in.",
    spam: "Check your spam folder if you do not hear from us: our emails sometimes end up there.",
    cta: "Complete my file",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

function estDossierCommence(p: Record<string, unknown>): boolean {
  return p["variante"] === VARIANTE_DOSSIER_COMMENCE;
}

export const leadApporteurRecuSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const t = COPY[locale === "fr" ? "fr" : "en"];
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
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  return (
    <EmailLayout
      famille="B"
      preview={dossierCommence ? t.previewDossier : t.preview}
      title={dossierCommence ? t.titleDossier : t.title}
      cta={{ label: t.cta, href: p.dossierUrl }}
      locale={locale}
      sansReseauxSociaux
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{dossierCommence ? t.bodyDossier : t.body}</Text>
      <BlocKitApporteur locale={locale} />
      <Text style={emailStyles.paragraphStyle}>{t.dossier}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.spam}</Text>
      {p.submissionId ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.refRow(String(p.submissionId))}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
