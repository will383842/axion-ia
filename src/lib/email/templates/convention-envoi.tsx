// Email — envoi MANUEL du lien de signature d'une convention par l'admin.
//
// Déclenché exclusivement par un clic admin depuis la fiche session (bouton
// « Envoyer au client » du panneau de signature) — JAMAIS par un cron : un lien
// de signature vaut signature, sa mise en circulation reste une décision humaine.
//
// 🔴 Pourquoi ce gabarit existe (2026-08-01). Le devis avait son e-mail
// (`devis-envoi`, avec `signatureUrl` en CTA) et la facture le sien — la
// CONVENTION, non. L'admin devait donc copier l'URL brute du lien de signature
// et la coller à la main dans sa messagerie, à chaque convention. Outre le geste
// répété, le client recevait une URL de 400 caractères en texte nu : illisible,
// et impossible à distinguer d'un lien d'hameçonnage. Ici le lien est porté par
// un bouton « Signer la convention », l'URL n'est jamais montrée.
//
// Le PDF de la convention n'est PAS joint : le lien affiche la pièce à signer,
// et l'exemplaire signé sera remis après signature. Envoyer les deux inviterait
// à signer un PDF hors circuit.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Nom du signataire, tel que figé dans le jeton. Ex. « Simone Blanc ». */
  signataireNom: string;
  /** Raison sociale du client. Ex. « INVEST SUN ». */
  clientNom: string;
  /** N° de la pièce. Ex. « AXI-DOC-2026-009 ». */
  numero: string;
  /** Intitulé de l'action de formation. */
  titreFormation: string;
  /** Lien de signature — porté par le bouton, jamais affiché en clair. */
  signatureUrl: string;
  /** Message libre de l'admin (multi-lignes, affiché tel quel). Optionnel. */
  messagePersonnalise?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Votre convention de formation à signer",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: (titre: string, client: string) =>
      `La convention de formation professionnelle relative à « ${titre} »${client ? `, établie avec ${client},` : ""} est prête à être signée.`,
    lecture:
      "Le lien ci-dessous ouvre la convention : vous pouvez la lire intégralement avant de signer, puis apposer votre signature en ligne.",
    preview:
      "Lecture intégrale possible avant signature. Le lien vous est personnel et vaut signature.",
    cta: "Signer la convention",
    perso: "Ce lien vous est personnel et vaut signature : merci de ne pas le transférer.",
    ref: (n: string) => `Référence du document : ${n}`,
    questions:
      "Pour toute question sur le contenu ou les modalités, répondez simplement à cet email : nous sommes à votre écoute.",
    close: "Bien cordialement,\nL'équipe Axion-IA",
  },
  en: {
    title: "Your training agreement to sign",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: (titre: string, client: string) =>
      `The professional training agreement for "${titre}"${client ? `, drawn up with ${client},` : ""} is ready to be signed.`,
    lecture:
      "The link below opens the agreement: you can read it in full before signing, then sign online.",
    preview:
      "You can read it in full before signing. The link is personal and constitutes a signature.",
    cta: "Sign the agreement",
    perso: "This link is personal to you and constitutes a signature: please do not forward it.",
    ref: (n: string) => `Document reference: ${n}`,
    questions:
      "For any question about the content or terms, simply reply to this email: we are here for you.",
    close: "Best regards,\nThe Axion-IA team",
  },
} as const;

export const conventionEnvoiSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Partial<Payload>;
  const titre = field(p, "titreFormation", "");
  if (locale === "fr") {
    // Préfixe volontairement COURT : « Convention de formation à signer »
    // consommait 35 des 45 caractères et ne laissait que « IA… » de
    // l'intitulé — objet dans la borne, et incapable de distinguer deux
    // formations. Le mot « formation » est de toute façon dans l'intitulé.
    return objetCompose("Convention à signer —", titre);
  }
  return objetCompose("Agreement to sign —", titre);
};

export function ConventionEnvoiEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];
  const message = field(p, "messagePersonnalise", "");
  const signatureUrl = field(p, "signatureUrl", "");

  return (
    <EmailLayout
      famille="A"
      locale={locale}
      title={t.title}
      /* Le pré-en-tête reprenait l'objet. Il dit désormais ce que l'objet ne dit
         pas : on peut TOUT LIRE avant de signer, et le lien est nominatif. */
      preview={t.preview}
      // Sans lien, pas de bouton — mais l'e-mail reste lisible et n'affiche
      // jamais d'URL nue. Le cas ne devrait pas se produire : l'action refuse
      // d'enfiler l'e-mail sans lien.
      {...(signatureUrl !== "" ? { cta: { label: t.cta, href: signatureUrl } } : {})}
      /* Le lien VAUT SIGNATURE : il est porte par le bouton, jamais imprime
         en clair dans le corps. Voir `convention-envoi.spec.tsx`. */
      ctaSecret
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(field(p, "signataireNom", ""))}</Text>
      {message !== "" &&
        message.split("\n").map((line, i) => (
          <Text key={i} style={emailStyles.paragraphStyle}>
            {line}
          </Text>
        ))}
      <Text style={emailStyles.paragraphStyle}>
        {t.body(field(p, "titreFormation", ""), field(p, "clientNom", ""))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.lecture}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.perso}
      </Text>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.ref(field(p, "numero", ""))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{t.questions}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.close.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
    </EmailLayout>
  );
}
