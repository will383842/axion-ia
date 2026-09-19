// Bloc « kit apporteur » partagé par les e-mails du réseau d'apporteurs
// d'affaires (2026-09-19) : le document de présentation et le catalogue, en
// deux liens. Un seul rendu pour tous — accusé du premier contact, relances,
// confirmation du dossier, invitation à l'échange — pour que la personne
// retrouve toujours les deux mêmes documents, au même endroit du message.
//
// Les URL viennent de `lib/commercial-application/kit-apporteur.ts`, calculées
// AU RENDU : un e-mail différé (relance J+7) porte donc toujours le chemin
// courant, pas celui du jour où il a été mis en file.
//
// Vocabulaire : « recommander », jamais « vendre » (anti-requalification).

import { Text } from "@react-email/components";
import { emailStyles } from "./_layout";
import { liensKitApporteur } from "@/lib/commercial-application/kit-apporteur";

const COPY = {
  fr: {
    intro: "Pour découvrir le réseau et ce que tu pourras recommander :",
    document: "Le document de présentation",
    documentDetail: " — commissions, fonctionnement, prestations (12 pages)",
    catalogue: "Le catalogue des formations",
    catalogueDetail: " — à feuilleter ou à télécharger",
  },
  en: {
    intro: "To discover the network and what you will be able to recommend:",
    document: "The presentation document",
    documentDetail: " — commissions, how it works, services (12 pages, in French)",
    catalogue: "The training catalogue",
    catalogueDetail: " — browse or download it",
  },
} as const;

const lien: React.CSSProperties = {
  color: emailStyles.COLORS.terracotta,
  fontWeight: 600,
};

export function BlocKitApporteur({ locale }: { locale: "fr" | "en" }) {
  const t = COPY[locale];
  const { documentUrl, catalogueUrl } = liensKitApporteur(locale);
  return (
    <>
      <Text style={emailStyles.paragraphStyle}>{t.intro}</Text>
      <Text style={{ ...emailStyles.paragraphStyle, margin: "0 0 6px" }}>
        →{" "}
        <a href={documentUrl} style={lien}>
          {t.document}
        </a>
        {t.documentDetail}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        →{" "}
        <a href={catalogueUrl} style={lien}>
          {t.catalogue}
        </a>
        {t.catalogueDetail}
      </Text>
    </>
  );
}
