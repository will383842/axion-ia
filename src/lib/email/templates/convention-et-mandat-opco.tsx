// Courriel — envoi MANUEL de la convention ET du mandat OPCO au signataire du client.
//
// INT-T77-A. Déclenché exclusivement par un clic admin (« Envoyer par e-mail »
// du panneau de signature), JAMAIS par un cron : mettre un lien de signature en
// circulation reste une décision humaine.
//
// 🔴 LE TEXTE EST CELUI DE LA JURISTE, MOT POUR MOT (axion-apporteurs #782,
// 6035018511). Ne rien y retoucher sans son avis : il engage la Société.
//   - « vaut signature » est FAUX : un lien identifie le signataire et ouvre la
//     pièce ; la signature est l'acte qu'il fait ensuite sur la page, par son
//     consentement exprès (art. 8 du mandat). Le courriel dit donc que le lien
//     « n'ouvre que sa pièce ».
//   - UNE seule phrase sur le mandat, qui en cite les deux bornes (art. 3 et 6) :
//     un pouvoir limité et révocable. Rien sur le règlement de la formation,
//     rien sur la condition suspensive — la convention les porte elle-même.
//   - « courriel », comme dans les autres textes adressés au client.
//
// Les deux liens sont portés par des BOUTONS, jamais imprimés en clair : un lien
// de signature est personnel, et une URL nue est indistinguable d'un hameçonnage.
//
// Seul le français est rédigé : la juriste n'a validé que lui, et la locale EN
// est désactivée (AGENTS.md). Une autre locale rend donc le texte français.

import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** Nom du signataire, tel que figé dans les jetons. */
  signataireNom: string;
  /** Raison sociale du client. */
  clientNom: string;
  /** Intitulé de l'action de formation. */
  titreFormation: string;
  /** N° de la convention. */
  numeroConvention: string;
  /** Lien de signature de la convention — porté par son bouton. */
  conventionUrl: string;
  /** N° du mandat OPCO. Absent : le courriel ne parle que de la convention. */
  numeroMandat?: string;
  /** Lien de signature du mandat — porté par son bouton. */
  mandatUrl?: string;
  /** Message libre de l'admin (multi-lignes, affiché tel quel). Optionnel. */
  messagePersonnalise?: string;
}

function field(p: Partial<Payload>, key: keyof Payload, fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

export const COPY = {
  title: "Votre convention et votre mandat OPCO à signer",
  titreSansMandat: "Votre convention de formation à signer",
  preview: "Lecture intégrale possible avant de signer. Chaque lien vous est personnel.",
  intro: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
  corps: (titre: string, client: string) =>
    `La convention de formation professionnelle relative à « ${titre} », établie entre ${client} et Axion-IA, et le mandat OPCO qui s'y rattache sont prêts à être signés.`,
  corpsSansMandat: (titre: string, client: string) =>
    `La convention de formation professionnelle relative à « ${titre} », établie entre ${client} et Axion-IA, est prête à être signée.`,
  mandat:
    "Le mandat autorise seulement Axion-IA à déposer en votre nom, auprès de l'OPCO, la demande de prise en charge de cette formation ; vous pouvez le révoquer à tout moment, par écrit.",
  liens:
    "Les deux liens ci-dessous ouvrent chacun une pièce : vous pouvez la lire intégralement avant de la signer. La convention et le mandat se signent séparément. Chaque lien vous est personnel et n'ouvre que sa pièce : merci de ne pas le transférer.",
  lienSeul:
    "Le lien ci-dessous ouvre la pièce : vous pouvez la lire intégralement avant de la signer. Il vous est personnel et n'ouvre que cette pièce : merci de ne pas le transférer.",
  ctaConvention: "Signer la convention",
  ctaMandat: "Signer le mandat OPCO",
  references: (c: string, m: string) => `Références : ${c} · ${m}`,
  referenceSeule: (c: string) => `Référence : ${c}`,
  questions:
    "Pour toute question sur le contenu ou les modalités, répondez simplement à ce courriel.",
  close: "Bien cordialement,\nL'équipe Axion-IA",
} as const;

export const conventionEtMandatOpcoSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Partial<Payload>;
  const titre = field(p, "titreFormation", "");
  const mandat = field(p, "mandatUrl", "") !== "";
  // Borné comme l'existant : le préfixe est court pour laisser de la place à l'intitulé.
  return objetCompose(
    mandat ? "Convention et mandat OPCO à signer —" : "Convention à signer —",
    titre,
  );
};

export function ConventionEtMandatOpcoEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const message = field(p, "messagePersonnalise", "");
  const conventionUrl = field(p, "conventionUrl", "");
  const mandatUrl = field(p, "mandatUrl", "");
  const avecMandat = mandatUrl !== "";
  const titre = field(p, "titreFormation", "");
  const client = field(p, "clientNom", "");
  const boutons = [
    ...(conventionUrl !== "" ? [{ label: COPY.ctaConvention, href: conventionUrl }] : []),
    ...(avecMandat ? [{ label: COPY.ctaMandat, href: mandatUrl }] : []),
  ];

  return (
    <EmailLayout
      famille="A"
      locale={locale}
      title={avecMandat ? COPY.title : COPY.titreSansMandat}
      preview={COPY.preview}
    >
      <Text style={emailStyles.paragraphStyle}>{COPY.intro(field(p, "signataireNom", ""))}</Text>
      {message !== "" &&
        message.split("\n").map((line, i) => (
          <Text key={i} style={emailStyles.paragraphStyle}>
            {line}
          </Text>
        ))}
      <Text style={emailStyles.paragraphStyle}>
        {avecMandat ? COPY.corps(titre, client) : COPY.corpsSansMandat(titre, client)}
      </Text>
      {avecMandat && <Text style={emailStyles.paragraphStyle}>{COPY.mandat}</Text>}
      <Text style={emailStyles.paragraphStyle}>{avecMandat ? COPY.liens : COPY.lienSeul}</Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        {boutons.map((b) => (
          <Button
            key={b.label}
            href={b.href}
            style={{ ...emailStyles.ctaStyle, display: "inline-block", margin: "6px 8px" }}
            className="ax-cta"
          >
            {b.label} &nbsp;→
          </Button>
        ))}
      </Section>
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {avecMandat
          ? COPY.references(field(p, "numeroConvention", ""), field(p, "numeroMandat", ""))
          : COPY.referenceSeule(field(p, "numeroConvention", ""))}
      </Text>
      <Text style={emailStyles.paragraphStyle}>{COPY.questions}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {COPY.close.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
    </EmailLayout>
  );
}
