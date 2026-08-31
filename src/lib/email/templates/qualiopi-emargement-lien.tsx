// Email — LIEN PERSONNEL D'ÉMARGEMENT, envoyé avant (ou pendant) la formation.
//
// ── Pourquoi ce template existe (2026-08-16) ────────────────────────────────
//
// 🔴 Constaté sur le premier dossier réel, AXI-SESS-2026-005 : la stagiaire n'a
// jamais pu émarger, et rien ne pouvait le signaler tant qu'il était encore
// temps. La raison était simple et invisible — **cet email n'existait pas**.
//
// `emettreLiensSessionAction` fabriquait jetons, URL et QR, et les affichait à
// l'écran. Rien ne partait. La vérification a porté sur les 11 gabarits Qualiopi
// et les 18 sites d'appel `enqueueEmail` du domaine : aucun ne concernait
// l'émargement. `src/server/portail/routes.ts` documentait pourtant ce jeton
// comme « envoyé par e-mail à un stagiaire qui n'a jamais ouvert le portail » —
// l'architecture était bâtie autour d'un envoi jamais écrit.
//
// Le contraste achevait de le dire : signer une CONVENTION avait une chaîne
// complète (`piece-lien-signature.ts` → `convention-envoi`). Signer
// l'ÉMARGEMENT n'en avait aucune, alors que c'est la pièce probante des
// indicateurs 9 et 11.
//
// ⚠️ GABARIT DÉDIÉ, et pas un réemploi. Le 15/08, le positionnement partait via
// `qualiopi-portail-acces` — le template de re-demande d'un lien perdu, qui
// disait « vous pouvez ignorer cet email » à quelqu'un qui n'avait rien demandé.
// Un gabarit employé hors de sa finalité MENT à son destinataire. On n'y revient
// pas.
//
// ⚠️ Le lien est PERSONNEL et il porte une signature qui vaut preuve de
// présence. Le corps le dit, parce que le stagiaire doit comprendre qu'il ne se
// transmet pas — un lien partagé, c'est une signature attribuée à la mauvaise
// personne sur une pièce opposable.
//
// ⚠️ Aucune mention de financement public dans cet email (règle CONTRAT-T15).

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  /** Date de début, déjà formatée en toutes lettres (ex. « 16 août 2026 »). */
  dateDebutFormation: string;
  /** Lien personnel `/portail/emarger/<jeton>`. */
  lienEmargement: string;
  numeroSession: string;
}

export const qualiopiEmargementLienSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return objetCompose("Votre lien de signature —", p.titreFormation ?? "votre formation");
  }
  return objetCompose("Signature link —", p.titreFormation ?? "your training");
};

export function QualiopiEmargementLienEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const ctaHref = p.lienEmargement ?? `${baseUrl}/fr/portail/mon-espace`;

  if (locale !== "fr") {
    return (
      <EmailLayout
        famille="A"
        preview="One half-day at a time, from your phone. Valid until 48 h after the session."
        title="Your attendance signature link"
        cta={{ label: "Sign my attendance", href: ctaHref }}
        ctaSecret
        locale={locale}
      >
        <Text style={emailStyles.paragraphStyle}>
          Here is your personal link to sign the attendance sheet for{" "}
          <strong>{p.titreFormation}</strong> (session {p.numeroSession}), starting on{" "}
          {p.dateDebutFormation}.
        </Text>
        <Text style={emailStyles.paragraphStyle}>
          Hello {p.stagiairePrenomNom} — keep this link to yourself: it carries{" "}
          <strong>your</strong> signature. You will sign one half-day at a time, from your own
          phone. The link stays valid until 48 hours after the end of the session.
        </Text>
      </EmailLayout>
    );
  }

  return (
    <EmailLayout
      famille="A"
      preview="Une demi-journée à la fois, depuis votre téléphone. Valable jusqu'à J+48 h."
      title="Votre lien de signature de présence"
      cta={{ label: "Signer ma présence", href: ctaHref }}
      /* Ce lien PORTE la signature du stagiaire : le corps dit lui-même
         « gardez ce lien pour vous ». L'imprimer en clair contredirait la
         consigne dans le même message. */
      ctaSecret
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Voici votre lien personnel pour signer la feuille de présence de{" "}
        <strong>{p.titreFormation}</strong> (session {p.numeroSession}), qui débute le{" "}
        {p.dateDebutFormation}.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.stagiairePrenomNom} — vous signerez une demi-journée à la fois, depuis votre
        téléphone, au fil de la formation. Gardez ce lien pour vous : il porte{" "}
        <strong>votre</strong> signature, et une signature attribuée à quelqu&apos;un d&apos;autre
        rendrait la feuille inexacte.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Le lien reste valable jusqu&apos;à 48 heures après la fin de la session. Si vous le perdez,
        demandez-le simplement à votre formateur.
      </Text>
    </EmailLayout>
  );
}
