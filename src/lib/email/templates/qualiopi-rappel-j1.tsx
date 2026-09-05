// Email — rappel de la VEILLE, envoyé au stagiaire (ADR 0048 §4.3).
//
// 🔴 CE GABARIT EXISTE POUR UNE SEULE RAISON : porter la manière d'ENTRER.
//
// `formateur-rappel-j1` existait, `qualiopi-rappel-j7` existait, il n'y avait
// aucun rappel de la veille pour le PARTICIPANT. En présentiel l'oubli se
// rattrape — la personne est attendue quelque part, on l'appelle. À distance,
// un participant qui oublie ne manque à personne jusqu'à ce que la séance soit
// finie, et son absence devient un trou dans la preuve d'assiduité.
//
// 🔑 ET C'EST LE SEUL E-MAIL QUI DONNE LE LIEN DE VISIO EN ENTIER. La
// convocation n'en montre que l'hôte (« meet.google.com ») via `formatLieu`, et
// cette réduction est JUSTE : la convocation est une pièce archivée, souvent
// réexpédiée, parfois versée au dossier de contrôle — un lien qui vaut clé
// d'accès n'y a pas sa place. Ce message-ci n'est archivé nulle part et
// s'adresse à une seule personne.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  stagiairePrenomNom: string;
  titreFormation: string;
  dateDebut: string;
  dateFin: string;
  lieu: string;
  modalite: string;
  numeroSession: string;
  lienPortail?: string;
  /**
   * Lien de connexion COMPLET pour une session à distance ou hybride. Absent
   * quand la session est en présentiel — ou, écart signalé au journal par
   * `envoyerRappelJ1`, quand personne ne l'a renseigné.
   */
  lienVisio?: string;
  /**
   * Lien PERSONNEL de signature de présence. Présent uniquement si ce rappel
   * est le premier à en mettre un en circulation (cf. `getLienEmargementSiPremier`).
   */
  lienEmargement?: string;
}

export const qualiopiRappelJ1Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") {
    return objetCompose("C'est demain —", p.titreFormation ?? "Formation");
  }
  return objetCompose("Tomorrow —", p.titreFormation ?? "Training");
};

export function QualiopiRappelJ1Email({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

  // 🔴 L'ACTION PRINCIPALE EST DE SE CONNECTER, quand il y a de quoi.
  //
  // Ce n'est pas un choix d'ergonomie, c'est un choix de BUDGET DE LIENS. La
  // famille C en autorise 4 (§5.4, cf. `REGIME_FAMILLE` dans `_layout`), dont
  // un est déjà pris par le lien d'opposition obligatoire. Avec le lien de
  // visio, le lien d'émargement, l'espace stagiaire et l'adresse de contact, on
  // en demanderait 5.
  //
  // On sacrifie donc l'espace stagiaire, et non le lien de connexion : la
  // veille d'une séance, l'espace ne porte plus rien qui n'ait déjà été lu, et
  // le lien de connexion est la seule chose que ce message existe pour dire.
  // Le lien reparaît naturellement dès qu'il n'y a pas de visio.
  const ctaHref = p.lienVisio ?? p.lienPortail ?? `${baseUrl}/fr/portail/mon-espace`;
  const ctaLabel = p.lienVisio ? "Rejoindre la formation" : "Accéder à mon espace";

  return (
    <EmailLayout
      famille="C"
      preview="Le lien de connexion et votre lien de signature, à garder sous la main."
      title="Votre formation, c'est demain"
      cta={{ label: ctaLabel, href: ctaHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        <strong>{p.titreFormation}</strong> démarre le <strong>{p.dateDebut}</strong> — {p.modalite}{" "}
        — {p.lieu}.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.stagiairePrenomNom} — voici tout ce dont vous avez besoin pour demain, sans avoir
        à chercher dans vos anciens messages.
      </Text>
      {p.lienVisio ? (
        <>
          <Text style={emailStyles.paragraphStyle}>
            <strong>Pour vous connecter :</strong> <a href={p.lienVisio}>{p.lienVisio}</a>
          </Text>
          <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
            Testez votre micro et votre caméra quelques minutes avant l&apos;heure — c&apos;est le
            moment où l&apos;on découvre qu&apos;une mise à jour est en attente.
          </Text>
        </>
      ) : (
        <Text style={emailStyles.paragraphStyle}>
          <strong>Sur place :</strong> {p.lieu}. Présentez-vous quelques minutes avant l&apos;heure
          de démarrage.
        </Text>
      )}
      {p.lienEmargement ? (
        <>
          <Text style={emailStyles.paragraphStyle}>
            <strong>Votre lien personnel de signature de présence :</strong>{" "}
            <a href={p.lienEmargement}>Signer ma présence</a>
          </Text>
          <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
            Ce lien est strictement personnel — il vaut signature, ne le transférez à personne. Il
            reste valable jusqu&apos;à 48 h après la fin de la session.
          </Text>
        </>
      ) : null}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        Session du {p.dateDebut} au {p.dateFin} — référence {p.numeroSession}
      </Text>
    </EmailLayout>
  );
}
