// Ligne discrète « Supprimer ma candidature » — pied des e-mails envoyés à un
// candidat d'offre d'emploi (décision de Will, 2026-10-11).
//
// Le lien mène à une page qui montre le poste et demande une confirmation :
// il n'efface rien à l'ouverture (cf. `effacement-par-le-candidat.ts`).
//
// ⛔ Réservé aux candidats d'offres d'emploi. Les e-mails des apporteurs
// d'affaires ne le portent pas : leur dossier n'est pas une `JobApplication`.

import { Link, Text } from "@react-email/components";

import { emailStyles } from "./_layout";

const TEXTE = {
  fr: {
    avant: "Vous ne souhaitez plus que nous conservions votre dossier ?",
    lien: "Supprimer ma candidature",
  },
  en: {
    avant: "No longer want us to keep your file?",
    lien: "Delete my application",
  },
} as const;

export function LienSuppressionCandidature({
  href,
  locale,
}: {
  href: string | undefined;
  locale: "fr" | "en";
}) {
  if (!href) return null;
  const t = TEXTE[locale];
  return (
    <Text
      style={{
        ...emailStyles.paragraphStyle,
        fontSize: "14px",
        margin: "24px 0 0 0",
        color: emailStyles.COLORS.textMuted,
      }}
    >
      {t.avant}{" "}
      <Link
        href={href}
        data-lien="supprimer-candidature"
        style={{ color: emailStyles.COLORS.accent, textDecoration: "underline" }}
      >
        {t.lien}
      </Link>
    </Text>
  );
}
