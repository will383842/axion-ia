// Email — accusé de réception du DOSSIER COMPLET d'apporteur d'affaires
// (tunnel sans CV, Mémorial de l'Isère 2026-08-12 ; refondu le 2026-09-19).
//
// Ton : chaleureux, VOUVOIEMENT (Will, 2026-09-29 : tout ce que reçoit un
// candidat vouvoie, comme les accusés de réception des offres d'emploi). Confirme la réception, annonce la suite et donne le KIT
// (le catalogue ; le document de présentation est retiré jusqu'à sa réécriture,
// JUR-T44 — voir `DOCUMENT_APPORTEUR_DIFFUSE`).
//
// 🔴 2026-09-19 — trois décisions de Will, appliquées ici :
//   1. « commercial indépendant » → « réseau d'apporteurs d'affaires ». Le mot
//      « commercial » nomme un métier de vente pour le compte d'autrui : c'est
//      la première pièce du faisceau de requalification
//      (`docs/partners/ANTI-REQUALIFICATION.md`). Le nom technique du gabarit
//      reste, il n'est lu par personne.
//   2. « On revient vers toi dans les prochaines semaines » est RETIRÉ, remplacé
//      par « dans les prochaines heures ». Cela lève, pour ce message, la règle
//      du 2026-08-23 (« aucun délai de réponse promis ») — décision explicite de
//      Will, qui répond lui-même.
//   3. L'échange proposé dure 15 minutes (et non « 15 à 30 »). Le lien de
//      réservation n'est PAS ici : Will l'envoie à qui il choisit, depuis la
//      console (`apporteur-invitation-appel`).
//
// Le nom de fichier et la clé `candidature-commercial-confirmee` sont conservés :
// ils figurent dans l'historique des envois (`EmailLog.template`).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { BlocKitApporteur } from "./_kit-apporteur";
import type { Locale } from "../../../../prisma/generated/client";
import { liensKitApporteur } from "@/lib/commercial-application/kit-apporteur";

interface Payload {
  /** Prénom du candidat (seul le premier mot est dit). */
  contactName?: string;
  submissionId?: string;
}

const COPY = {
  fr: {
    title: "Nous avons bien reçu votre candidature",
    preview:
      "Nous répondons à TOUTES les candidatures, dans les prochaines heures. En attendant : le catalogue de ce que vous pourrez recommander.",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: "Merci d'avoir pris ces quelques minutes : votre candidature pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA est bien arrivée, et elle sera lue avec attention — c'est promis, pas par un robot.",
    // « On répond à TOUTES les candidatures » tient la promesse de l'annonce
    // Le Bon Coin (docs/annonce-leboncoin-recrutement.md §2.5) : un candidat
    // non retenu reçoit, lui aussi, une réponse.
    next: "Nous répondons à toutes les candidatures : la vôtre aura une réponse, quoi qu'il arrive, dans les prochaines heures. Si votre profil correspond, nous vous proposerons un échange de 15 minutes en visio pour faire connaissance.",
    spam: "Pensez à vérifier vos spams si vous n'avez pas de nouvelles : nos emails s'y égarent parfois.",
    cta: "Voir le catalogue des prestations",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "We received your application",
    preview:
      "We answer EVERY application, within the next few hours. Meanwhile: the catalogue of what you will be able to recommend.",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: "Thanks for taking a few minutes: your application to join Axion-IA's network of business introducers has arrived, and it will be read carefully — by a human, promise.",
    next: "We answer every application: yours will get a reply either way, within the next few hours. If your profile is a match, we will offer you a 15-minute video call to get acquainted.",
    spam: "Check your spam folder if you do not hear from us: our emails sometimes end up there.",
    cta: "See our catalogue of services",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const candidatureCommercialConfirmeeSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string =>
  locale === "fr" ? "Nous avons bien reçu votre candidature" : "We received your application";

export function CandidatureCommercialConfirmeeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      cta={{ label: t.cta, href: liensKitApporteur(locale).catalogueUrl }}
      locale={locale}
      sansReseauxSociaux
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.next}</Text>
      <BlocKitApporteur locale={locale} />
      <Text style={emailStyles.paragraphStyle}>{t.spam}</Text>
      {p.submissionId ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.refRow(String(p.submissionId))}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
