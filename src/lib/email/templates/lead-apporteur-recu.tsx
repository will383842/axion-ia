// E-mail — PREMIER E-MAIL d'une personne intéressée par le réseau d'apporteurs
// d'affaires, dès qu'on a son adresse (2026-09-03, kit ajouté le 2026-09-19).
//
// Ton : chaleureux, TUTOIEMENT (le tunnel tutoie de bout en bout).
//
// Deux variantes, un seul gabarit — elles ne diffèrent que par l'accroche :
//   · `premier-contact` (défaut) — le formulaire court de la landing Facebook,
//     qui demande « qu'on m'appelle » : on confirme qu'on appelle ;
//   · `dossier-commence` — la personne a validé l'écran 1 du dossier et ne l'a
//     pas fini. Envoyé 30 minutes plus tard (`DELAI_KIT_DOSSIER_COMMENCE_MS`),
//     et ANNULÉ si le dossier arrive entre-temps : elle n'a rien demandé
//     d'autre que de candidater, on ne lui promet donc pas d'appel.
//
// Il fait trois choses, dans cet ordre :
//   1. dire que c'est noté — SANS délai chiffré sur l'appel ;
//   2. donner le KIT : document de présentation + catalogue (décision Will
//      2026-09-19 : tout le monde le reçoit dès qu'on a son adresse) ;
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
  /** Prénom (le tutoiement appelle le prénom seul). */
  contactName?: string;
  submissionId?: string;
  /** Lien du dossier complet — le wizard, pré-rempli par le brouillon local. */
  dossierUrl: string;
  /** `dossier-commence` pour la personne qui a quitté le dossier en cours. */
  variante?: string;
}

const COPY = {
  fr: {
    title: "C'est noté, on t'appelle",
    preview:
      "En attendant l'appel : le document de présentation, le catalogue, et ton dossier à compléter si tu veux.",
    body: "Tu viens de nous laisser tes coordonnées pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA. On t'appelle pour faire connaissance, t'expliquer comment ça marche et répondre à tes questions. Aucun engagement : tu décides après.",
    titleDossier: "Ton dossier t'attend",
    previewDossier:
      "Le document de présentation, le catalogue, et ton dossier à terminer : il reste quelques écrans.",
    bodyDossier:
      "Tu as commencé ton dossier pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA. Merci ! Il n'est pas encore arrivé : il te reste quelques écrans.",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    dossier:
      "Et pour qu'on prépare notre échange à partir de ta situation, complète ton dossier — trois minutes, sans CV, sans lettre de motivation. Tes coordonnées sont déjà remplies.",
    spam: "Pense à vérifier tes spams si tu n'as pas de nouvelles : nos e-mails s'y égarent parfois.",
    cta: "Compléter mon dossier",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Noted, we'll call you",
    preview:
      "While you wait for our call: the presentation document, the catalogue, and your file to complete if you like.",
    body: "You just left us your details to join Axion-IA's network of business introducers. We'll call you to get acquainted, explain how it works and answer your questions. No commitment: you decide afterwards.",
    titleDossier: "Your file is waiting",
    previewDossier:
      "The presentation document, the catalogue, and your file to finish: only a few screens left.",
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
      tutoiement
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
