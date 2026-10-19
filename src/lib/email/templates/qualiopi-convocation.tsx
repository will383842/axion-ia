// Email — convocation stagiaire à une session de formation (T15).
// Envoyé dès la confirmation de l'inscription (envoyerConvocation).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  dateDebut: string; // ISO ou formatée côté service
  dateFin: string;
  lieu: string;
  modalite: string;
  numeroSession: string;
  lienPortail?: string;
  /**
   * Chantier QNC, L04 — les aménagements prévus pour CE stagiaire (les mesures
   * seules, jamais le besoin). Absent : aucune consigne.
   */
  amenagements?: string[];
  /**
   * Chantier QNC, L05 — convocation v2. Tous ces champs sont ABSENTS de la
   * convocation actuelle, dont le rendu reste identique.
   */
  /** Les pièces jointes en PDF (libellés). */
  piecesJointes?: string[];
  /** Distanciel : l'outil nommé, et le lien (ou, à défaut, la mention). */
  outilVisio?: string;
  lienVisio?: string;
  mentionLienVisio?: string;
  /** « ACC-1A2B3C4D » : le numéro de l'accès à l'espace stagiaire. */
  numeroAcces?: string;
  /** Copie adressée à l'entreprise : ni lien personnel, ni aménagements. */
  copieEntreprise?: boolean;
}

const COPY = {
  fr: {
    title: "Votre convocation à la formation",
    preview: (debut: string, lieu: string) =>
      `Début le ${debut}${lieu ? ` — ${lieu}` : ""}. Modalités pratiques dans votre espace.`,
    intro: (n: string) => `Bonjour ${n},`,
    body: (titre: string, debut: string, fin: string, lieu: string, modalite: string) =>
      `Nous avons le plaisir de vous convoquer à la formation « ${titre} » du ${debut} au ${fin} — ${modalite} — ${lieu}.`,
    kit: "Votre convocation officielle et les modalités pratiques (accès, matériel, règlement intérieur) sont disponibles dans votre espace stagiaire.",
    // Annonce SANS lien, et c'est voulu : un jeton d'émargement créé ici serait
    // révoqué par celui du rappel J-7 (un seul jeton vivant par inscription), et
    // le stagiaire cliquerait un lien mort le jour J. On annonce, le J-7 livre.
    emargement:
      "Quelques jours avant la session, vous recevrez par e-mail votre lien personnel de signature de présence — gardez-le pour le jour de la formation.",
    cta: "Accéder à mon espace",
    joints: (liste: string) => `Pièces jointes à ce courriel (PDF) : ${liste}.`,
    visio: (outil: string) => `Cette formation se tient à distance, avec ${outil}.`,
    visioLien: (lien: string) => `Lien de connexion : ${lien}`,
    numeroAcces: (n: string) =>
      `Numéro de votre accès à l'espace stagiaire : ${n} (à nous indiquer si vous nous écrivez à ce sujet).`,
    copieIntro: (n: string) =>
      `Copie, pour information, de la convocation de ${n} à la formation ci-dessous.`,
    refRow: (n: string) => `Référence session : ${n}`,
  },
} as const;

export const qualiopiConvocationSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return objetCompose("Convocation —", p.titreFormation ?? "Formation");
  }
  return objetCompose("Training convocation —", p.titreFormation ?? "Training");
};

export function QualiopiConvocationEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const t = COPY.fr; // T15 : emails publics en FR uniquement (EN désactivé runtime)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienPortail ?? `${baseUrl}/fr/portail/mon-espace`;
  const copie = p.copieEntreprise === true;
  const joints = Array.isArray(p.piecesJointes) && p.piecesJointes.length > 0;
  return (
    <EmailLayout
      famille="B"
      preview={t.preview(p.dateDebut, p.lieu)}
      title={t.title}
      {...(copie ? {} : { cta: { label: t.cta, href: ctaHref } })}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        {copie ? t.copieIntro(p.stagiairePrenomNom) : t.intro(p.stagiairePrenomNom)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.body(p.titreFormation, p.dateDebut, p.dateFin, p.lieu, p.modalite)}
      </Text>
      {p.outilVisio ? (
        <Text style={emailStyles.paragraphStyle}>
          {t.visio(p.outilVisio)}{" "}
          {p.lienVisio && !copie ? t.visioLien(p.lienVisio) : (p.mentionLienVisio ?? "")}
        </Text>
      ) : null}
      {joints ? (
        <Text style={emailStyles.paragraphStyle}>
          {t.joints((p.piecesJointes ?? []).join(", "))}
        </Text>
      ) : null}
      {copie ? null : <Text style={emailStyles.paragraphStyle}>{t.kit}</Text>}
      {copie ? null : <Text style={emailStyles.paragraphStyle}>{t.emargement}</Text>}
      {Array.isArray(p.amenagements) && p.amenagements.length > 0 && !copie ? (
        <Text style={emailStyles.paragraphStyle}>
          {locale === "fr" ? "Aménagements prévus pour vous : " : "Adjustments planned for you: "}
          {p.amenagements.join(" ; ")}.
        </Text>
      ) : null}
      {p.numeroAcces && !copie ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.numeroAcces(p.numeroAcces)}
        </Text>
      ) : null}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.refRow(p.numeroSession)}
      </Text>
    </EmailLayout>
  );
}
