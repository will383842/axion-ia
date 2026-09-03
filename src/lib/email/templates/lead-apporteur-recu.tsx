// E-mail — accusé du PREMIER CONTACT d'un apporteur d'affaires (formulaire
// court de la landing Facebook, 2026-09-03).
//
// Ton : chaleureux, TUTOIEMENT (le tunnel tutoie de bout en bout).
//
// Il fait trois choses, dans cet ordre :
//   1. dire que c'est noté et qu'on appelle — SANS délai chiffré (règle Will
//      2026-08-23 : un délai annoncé et non tenu détruit la confiance) ;
//   2. proposer de CHOISIR le moment de l'appel (lien Calendly apporteur, si
//      configuré) — un candidat qui réserve lui-même se convertit mieux ;
//   3. proposer de compléter le dossier (3 minutes, sans CV) : c'est le CTA
//      principal, celui qui prépare l'appel.
//
// Vocabulaire : « apporteur d'affaires », jamais « commercial », « poste »,
// « recrutement » — décision Will 2026-09-03, et première pièce du faisceau
// anti-requalification (`docs/partners/ANTI-REQUALIFICATION.md`).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Prénom (le tutoiement appelle le prénom seul). */
  contactName?: string;
  submissionId?: string;
  /** Lien du dossier complet — le wizard, pré-rempli par le brouillon local. */
  dossierUrl: string;
  /** Lien Calendly « appel apporteur », si configuré. */
  creneauUrl?: string;
}

const COPY = {
  fr: {
    title: "C'est noté, on t'appelle",
    preview:
      "Deux choses à faire en attendant l'appel, si tu veux : choisir le moment, et compléter ton dossier.",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: "Tu viens de nous laisser tes coordonnées pour rejoindre le réseau d'apporteurs d'affaires d'Axion-IA. On t'appelle pour faire connaissance, t'expliquer comment ça marche et répondre à tes questions. Aucun engagement : tu décides après.",
    creneau: "Tu préfères choisir toi-même le moment de l'appel ? Réserve ton créneau ici : ",
    dossier:
      "Et pour qu'on prépare cet échange à partir de ta situation, complète ton dossier — trois minutes, sans CV, sans lettre de motivation. Tes coordonnées sont déjà remplies.",
    spam: "Pense à vérifier tes spams si tu n'as pas de nouvelles : nos e-mails s'y égarent parfois.",
    cta: "Compléter mon dossier",
    refRow: (id: string) => `Référence : ${id}`,
  },
  en: {
    title: "Noted, we'll call you",
    preview:
      "Two optional things while you wait for our call: pick the time, and complete your file.",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: "You just left us your details to join Axion-IA's network of business introducers. We'll call you to get acquainted, explain how it works and answer your questions. No commitment: you decide afterwards.",
    creneau: "Prefer to pick the time of the call yourself? Book your slot here: ",
    dossier:
      "And so we can prepare that call around your situation, complete your file — three minutes, no resume, no cover letter. Your details are already filled in.",
    spam: "Check your spam folder if you do not hear from us: our emails sometimes end up there.",
    cta: "Complete my file",
    refRow: (id: string) => `Reference: ${id}`,
  },
} as const;

export const leadApporteurRecuSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "C'est noté, on t'appelle" : "Noted, we'll call you";

export function LeadApporteurRecuEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const prenom = (p.contactName ?? "").trim().split(/\s+/)[0] ?? "";
  const creneau = typeof p.creneauUrl === "string" && p.creneauUrl.length > 0 ? p.creneauUrl : null;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      cta={{ label: t.cta, href: p.dossierUrl }}
      locale={locale}
      tutoiement
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
      {creneau ? (
        <Text style={emailStyles.paragraphStyle}>
          {t.creneau}
          <a href={creneau} style={{ color: emailStyles.COLORS.terracotta }}>
            {creneau}
          </a>
        </Text>
      ) : null}
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
