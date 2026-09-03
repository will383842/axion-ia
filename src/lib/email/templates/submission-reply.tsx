// Email — réponse admin à une Submission (Sprint Notif Infra 2026-05-26).
//
// Branded Axion-IA. Template appelé par l'email-worker via le job
// `"submission-reply"`. Le body est un markdown léger fourni par Will dans
// l'admin, rendu en HTML (paragraphes + bold + italic + liens simples).

import { Hr, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
// 🔑 Le rendu du markdown léger vivait ICI, et une SECONDE copie vivait dans
// `ReplyComposer.tsx` — deux implémentations d'une même grammaire, dont l'une
// rend ce qui part et l'autre ce qu'on voit avant d'envoyer. Le lot 1 du
// chantier recrutement en réclamait une troisième ; c'était le bon moment pour
// n'en garder qu'une.
import { paragraphes, preEnTeteDepuisCorps, rendreParagraphe } from "./_markdown-leger";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Sujet pré-rendu (h1 du mail). */
  subject: string;
  /** Body en markdown léger (paragraphes + ** + * + [link](url)). */
  bodyMarkdown: string;
  /** Signature optionnelle (défaut "Williams Jullin"). */
  signature?: string;
  /** Excerpt optionnel du message original du user (style "quote" mail). */
  originalSubmissionExcerpt?: string;
}

export const submissionReplySubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  return p.subject || "Réponse";
};

export function SubmissionReplyEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  // Signature : « Williams » (JAMAIS « Williams Jullin » — règle de marque).
  const signature = p.signature ?? "Williams\nAxion-IA · cabinet IA opérationnel";
  const [sigName, ...sigRest] = signature.split("\n");
  const paragraphs = paragraphes(p.bodyMarkdown);
  const isEn = locale === "en";
  // Pré-en-tête (§3.5) : l'objet de ce message est SAISI par l'admin, et le
  // pré-en-tête le recopiait à l'identique — Gmail affichait donc deux fois la
  // même phrase, et le 2ᵉ élément d'accroche était perdu.
  //
  // On le dérive du DÉBUT DU MESSAGE : c'est la seule source disponible ici, et
  // c'est exactement ce que le référentiel demande — prolonger l'objet, pas le
  // répéter. La marque Markdown est retirée, sinon le pré-en-tête afficherait
  // des astérisques ; et un repli couvre le corps vide, car un pré-en-tête vide
  // laisse Gmail afficher le début du HTML à la place.
  const preEnTete = preEnTeteDepuisCorps(
    p.bodyMarkdown,
    isEn ? "A reply from Williams." : "Une réponse de Williams.",
  );

  return (
    <EmailLayout
      famille="B"
      preview={preEnTete}
      title={p.subject}
      locale={locale}
      eyebrow={isEn ? "A note from Williams" : "Un mot de Williams"}
      cta={{
        label: isEn ? "Book a call" : "Réserver un appel",
        href: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com"}/fr/appel`,
      }}
      trust
    >
      {paragraphs.map((para, i) => (
        <Text key={i} style={emailStyles.paragraphStyle}>
          {rendreParagraphe(para)}
        </Text>
      ))}

      {p.originalSubmissionExcerpt && (
        <Text
          style={{
            fontSize: "14px",
            lineHeight: 1.6,
            color: emailStyles.COLORS.textMuted,
            fontStyle: "italic",
            borderLeft: `3px solid ${emailStyles.COLORS.terracotta}`,
            paddingLeft: "14px",
            margin: "24px 0 0 0",
          }}
        >
          {isEn ? "Your original message:" : "Votre message initial :"}
          <br />
          {p.originalSubmissionExcerpt}
        </Text>
      )}

      <Hr style={{ borderColor: emailStyles.COLORS.border, margin: "28px 0 16px 0" }} />
      {/* Lot 4 : la signature reprend la typographie du bloc signature du
          châssis (14 px, interligne 1,7) — deux implémentations divergeaient. */}
      <Text
        style={{
          ...emailStyles.signatureStyle,
          margin: 0,
          fontWeight: 600,
          fontFamily: emailStyles.SERIF,
        }}
      >
        {sigName}
      </Text>
      {sigRest.length > 0 && (
        <Text
          style={{
            ...emailStyles.signatureStyle,
            margin: "2px 0 0 0",
            color: emailStyles.COLORS.textMuted,
          }}
        >
          {sigRest.join(" · ")}
        </Text>
      )}
    </EmailLayout>
  );
}
