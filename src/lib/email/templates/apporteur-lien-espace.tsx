// E-mail à l'APPORTEUR qui a demandé à RETROUVER SON ESPACE (décision de Will, 2026-10-09) :
// page `/apporteur/dossier/retrouver`, il tape son adresse, il reçoit son lien personnel.
//
// 2026-11-25 — il part aussi depuis la console (fiche d'un apporteur au dossier signé), sur
// décision d'un administrateur. La charge porte alors `origine: "console"` (champ FACULTATIF) :
// l'e-mail ne dit ni « comme vous l'avez demandé » ni « si vous n'êtes pas à l'origine de cette
// demande », qui seraient faux. Sans ce champ, le texte d'origine est rendu au mot près.
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
  /** `"console"` : envoyé par un administrateur, sans demande de l'apporteur. */
  origine?: string;
}

export const COPY_LIEN_ESPACE = {
  subject: "Le lien de votre espace d'apporteur",
  preview: "Votre lien personnel, à garder dans vos favoris.",
  title: "Votre espace d'apporteur",
  bonjour: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
  texte: "Voici le lien de votre espace d'apporteur Axion-IA, comme vous l'avez demandé.",
  texteConsole: "Voici le lien de votre espace d'apporteur Axion-IA.",
  favoris:
    "Ajoutez la page à vos favoris, ou à l'écran d'accueil de votre téléphone, pour la retrouver en un geste.",
  prudence:
    "Ce lien vous est personnel : ne transférez pas cet e-mail. Si vous n'êtes pas à l'origine de cette demande, ignorez-le simplement.",
  prudenceConsole: "Ce lien vous est personnel : ne transférez pas cet e-mail.",
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
  const depuisConsole = p.origine === "console";
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
      <Text style={emailStyles.paragraphStyle}>
        {depuisConsole ? COPY_LIEN_ESPACE.texteConsole : COPY_LIEN_ESPACE.texte}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{COPY_LIEN_ESPACE.favoris}</Text>
      <Text
        style={{
          ...emailStyles.paragraphStyle,
          fontSize: "13px",
          color: emailStyles.COLORS.textMuted,
        }}
      >
        {depuisConsole ? COPY_LIEN_ESPACE.prudenceConsole : COPY_LIEN_ESPACE.prudence}
      </Text>
    </EmailLayout>
  );
}
