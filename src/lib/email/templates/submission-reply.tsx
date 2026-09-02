// Email — réponse admin à une Submission (Sprint Notif Infra 2026-05-26).
//
// Branded Axion-IA. Template appelé par l'email-worker via le job
// `"submission-reply"`. Le body est un markdown léger fourni par Will dans
// l'admin, rendu en HTML (paragraphes + bold + italic + liens simples).

import { Hr, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
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

/**
 * Rendu markdown léger → React tree (sans dépendance externe).
 * Supporte :
 *   - paragraphes séparés par double newline
 *   - **bold** + *italic*
 *   - [label](url)
 *
 * Volontairement minimal pour éviter d'ajouter `react-markdown` (poids
 * bundle inutile pour ce besoin — Will écrit du texte simple).
 */
function renderMarkdownParagraph(text: string): React.ReactNode {
  // 1. Liens [label](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  // 2. Bold **x**
  const boldRegex = /\*\*([^*]+)\*\*/g;
  // 3. Italic *x*
  const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g;

  type Part = { type: "text" | "bold" | "italic" | "link"; value: string; href?: string };
  const parts: Part[] = [{ type: "text", value: text }];

  // Lien
  const next1: Part[] = [];
  for (const p of parts) {
    if (p.type !== "text") {
      next1.push(p);
      continue;
    }
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    linkRegex.lastIndex = 0;
    while ((m = linkRegex.exec(p.value)) !== null) {
      if (m.index > lastIdx) {
        next1.push({ type: "text", value: p.value.slice(lastIdx, m.index) });
      }
      next1.push({ type: "link", value: m[1] ?? "", href: m[2] ?? "" });
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < p.value.length) {
      next1.push({ type: "text", value: p.value.slice(lastIdx) });
    }
  }

  // Bold
  const next2: Part[] = [];
  for (const p of next1) {
    if (p.type !== "text") {
      next2.push(p);
      continue;
    }
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    boldRegex.lastIndex = 0;
    while ((m = boldRegex.exec(p.value)) !== null) {
      if (m.index > lastIdx) {
        next2.push({ type: "text", value: p.value.slice(lastIdx, m.index) });
      }
      next2.push({ type: "bold", value: m[1] ?? "" });
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < p.value.length) {
      next2.push({ type: "text", value: p.value.slice(lastIdx) });
    }
  }

  // Italic
  const next3: Part[] = [];
  for (const p of next2) {
    if (p.type !== "text") {
      next3.push(p);
      continue;
    }
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    italicRegex.lastIndex = 0;
    while ((m = italicRegex.exec(p.value)) !== null) {
      if (m.index > lastIdx) {
        next3.push({ type: "text", value: p.value.slice(lastIdx, m.index) });
      }
      next3.push({ type: "italic", value: m[1] ?? "" });
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < p.value.length) {
      next3.push({ type: "text", value: p.value.slice(lastIdx) });
    }
  }

  return next3.map((p, i) => {
    if (p.type === "bold") return <strong key={i}>{p.value}</strong>;
    if (p.type === "italic") return <em key={i}>{p.value}</em>;
    if (p.type === "link" && p.href) {
      return (
        <a
          key={i}
          href={p.href}
          style={{ color: emailStyles.COLORS.accent, textDecoration: "underline" }}
        >
          {p.value}
        </a>
      );
    }
    return <span key={i}>{p.value}</span>;
  });
}

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
  const paragraphs = p.bodyMarkdown.split(/\n\s*\n/).filter((para) => para.trim().length > 0);
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
  const preEnTete =
    (paragraphs[0] ?? "")
      .replace(/[*_`#>[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 110) || (isEn ? "A reply from Williams." : "Une réponse de Williams.");

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
          {renderMarkdownParagraph(para)}
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
