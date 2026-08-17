// Email — INFORMATION du candidat sur la conservation de sa candidature en
// vivier, avec lien d'opposition (lot L4, plan §2.3, décision actée option (b)).
//
// ── Ce que cet email est, juridiquement ─────────────────────────────────────
// Ce n'est PAS une demande de consentement : c'est l'INFORMATION LOYALE qui,
// assortie d'un droit d'opposition simple et d'un délai de 30 jours, rend
// licite la conservation en vivier de candidatures reçues sous un texte
// antérieur (doctrine CNIL « CVthèque »). C'est la pièce qui tient tout le
// dispositif : sans elle, l'intégration au vivier serait un détournement de
// finalité.
//
// 🔴 LE TEXTE CI-DESSOUS EST VALIDÉ (plan §2.3) ET REPRIS MOT POUR MOT.
// Ne pas le reformuler, ne pas l'« améliorer », ne pas y ajouter d'accroche
// commerciale. Chaque élément y est exigible : la finalité, la durée (2 ans),
// le lien d'opposition, son effet (immédiat, sans justification), la
// conséquence du silence (30 jours), le droit de suppression ultérieur,
// l'adresse de contact et le renvoi à la politique de confidentialité.
//
// ── Pourquoi il n'y a pas de version anglaise ───────────────────────────────
// Le texte a été validé en français et lui seul. En produire une traduction
// serait fabriquer un SECOND texte juridique non validé, sur lequel reposerait
// la licéité d'un traitement — exactement ce qu'il ne faut pas faire. Le
// gabarit sert donc le texte français quelle que soit la locale demandée.
// (Le site est par ailleurs francophone : la locale EN est redirigée en 301.)

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom?: string;
  /** Intitulé de l'offre, tel qu'affiché au moment de la candidature. */
  offre?: string;
  dateCandidature?: string;
  /** Lien d'opposition signé (un clic, sans login). */
  oppositionUrl?: string;
  joursOpposition?: number;
}

const TITRE = "Votre candidature chez Axion-IA — conservation dans notre vivier";

export const vivierInformationSubject = (_locale: Locale, _p: Record<string, unknown>): string =>
  TITRE;

export function VivierInformationEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const jours = typeof p.joursOpposition === "number" ? p.joursOpposition : 30;

  const candidature = [p.offre, p.dateCandidature].filter(Boolean).join(", ");
  const rappel = candidature
    ? `vous avez candidaté chez Axion-IA (${candidature}).`
    : "vous avez candidaté chez Axion-IA.";

  return (
    <EmailLayout
      preview={TITRE}
      title={TITRE}
      locale={locale}
      {...(p.oppositionUrl
        ? { cta: { label: "Je ne souhaite pas être conservé(e)", href: p.oppositionUrl } }
        : {})}
    >
      <Text style={emailStyles.paragraphStyle}>
        {p.prenom ? `Bonjour ${p.prenom},` : "Bonjour,"} {rappel}
      </Text>

      <Text style={emailStyles.paragraphStyle}>
        Nous souhaitons conserver votre candidature dans notre vivier pendant 2 ans afin de pouvoir
        vous recontacter pour d’autres opportunités correspondant à votre profil.
      </Text>

      <Text style={emailStyles.paragraphStyle}>
        Si vous ne le souhaitez pas, cliquez sur le bouton ci-dessus (effet immédiat, sans
        justification).
      </Text>

      <Text style={emailStyles.paragraphStyle}>
        Sans réponse de votre part sous {jours} jours, votre candidature sera conservée ; vous
        pourrez demander sa suppression à tout moment (contact@axion-ia.com).
      </Text>

      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Détails : politique de confidentialité — https://axion-ia.com/fr/politique-confidentialite
      </Text>
    </EmailLayout>
  );
}
