// Email — rappel de la veille au FORMATEUR (2026-09-03).
//
// Même bloc pratique que la convocation J-7 (un seul rendu, cf.
// `_infos-pratiques-formateur.tsx`) : la veille, on ne découvre rien de
// nouveau, on relit l'adresse, l'heure et le nom de la personne qui ouvre la
// porte. Le lien de visio, lui, est cliquable directement.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import {
  InfosPratiquesFormateurBloc,
  type InfosPratiquesFormateur,
} from "./_infos-pratiques-formateur";
import type { Locale } from "../../../../prisma/generated/client";

type Payload = InfosPratiquesFormateur & {
  /** « 09:00 » — l'heure du premier créneau, si les journées sont saisies. */
  heureDebutJ1?: string;
};

export const formateurRappelJ1Subject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  if (locale === "fr") return objetCompose("C'est demain —", p.titreFormation ?? "Formation");
  return objetCompose("Tomorrow —", p.titreFormation ?? "Training");
};

export function FormateurRappelJ1Email({
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
      preview="Lieu, heure d'arrivée et personne à contacter sur place — relisez avant de partir."
      title="À demain"
      cta={{ label: "Ouvrir la session dans mon espace", href: p.lienEspace }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        <strong>{p.titreFormation}</strong> démarre demain, le <strong>{p.dateDebut}</strong>
        {p.heureDebutJ1 ? (
          <>
            {" "}
            à <strong>{p.heureDebutJ1}</strong>
          </>
        ) : null}{" "}
        — {p.lieu}.
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        Bonjour {p.formateurPrenomNom} — voici, une dernière fois, tout ce qu&apos;il faut pour
        arriver au bon endroit et entrer.
      </Text>
      <InfosPratiquesFormateurBloc p={p} />
      <Text style={{ ...emailStyles.paragraphStyle, marginTop: 12 }}>
        Un empêchement de dernière minute ? Prévenez-nous immédiatement par téléphone, puis répondez
        à ce message : une session sans formateur se reporte, elle ne s&apos;annule pas toute seule.
      </Text>
    </EmailLayout>
  );
}
