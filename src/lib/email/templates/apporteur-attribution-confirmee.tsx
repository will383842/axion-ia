// E-mail à l'APPORTEUR — son attribution est CONFIRMÉE, ou sa protection est PROLONGÉE
// (2026-10-08, vérification finale de a1, point 3 ; contrat 2.3, art. 3.2 et 3.4).
//
// Deux variantes, un seul gabarit (`apporteur-attribution-confirmee`) :
//   · `confirmee` — l'attribution devient définitive : confirmation écrite de la Société
//     (bouton de la console, ou « l'entreprise a répondu »), ou confirmation réputée acquise
//     (passage quotidien, art. 3.2) ;
//   · `prolongee` — au terme, la protection est prolongée une fois de trois mois (art. 3.4),
//     avec le motif en clair.
//
// Fichier À PART de `apporteur-demarrage.tsx` (une autre session y travaille). Même châssis :
// famille B, sans rangée sociale, vouvoiement, signature courte du fondateur.
//
// Vocabulaire (anti-requalification) : « présenter », « attribuée », « commission ». Une
// attribution ne fait naître AUCUNE commission par elle-même (art. 3.2) : le message le dit,
// sans rien promettre.

import { Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

export type VarianteAttribution = "confirmee" | "prolongee";

/** Motif de prolongation (art. 3.4), tel que le passage quotidien l'enregistre. */
export type MotifProlongationEmail = "devis_en_cours" | "echange_recent" | "financement_en_cours";

interface Payload {
  /** « Claire Durand » : seul le prénom est dit. */
  contactName?: string;
  /** L'entreprise présentée, telle que saisie. */
  entreprise?: string;
  /** Fin de la protection, déjà formatée en heure de Paris : « 8 avril 2027 ». */
  finProtection?: string;
  variante?: VarianteAttribution;
  motif?: MotifProlongationEmail;
}

interface Props {
  locale: Locale;
  payload: Record<string, unknown>;
}

function texte(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export const COPY_ATTRIBUTION = {
  confirmee: {
    subject: (e: string) => (e ? `${e} vous est attribuée` : "Votre attribution est confirmée"),
    title: "Votre attribution est confirmée",
    preview: "L'attribution est désormais définitive.",
    texte: (e: string) =>
      `L'attribution de ${e || "l'entreprise que vous nous avez présentée"} est désormais définitive : elle vous est réservée.`,
  },
  prolongee: {
    subject: (e: string) => (e ? `${e} : protection prolongée` : "Votre protection est prolongée"),
    title: "Votre protection est prolongée",
    preview: "La protection de votre attribution est prolongée de trois mois.",
    texte: (e: string, motif: string) =>
      `La protection de ${e || "l'entreprise que vous nous avez présentée"} arrivait à son terme. ${motif} : elle est prolongée une fois, de trois mois.`,
  },
  motifs: {
    devis_en_cours: "Un devis est en cours avec elle",
    echange_recent: "Nous avons échangé récemment avec elle",
    financement_en_cours: "Un dossier de financement est en cours pour elle",
  } as Record<MotifProlongationEmail, string>,
  motifParDefaut: "Un échange est en cours avec elle",
  fin: (d: string) => (d ? `Fin de la protection : ${d}.` : ""),
  commission:
    "Une attribution ne fait naître aucune commission par elle-même : la commission naît d'une commande de l'entreprise, une fois la prestation réalisée et entièrement payée.",
  bonjour: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
} as const;

function variante(p: Payload): VarianteAttribution {
  return p.variante === "prolongee" ? "prolongee" : "confirmee";
}

export const apporteurAttributionConfirmeeSubject = (
  _locale: Locale,
  payload: Record<string, unknown> = {},
): string => {
  const p = payload as Payload;
  return COPY_ATTRIBUTION[variante(p)].subject(texte(p.entreprise));
};

export function ApporteurAttributionConfirmeeEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const v = variante(p);
  const e = texte(p.entreprise);
  const prenom = texte(p.contactName).split(/\s+/)[0] ?? "";
  const corps =
    v === "prolongee"
      ? COPY_ATTRIBUTION.prolongee.texte(
          e,
          (p.motif && COPY_ATTRIBUTION.motifs[p.motif]) || COPY_ATTRIBUTION.motifParDefaut,
        )
      : COPY_ATTRIBUTION.confirmee.texte(e);
  const fin = COPY_ATTRIBUTION.fin(texte(p.finProtection));
  return (
    <EmailLayout
      famille="B"
      preview={COPY_ATTRIBUTION[v].preview}
      title={COPY_ATTRIBUTION[v].title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>{COPY_ATTRIBUTION.bonjour(prenom)}</Text>
      <Text style={emailStyles.paragraphStyle}>{corps}</Text>
      {fin ? <Text style={emailStyles.paragraphStyle}>{fin}</Text> : null}
      <Text style={emailStyles.paragraphStyle}>{COPY_ATTRIBUTION.commission}</Text>
    </EmailLayout>
  );
}
