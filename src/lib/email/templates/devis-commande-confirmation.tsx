// Email — confirmation de commande au client (CGV art. 5.2 et 6.2).
//
// Déclenché UNIQUEMENT par l'action explicite de contresignature d'Axion-IA, jamais par un cron
// ni un webhook (`server/qualiopi/devis/confirmation-commande.ts`). Pièces jointes : le devis signé
// et les conditions générales de vente acceptées (PDF). Ton courtois, aucune promesse de résultat.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  clientNom: string;
  /** N° du devis. */
  numero: string;
  /** Formule retenue par le client (devis à formules). Optionnelle. */
  formuleRetenue?: string;
  /** Libellés des automatisations retenues (devis à formules). Optionnel. */
  automatisationsRetenues?: string[];
  /** Lignes récurrentes retenues : abonnement, maintenance + périodicité. Optionnel. */
  recurrent?: string[];
  /** Montants formatés : « 2 450,00 € ». */
  montantHtLabel: string;
  montantTvaLabel: string;
  montantTtcLabel: string;
  /**
   * Version des CGV réellement acceptées par le client, libellé lisible : « 4 octobre 2026 ».
   * Absente si elle n'est pas retrouvable : la ligne n'est alors pas affichée.
   */
  cgvVersionLabel?: string;
  /** Vrai si le PDF des CGV acceptées est joint. Absent/faux : seul le devis signé est joint. */
  cgvJointes?: boolean;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

const COPY = {
  fr: {
    title: "Confirmation de votre commande",
    intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    body: (num: string) =>
      `Axion-IA a contresigné votre devis ${num} : votre commande est confirmée et le contrat est formé.`,
    formule: (f: string) => `Formule retenue : ${f}.`,
    automatisations: (l: string) => `Automatisations retenues : ${l}.`,
    recurrentTitre: "Engagement récurrent retenu :",
    montants: (ht: string, tva: string, ttc: string) =>
      `Montants : ${ht} HT, TVA ${tva}, soit ${ttc} TTC.`,
    cgv: (v: string) => `Conditions générales de vente acceptées : version du ${v}.`,
    attachments:
      "Vous trouverez en pièces jointes le devis signé et les conditions générales de vente acceptées, au format PDF.",
    attachmentsSansCgv: "Vous trouverez en pièce jointe le devis signé, au format PDF.",
    questions: "Pour toute question, répondez simplement à cet email.",
    close: "Bien cordialement,\nWilliams",
    preview: (num: string) => `Commande confirmée — devis ${num}.`,
  },
  en: {
    title: "Your order confirmation",
    intro: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    body: (num: string) =>
      `Axion-IA has countersigned your quote ${num}: your order is confirmed and the contract is formed.`,
    formule: (f: string) => `Selected option: ${f}.`,
    automatisations: (l: string) => `Selected automations: ${l}.`,
    recurrentTitre: "Recurring commitment selected:",
    montants: (ht: string, tva: string, ttc: string) =>
      `Amounts: ${ht} excl. VAT, VAT ${tva}, i.e. ${ttc} incl. VAT.`,
    cgv: (v: string) => `General terms of sale accepted: version of ${v}.`,
    attachments:
      "Attached are the signed quote and the accepted general terms of sale, in PDF format.",
    attachmentsSansCgv: "Attached is the signed quote, in PDF format.",
    questions: "For any question, simply reply to this email.",
    close: "Best regards,\nWilliams",
    preview: (num: string) => `Order confirmed — quote ${num}.`,
  },
} as const;

export const devisCommandeConfirmationSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const num = field(payload as Partial<Payload>, "numero", "");
  return locale === "fr"
    ? objetCompose("Commande confirmée —", num)
    : objetCompose("Order confirmed —", num);
};

export function DevisCommandeConfirmationEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];
  const formule = field(p, "formuleRetenue", "");
  const cgvLabel = field(p, "cgvVersionLabel", "");
  const liste = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const automatisations = liste(p.automatisationsRetenues);
  const recurrent = liste(p.recurrent);
  return (
    <EmailLayout
      famille="B"
      locale={locale}
      title={t.title}
      preview={t.preview(field(p, "numero", ""))}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro(field(p, "clientNom", ""))}</Text>
      <Text style={emailStyles.paragraphStyle}>{t.body(field(p, "numero", ""))}</Text>
      {formule !== "" && <Text style={emailStyles.paragraphStyle}>{t.formule(formule)}</Text>}
      {automatisations.length > 0 && (
        <Text style={emailStyles.paragraphStyle}>
          {t.automatisations(automatisations.join(", "))}
        </Text>
      )}
      <Text style={emailStyles.paragraphStyle}>
        {t.montants(
          field(p, "montantHtLabel", ""),
          field(p, "montantTvaLabel", ""),
          field(p, "montantTtcLabel", ""),
        )}
      </Text>
      {recurrent.length > 0 && (
        <>
          <Text style={emailStyles.paragraphStyle}>{t.recurrentTitre}</Text>
          {recurrent.map((ligne) => (
            <Text key={ligne} style={emailStyles.paragraphStyle}>
              {ligne}
            </Text>
          ))}
        </>
      )}
      {cgvLabel !== "" && <Text style={emailStyles.paragraphStyle}>{t.cgv(cgvLabel)}</Text>}
      <Text style={emailStyles.paragraphStyle}>
        {p.cgvJointes === true ? t.attachments : t.attachmentsSansCgv}
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
