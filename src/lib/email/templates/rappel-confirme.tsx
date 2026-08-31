// Email — confirmation d'une demande de rappel téléphonique.
//
// ── Pourquoi ce gabarit existe ────────────────────────────────────────────
// Le second temps du simulateur — « laissez votre numéro, on vous rappelle » —
// produit le lead le plus chaud de tout le tunnel : la personne a déjà reçu
// son rapport et laisse son numéro SANS y être contrainte. Elle ne recevait
// pourtant aucune confirmation. Silence complet après le geste le plus
// engageant du parcours.
//
// 🔴 Court à dessein. La personne vient de recevoir son rapport quelques
// minutes plus tôt : un second e-mail long serait perçu comme du remplissage.
// Il confirme un fait, rappelle le numéro saisi (pour qu'une faute de frappe
// se voie), et s'arrête.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom: string;
  /** Numéro tel que saisi : une coquille doit sauter aux yeux. */
  telephone: string;
}

const COPY = {
  fr: {
    title: "On vous rappelle",
    preview: "Sous deux jours ouvrés. Vérifiez le numéro : il est rappelé dans le message.",
    intro: (n: string) => `Bonjour ${n},`,
    body: (tel: string) =>
      `C'est noté : nous vous rappelons au ${tel}. Si ce numéro comporte une erreur, répondez à ce message et nous le corrigerons.`,
    quand:
      "Nous appelons en général sous deux jours ouvrés, aux heures de bureau. Si le moment n'est pas le bon, dites-le-nous et nous conviendrons d'un créneau.",
    rien: "Vous n'avez rien d'autre à faire.",
  },
  en: {
    title: "We'll call you back",
    preview: "Within two working days. Check the number — it is repeated inside.",
    intro: (n: string) => `Hello ${n},`,
    body: (tel: string) =>
      `Noted: we will call you on ${tel}. If this number is wrong, reply to this message and we will correct it.`,
    quand:
      "We usually call within two working days, during office hours. If that does not suit you, let us know and we will agree on a time.",
    rien: "There is nothing else for you to do.",
  },
} as const;

export const rappelConfirmeSubject = (locale: Locale, _p: Record<string, unknown>): string =>
  locale === "fr" ? "On vous rappelle" : "We'll call you back";

export function RappelConfirmeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  return (
    <EmailLayout famille="B" preview={t.preview} title={t.title} locale={locale}>
      <Text style={emailStyles.paragraphStyle}>{t.body(p.telephone)}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.intro(p.prenom)}
        <br />
        {t.quand}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.rien}
      </Text>
    </EmailLayout>
  );
}
