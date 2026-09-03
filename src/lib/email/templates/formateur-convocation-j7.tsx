// Email — convocation pratique du FORMATEUR, 7 jours avant la session (2026-09-03).
//
// Le stagiaire recevait sa convocation et son rappel J-7 ; le formateur, rien.
// Il apprenait l'adresse en ouvrant son espace — où elle ne figurait d'ailleurs
// qu'à moitié (ville et code postal, jamais la salle ni le contact). Ce message
// lui met sous les yeux TOUT ce qu'il faut pour arriver au bon endroit, à la
// bonne heure, et entrer : adresse, salle, lien visio, contact sur place,
// consignes d'accès, horaires, effectif, kit.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import {
  InfosPratiquesFormateurBloc,
  type InfosPratiquesFormateur,
} from "./_infos-pratiques-formateur";
import type { Locale } from "../../../../prisma/generated/client";

type Payload = InfosPratiquesFormateur & {
  /** Vrai si le formateur n'a pas encore répondu à la proposition de mission. */
  missionEnAttente?: boolean;
};

export const formateurConvocationJ7Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") return objetCompose("Dans 7 jours —", p.titreFormation ?? "Formation");
  return objetCompose("In 7 days —", p.titreFormation ?? "Training");
};

export function FormateurConvocationJ7Email({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  return (
    <EmailLayout
      famille="C"
      preview="Adresse, salle, contact sur place, horaires et effectif : tout est dans ce message."
      title="Votre session démarre dans une semaine"
      cta={{ label: "Ouvrir la session dans mon espace", href: p.lienEspace }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Vous animez <strong>{p.titreFormation}</strong> à partir du <strong>{p.dateDebut}</strong> —{" "}
        {p.modalite}. Voici les informations pratiques.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.formateurPrenomNom} — relisez-les maintenant, et signalez-nous sans attendre ce
        qui manque ou ne vous convient pas.
      </Text>
      <InfosPratiquesFormateurBloc p={p} />
      {p.missionEnAttente === true ? (
        <Text style={{ ...emailStyles.paragraphStyle, marginTop: 12 }}>
          <strong>Vous n&apos;avez pas encore confirmé cette mission.</strong> Répondez depuis votre
          espace, sinon nous devrons chercher un autre intervenant.
        </Text>
      ) : null}
      <Text style={{ ...emailStyles.paragraphStyle, marginTop: 12 }}>
        {p.kitDisponible === true
          ? "Le kit formateur imprimé (feuilles d'émargement, liste des stagiaires) est publié : téléchargez-le depuis la page de la session."
          : "La feuille d'émargement se signe depuis votre espace, sur votre poste ou celui des stagiaires."}
      </Text>
    </EmailLayout>
  );
}
