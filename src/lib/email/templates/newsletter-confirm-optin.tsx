// Email — double opt-in newsletter (RFC 8058 — Sprint 15 / M8 step 4).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";
import { GUIDE_IA_PAGES } from "@/content/guide-ia";

interface Payload {
  confirmToken: string;
  unsubscribeToken: string;
}

const COPY = {
  fr: {
    title: "Confirmez votre inscription",
    preview: "Un clic et c'est terminé — sans confirmation, votre adresse n'est pas ajoutée.",
    body: "Merci de vous être inscrit(e) à la newsletter Axion-IA. Pour finaliser votre inscription, cliquez sur le bouton ci-dessous.",
    guide: `En confirmant, vous accédez aussi à notre guide IA entreprise (${GUIDE_IA_PAGES} pages, PDF) : le bouton de téléchargement vous attend sur la page qui s'ouvre.`,
    note: "Si vous n'avez pas demandé cette inscription, ignorez simplement cet email — votre adresse ne sera pas ajoutée.",
    cta: "Confirmer mon inscription",
  },
  en: {
    title: "Confirm your subscription",
    preview: "One click and you are done — without it, your address is not added.",
    body: "Thank you for subscribing to the Axion-IA newsletter. To finalize your subscription, click the button below.",
    guide: `Once confirmed, you also get our enterprise AI guide (${GUIDE_IA_PAGES} pages, PDF, in French): the download button is on the page that opens.`,
    note: "If you didn't request this subscription, just ignore this email — your address won't be added.",
    cta: "Confirm my subscription",
  },
} as const;

export const newsletterConfirmOptinSubject = (
  locale: Locale,
  _p: Record<string, unknown>,
): string => (locale === "fr" ? "Confirmez votre inscription" : "Confirm your subscription");

export function NewsletterConfirmOptinEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY[locale];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const confirmHref = `${baseUrl}/${locale}/confirmation/newsletter?token=${p.confirmToken}`;
  const unsubHref = `${baseUrl}/${locale}/desabonnement?token=${p.unsubscribeToken}`;
  return (
    <EmailLayout
      famille="A"
      preview={t.preview}
      title={t.title}
      cta={{ label: t.cta, href: confirmHref }}
      unsubscribeHref={unsubHref}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>{t.body}</Text>
      {/* 🔑 Le guide promis par /guide-ia se télécharge sur la page de
          confirmation — pas ici. Famille A = budget de 2 liens, déjà pris par
          la confirmation et le désabonnement : un lien de plus ferait rougir
          `familles-email.spec.tsx`. Et c'est aussi la bonne forme : le guide
          arrive APRÈS la confirmation, comme la page du guide l'annonce. */}
      <Text style={emailStyles.paragraphStyle}>{t.guide}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.note}
      </Text>
    </EmailLayout>
  );
}
