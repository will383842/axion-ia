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
//      par « dans les prochaines heures ». PÉRIMÉ depuis le 2026-11-11 : Williams retire
//      toute promesse de délai ; la règle du 2026-08-23 (« aucun délai de réponse
//      promis ») s'applique de nouveau à ce message.
//   3. L'échange proposé dure 15 minutes (et non « 15 à 30 »).
//
// 🔴 2026-11-11 — décision de Williams, qui REMPLACE B5 (19/09, « pas de lien de
// réservation distribué à tous ») pour ce message : l'invitation annoncée
// n'arrivait pas. Le bouton de ce message EST désormais l'invitation —
// « Réserver votre échange de 15 minutes » — et il mène à NOTRE page de
// réservation (`/fr/appel/apporteur`), où la personne choisit son créneau
// Calendly. Le lien vient de `lienDuSite("apporteur")`, la seule source des
// liens de rendez-vous écrits dans un e-mail : aucune adresse en dur ici, et
// aucune variable d'environnement n'est nécessaire à l'envoi.
// Toujours aucun délai promis, et aucune promesse de réponse.
//
// Le nom de fichier et la clé `candidature-commercial-confirmee` sont conservés :
// ils figurent dans l'historique des envois (`EmailLog.template`).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { BlocKitApporteur } from "./_kit-apporteur";
import type { Locale } from "../../../../prisma/generated/client";
import { lienDuSite } from "@/lib/calendly/lien-du-site";

/** Emplacement du bouton, mesuré en `depuis` sur la page de réservation. */
export const DEPUIS_CONFIRMATION_DOSSIER = "email-confirmation-apporteur";

interface Payload {
  /** Prénom du candidat (seul le premier mot est dit). */
  contactName?: string;
  submissionId?: string;
}

const COPY = {
  fr: {
    title: "Nous avons bien reçu votre candidature",
    preview:
      "Votre dossier est bien arrivé. Prochaine étape : réservez votre échange de 15 minutes en visio.",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: "Merci d'avoir pris ces quelques minutes : votre candidature pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA est bien arrivée, et elle sera lue avec attention — c'est promis, pas par un robot.",
    // 11/11/2026, Williams : ni délai, ni promesse de réponse — la personne
    // choisit elle-même son créneau, avec le bouton du message.
    next: "Prochaine étape : un échange de 15 minutes en visio pour faire connaissance, sans engagement. Choisissez vous-même le créneau qui vous arrange avec le bouton ci-dessous.",
    spam: "Pensez à vérifier vos spams : nos emails s'y égarent parfois.",
    cta: "Réserver votre échange de 15 minutes",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "We received your application",
    preview: "Your file has arrived. Next step: book your 15-minute video call.",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: "Thanks for taking a few minutes: your application to join Axion-IA's network of business introducers has arrived, and it will be read carefully — by a human, promise.",
    next: "Next step: a 15-minute video call to get acquainted, with no commitment. Pick the time that suits you with the button below.",
    spam: "Check your spam folder: our emails sometimes end up there.",
    cta: "Book your 15-minute call",
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
      cta={{
        label: t.cta,
        href: lienDuSite("apporteur", { locale, depuis: DEPUIS_CONFIRMATION_DOSSIER }),
      }}
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
