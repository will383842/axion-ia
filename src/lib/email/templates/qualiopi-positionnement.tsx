// Email — questionnaire de POSITIONNEMENT, envoyé AVANT la formation (ind. 8).
//
// ── Pourquoi ce template existe (2026-08-15) ────────────────────────────────
//
// 🔴 Constaté sur le premier dossier réel, la veille de la formation. L'action
// « Envoyer au stagiaire » retombait, pour le type `positionnement`, sur
// `demanderAccesParEmail()` — c'est-à-dire sur `qualiopi-portail-acces`, le
// template de RE-DEMANDE self-service d'un lien perdu. La stagiaire recevait :
//
//   « Vous avez demandé un nouveau lien d'accès à votre espace stagiaire […]
//     Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer
//     cet email. »
//
// Trois défauts, dont le dernier est fatal :
//   1. Il affirme une demande qu'elle n'a jamais faite.
//   2. Il ne nomme ni la formation, ni le questionnaire, ni le délai.
//   3. Il l'invite EXPLICITEMENT à ignorer le message — et elle avait toutes
//      les raisons de le faire, puisqu'elle n'avait effectivement rien demandé.
//
// L'indicateur 8 reposait donc sur un email qui demandait qu'on l'ignore.
//
// ⚠️ Ce template dit ce qu'on attend, pour quelle formation, et avant quand.
// Le « avant le début de la formation » n'est pas décoratif : un positionnement
// recueilli APRÈS coup ne positionne plus rien, et le garde-fou de chronologie
// (`evaluations-service.jourUtc`) le refuse au jour civil près.
//
// ⚠️ Aucune mention de financement public dans cet email (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  /** Date de début, déjà formatée en toutes lettres (ex. « 16 août 2026 »). */
  dateDebutFormation: string;
  lienQuestionnaire: string;
  numeroSession: string;
}

export const qualiopiPositionnementSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return `Avant votre formation ${p.titreFormation ?? ""} — 5 minutes à nous accorder — Axion-IA`;
  }
  return `Before your training ${p.titreFormation ?? ""} — 5 minutes needed — Axion-IA`;
};

export function QualiopiPositionnementEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienQuestionnaire ?? `${baseUrl}/fr/portail/mon-espace`;
  return (
    <EmailLayout
      preview="Cinq minutes avant votre formation, pour l'ajuster à vos besoins."
      title="Votre questionnaire de positionnement"
      cta={{ label: "Remplir mon questionnaire", href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour {p.stagiairePrenomNom},</Text>
      {/* 🔴 Formulation NEUTRE en genre, et ce n'est pas un détail de style : ce
          gabarit part à TOUS les stagiaires, pas à celui pour qui il a été
          écrit. « Vous êtes inscrite » — première rédaction, calquée sur la
          première stagiaire réelle — se trompe une fois sur deux dès le
          deuxième dossier. Aucun accord de participe passé au vous dans ce
          fichier : le contexte ne porte pas le genre du destinataire. */}
      <Text style={emailStyles.paragraphStyle}>
        Votre inscription à la formation <strong>{p.titreFormation}</strong> est enregistrée. Elle
        débute le <strong>{p.dateDebutFormation}</strong>.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Avant de commencer, nous avons besoin de connaître votre niveau de départ et vos attentes :
        c&apos;est ce que recueille le <strong>questionnaire de positionnement</strong>. Il prend
        environ cinq minutes, et il se remplit en ligne — rien à imprimer, rien à renvoyer.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Merci de le remplir <strong>avant le début de la formation</strong>. Vos réponses servent
        directement à ajuster le contenu de la journée : sans elles, nous animons à l&apos;aveugle.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Si vous n&apos;avez pas eu le temps, ce n&apos;est pas bloquant : nous le remplirons
        ensemble à l&apos;ouverture de la session. Session {p.numeroSession}.
      </Text>
    </EmailLayout>
  );
}
