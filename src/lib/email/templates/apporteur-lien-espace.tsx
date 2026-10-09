// E-mail à l'APPORTEUR qui a demandé à RETROUVER SON ESPACE (décision de Will, 2026-10-09) :
// page `/apporteur/dossier/retrouver`, il tape son adresse, il reçoit son lien personnel.
//
// Famille A (envoyé à sa demande, comme un lien de connexion). Le lien porte son jeton : il
// passe par la prop `cta` du gabarit de base (bouton robuste), sans recopie en clair
// (`ctaSecret`). Fichier À PART de `apporteur-demarrage.tsx` (une autre session y travaille).

import { Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom?: string;
  /** Le lien personnel de l'espace (`urlDossier`). */
  lien?: string;
}

export const COPY_LIEN_ESPACE = {
  subject: "Le lien de votre espace d'apporteur",
  preview: "Votre lien personnel, à garder dans vos favoris.",
  title: "Votre espace d'apporteur",
  bonjour: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
  texte: "Voici le lien de votre espace d'apporteur Axion-IA, comme vous l'avez demandé.",
  favoris:
    "Ajoutez la page à vos favoris, ou à l'écran d'accueil de votre téléphone, pour la retrouver en un geste.",
  prudence:
    "Ce lien vous est personnel : ne transférez pas cet e-mail. Si vous n'êtes pas à l'origine de cette demande, ignorez-le simplement.",
  cta: "Ouvrir mon espace",
} as const;

export const apporteurLienEspaceSubject = (): string => COPY_LIEN_ESPACE.subject;

export function ApporteurLienEspaceEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Payload;
  const prenom = typeof p.prenom === "string" ? p.prenom.trim() : "";
  const lien = typeof p.lien === "string" && p.lien ? p.lien : null;
  return (
    <EmailLayout
      famille="A"
      preview={COPY_LIEN_ESPACE.preview}
      title={COPY_LIEN_ESPACE.title}
      locale={locale === "fr" ? "fr" : "en"}
      {...(lien ? { cta: { label: COPY_LIEN_ESPACE.cta, href: lien }, ctaSecret: true } : {})}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{COPY_LIEN_ESPACE.bonjour(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{COPY_LIEN_ESPACE.texte}</Text>
      <Text style={emailStyles.paragraphStyle}>{COPY_LIEN_ESPACE.favoris}</Text>
      <Text
        style={{
          ...emailStyles.paragraphStyle,
          fontSize: "13px",
          color: emailStyles.COLORS.textMuted,
        }}
      >
        {COPY_LIEN_ESPACE.prudence}
      </Text>
    </EmailLayout>
  );
}
