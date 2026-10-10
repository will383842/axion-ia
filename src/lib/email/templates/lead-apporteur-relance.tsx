// E-mail — rappel « votre dossier vous attend », J+2 puis J+7 après un premier
// contact Facebook sans dossier complet (2026-09-03).
//
// Deux rappels, pas plus, et le second le dit. Ils sont RETIRÉS de la file
// dès que le dossier arrive (`relances-lead-apporteur.ts`). La personne n'est
// pas apporteuse : c'est une démarche qu'elle a engagée, pas une activité
// qu'on mesure.
//
// Variante `vsl` (2026-10-05) : relances A2 (J+2) et A3 (J+7) du tunnel avec
// vidéo. La personne a validé l'étape 1 (prénom + e-mail), pas la suivante :
// « il vous manque une étape ». Le bouton ramène à la page (lien de reprise).
//
// Famille B : pied de page complet, lien d'opposition obligatoire (lot 1b).
//
// 2026-09-19 — Le lien de réservation d'appel est RETIRÉ (il n'est plus envoyé
// qu'aux personnes que Will invite, depuis la console) ; le kit apporteur —
// document de présentation + catalogue — est ajouté.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { BlocKitApporteur } from "./_kit-apporteur";
import { VARIANTE_VSL_RELANCE } from "@/lib/commercial-application/vsl-apporteur";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName?: string;
  submissionId?: string;
  dossierUrl: string;
  /** `j2` (premier rappel) ou `j7` (dernier). Autre valeur = premier. */
  etape?: string;
  /** `vsl` : relance du tunnel avec vidéo (étape 2 manquante). */
  variante?: string;
}

const COPY = {
  fr: {
    title: (dernier: boolean) =>
      dernier ? "Votre candidature d'apporteur : dernier rappel" : "Votre candidature vous attend",
    preview: "Trois minutes, sans CV — et nous préparons notre échange à partir de vos réponses.",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    j2: "Il y a deux jours, vous nous avez laissé vos coordonnées pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA. Votre candidature, elle, n'est pas encore arrivée — et c'est elle qui nous permet de préparer notre échange autour de votre situation plutôt que de partir de zéro.",
    j7: "Une semaine déjà depuis votre premier message. Nous ne relançons pas dix fois : c'est le dernier rappel. Si le moment n'est pas le bon, aucun souci — votre premier contact reste enregistré et vous pourrez reprendre quand vous le souhaitez.",
    dossier:
      "La candidature prend trois minutes, sans CV et sans lettre de motivation. Vos coordonnées sont déjà remplies.",
    j2Vsl:
      "Il y a deux jours, vous avez commencé votre inscription au réseau d'apporteurs d'affaires d'Axion-IA. Il vous manque une étape : votre numéro de téléphone et une question. Vos informations sont déjà enregistrées, il suffit de reprendre là où vous vous êtes arrêté.",
    j7Vsl:
      "Une semaine déjà depuis le début de votre inscription. Nous ne relançons pas dix fois : c'est le dernier rappel. Si le moment n'est pas le bon, aucun souci — vos informations restent enregistrées et vous pourrez reprendre quand vous le souhaitez.",
    ctaVsl: "Terminer mon inscription",
    // 2026-10-07 (D9) : la relance du tunnel vidéo a son titre et son pré-en-tête.
    // « Trois minutes, sans CV… vos réponses » décrivait l'ancien formulaire.
    // 2026-10-10 — le dernier rappel dit aussi « inscription », et tient dans les
    // 45 caractères d'un objet (« Votre candidature d'apporteur : … » en faisait 46).
    titleVsl: (dernier: boolean) =>
      dernier ? "Votre inscription : dernier rappel" : "Votre inscription vous attend",
    previewVsl: "Il vous reste une étape : votre numéro de téléphone et une question.",
    cta: "Compléter ma candidature",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: (dernier: boolean) =>
      dernier ? "Your introducer application: last reminder" : "Your application is waiting",
    preview: "Three minutes, no resume — and we prepare our call from your answers.",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    j2: "Two days ago you left us your details to join Axion-IA's network of business introducers. Your file has not arrived yet — and it is what lets us prepare our conversation around your situation instead of starting from scratch.",
    j7: "A week since your first message already. We do not chase ten times: this is the last reminder. If now is not the right time, no problem — your first contact stays on record and you can pick it up whenever you like.",
    dossier:
      "The file takes three minutes, no resume, no cover letter. Your details are already filled in.",
    j2Vsl:
      "Two days ago you started your registration to Axion-IA's network of business introducers. One step is missing: your phone number and one question. Your details are already saved, just pick up where you left off.",
    j7Vsl:
      "A week since you started your registration. We do not chase ten times: this is the last reminder. If now is not the right time, no problem — your details stay on record and you can pick it up whenever you like.",
    ctaVsl: "Finish my registration",
    titleVsl: (dernier: boolean) =>
      dernier ? "Your registration: last reminder" : "Your registration is waiting",
    previewVsl: "One step left: your phone number and one question.",
    cta: "Complete my application",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const leadApporteurRelanceSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const dernier = p.etape === "j7";
  const t = COPY[locale === "fr" ? "fr" : "en"];
  // 2026-10-10 — la variante vidéo a son objet : « inscription », pas « candidature »
  // (le titre l'avait déjà depuis le 07/10, l'objet était resté sur l'ancien).
  return p.variante === VARIANTE_VSL_RELANCE ? t.titleVsl(dernier) : t.title(dernier);
};

export function LeadApporteurRelanceEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const dernier = p.etape === "j7";
  const vsl = p.variante === VARIANTE_VSL_RELANCE;
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  const corps = vsl ? (dernier ? t.j7Vsl : t.j2Vsl) : dernier ? t.j7 : t.j2;
  return (
    <EmailLayout
      famille="B"
      preview={vsl ? t.previewVsl : t.preview}
      title={vsl ? t.titleVsl(dernier) : t.title(dernier)}
      cta={{ label: vsl ? t.ctaVsl : t.cta, href: p.dossierUrl }}
      locale={locale}
      sansReseauxSociaux
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{corps}</Text>
      {vsl ? null : <Text style={emailStyles.paragraphStyle}>{t.dossier}</Text>}
      <BlocKitApporteur locale={locale} />
      {p.submissionId ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.refRow(String(p.submissionId))}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
