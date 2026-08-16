// Email — lien d'accès à l'espace stagiaire.
//
// DEUX provenances, et le corps du message en dépend :
//
//  · **re-demande self-service** — le participant a cliqué « j'ai perdu mon
//    lien » depuis /portail/demander-acces. C'est le cas d'origine.
//  · **ouverture par l'admin** — quelqu'un de l'organisme a créé l'accès pour
//    lui. Le stagiaire n'a rien demandé.
//
// 🔴 POURQUOI CE BRANCHEMENT EXISTE. Le 15/08, le questionnaire de
// positionnement partait via ce template : la stagiaire recevait « vous avez
// demandé un nouveau lien […] si vous n'êtes pas à l'origine de cette demande,
// vous pouvez ignorer cet email » — pour une pièce qu'elle devait précisément
// NE PAS ignorer. Un gabarit employé hors de sa finalité ment à son
// destinataire.
//
// La leçon n'est pas « ne jamais partager un gabarit » : c'est « ne jamais lui
// faire dire ce qui est faux ». Ici l'objet est le même (un lien d'accès au
// même espace, même CTA, même durée), seule la PROVENANCE change — et le corps
// la reflète explicitement au lieu de la supposer. Un second template
// dupliquerait la maintenance de tout le reste pour un paragraphe.
//
// ⚠️ Aucune mention de financement public (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  lienPortail: string;
  /**
   * `true` quand l'accès a été ouvert par l'organisme et non demandé par le
   * stagiaire. Absent = re-demande self-service (comportement historique).
   */
  ouvertParOrganisme?: boolean;
}

export const qualiopiPortailAccesSubject = (locale: Locale): string =>
  locale === "fr"
    ? "Votre lien d'accès à votre espace — Axion-IA"
    : "Your access link to your space — Axion-IA";

export function QualiopiPortailAccesEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienPortail ?? `${baseUrl}/fr/portail/mon-espace`;
  const parOrganisme = p.ouvertParOrganisme === true;
  return (
    <EmailLayout
      preview="Votre lien d'accès à votre espace stagiaire"
      title="Votre lien d'accès"
      cta={{ label: "Accéder à mon espace", href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour {p.stagiairePrenomNom},</Text>
      {parOrganisme ? (
        <>
          <Text style={emailStyles.paragraphStyle}>
            Nous vous avons ouvert un accès à votre espace stagiaire, où vous retrouvez vos{" "}
            <strong>attestations</strong> et vos <strong>questionnaires</strong>.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            Ce lien est personnel et valable 90 jours. Conservez-le : il vous servira tout au long
            de votre parcours.
          </Text>
        </>
      ) : (
        <>
          <Text style={emailStyles.paragraphStyle}>
            Vous avez demandé un nouveau lien d&apos;accès à votre espace stagiaire, où vous
            retrouvez vos <strong>attestations</strong> et vos <strong>questionnaires</strong>.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            Ce lien est personnel et valable 90 jours. Si vous n&apos;êtes pas à l&apos;origine de
            cette demande, vous pouvez ignorer cet email.
          </Text>
        </>
      )}
    </EmailLayout>
  );
}
