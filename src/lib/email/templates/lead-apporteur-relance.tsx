// E-mail — rappel « ton dossier t'attend », J+2 puis J+7 après un premier
// contact Facebook sans dossier complet (2026-09-03).
//
// Deux rappels, pas plus, et le second le dit. Ils sont RETIRÉS de la file
// dès que le dossier arrive (`relances-lead-apporteur.ts`). La personne n'est
// pas apporteuse : c'est une démarche qu'elle a engagée, pas une activité
// qu'on mesure.
//
// Famille B : pied de page complet, lien d'opposition obligatoire (lot 1b).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName?: string;
  submissionId?: string;
  dossierUrl: string;
  creneauUrl?: string;
  /** `j2` (premier rappel) ou `j7` (dernier). Autre valeur = premier. */
  etape?: string;
}

const COPY = {
  fr: {
    title: (dernier: boolean) => (dernier ? "Dernier rappel, promis" : "Ton dossier t'attend"),
    preview: "Trois minutes, sans CV — et on prépare notre échange à partir de tes réponses.",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    j2: "Il y a deux jours, tu nous as laissé tes coordonnées pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA. Ton dossier, lui, n'est pas encore arrivé — et c'est lui qui nous permet de préparer l'appel autour de ta situation plutôt que de partir de zéro.",
    j7: "Une semaine déjà depuis ton premier message. On ne relance pas dix fois : c'est le dernier rappel. Si le moment n'est pas le bon, aucun souci — ton premier contact reste enregistré et tu pourras reprendre quand tu veux.",
    dossier:
      "Le dossier prend trois minutes, sans CV et sans lettre de motivation. Tes coordonnées sont déjà remplies.",
    creneau: "Et si tu préfères d'abord qu'on se parle, choisis ton créneau : ",
    cta: "Compléter mon dossier",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: (dernier: boolean) => (dernier ? "Last reminder, promise" : "Your file is waiting"),
    preview: "Three minutes, no resume — and we prepare our call from your answers.",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    j2: "Two days ago you left us your details to join Axion-IA's network of business introducers. Your file has not arrived yet — and it is what lets us prepare the call around your situation instead of starting from scratch.",
    j7: "A week since your first message already. We do not chase ten times: this is the last reminder. If now is not the right time, no problem — your first contact stays on record and you can pick it up whenever you like.",
    dossier:
      "The file takes three minutes, no resume, no cover letter. Your details are already filled in.",
    creneau: "And if you would rather talk first, pick your slot: ",
    cta: "Complete my file",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const leadApporteurRelanceSubject = (locale: Locale, p: Record<string, unknown>): string => {
  const dernier = p.etape === "j7";
  return COPY[locale === "fr" ? "fr" : "en"].title(dernier);
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
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  const creneau = typeof p.creneauUrl === "string" && p.creneauUrl.length > 0 ? p.creneauUrl : null;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title(dernier)}
      cta={{ label: t.cta, href: p.dossierUrl }}
      locale={locale}
      tutoiement
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{dernier ? t.j7 : t.j2}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.dossier}</Text>
      {creneau ? (
        <Text style={emailStyles.paragraphStyle}>
          {t.creneau}
          <a href={creneau} style={{ color: emailStyles.COLORS.terracotta }}>
            {creneau}
          </a>
        </Text>
      ) : null}
      {p.submissionId ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.refRow(String(p.submissionId))}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
