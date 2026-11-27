// E-mail MENSUEL à l'apporteur : relevé de ses commissions du mois précédent
// (chantier « relevé mensuel des apporteurs », lot 2, 2026-11-27).
//
// GABARIT DORMANT : aucun émetteur ne l'appelle dans ce lot. L'émetteur (lot 4a) ne part que
// sur le clic du dirigeant ; ce fichier ne décide ni qui reçoit, ni quand.
//
// Le relevé est un RÉCAPITULATIF, pas une facture : les autofactures (gabarit `apporteur-releve`,
// au fil de l'eau) restent les pièces qui font foi. Le texte le dit, dans les deux variantes.
//
// Rien n'est calculé ici : le total, le nombre, le report et les délais rappelés arrivent déjà
// mis en forme par le payload (le calcul figé du lot 3b est la seule source). Un champ absent
// n'est pas rendu : le gabarit n'invente ni montant ni délai.
//
// Pièce jointe : le PDF du relevé n'est pas rendu par le gabarit. Le payload porte sa clé
// (`pdfR2Key`, = `pdfR2Key` de la ligne du relevé) ; c'est l'émetteur qui la reporte dans
// `attachments` du job. Le gabarit ne la recopie jamais dans le corps.
//
// Le lien de l'espace (`lienEspace`) est posé par l'émetteur et rendu par le châssis.
// Fichier À PART de `apporteur-demarrage.tsx` (conflits évités avec d'autres chantiers).

import { Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  contactName?: string;
  /** Mois du relevé, en toutes lettres (« octobre 2026 »). */
  mois?: string;
  /** Total du mois, déjà formaté (le montant vient du relevé figé). */
  totalMois?: string;
  nombreCommissions?: number;
  /** Phrase ou montant de report, déjà formaté ; absent = rien à reporter. */
  report?: string;
  /** Variante courte : aucun mouvement dans le mois. */
  aucunMouvement?: boolean;
  /** Délais du contrat rappelés tels quels (jamais écrits ici). */
  delaiForme?: string;
  delaiCalcul?: string;
  delaiReponse?: string;
  /** Clé R2 du PDF : lue par l'émetteur pour `attachments`, jamais rendue. */
  pdfR2Key?: string;
}

type Props = { locale: Locale; payload: Record<string, unknown> };

export const COPY_RELEVE_MENSUEL = {
  subject: (mois: string) =>
    mois ? `Votre relevé de commissions de ${mois}` : "Votre relevé de commissions",
  subjectVide: (mois: string) =>
    mois ? `Votre relevé de ${mois} : aucun mouvement` : "Votre relevé : aucun mouvement",
  preview: "Le récapitulatif de vos commissions du mois.",
  title: "Votre relevé de commissions",
  // Salutation et information sur la MÊME ligne (résumé de la boîte de réception).
  ouverture: (n: string, phrase: string) =>
    `${["Bonjour", n].filter(Boolean).join(" ")}, ${phrase}`,
  intro: (mois: string) =>
    mois
      ? `voici le récapitulatif de vos commissions de ${mois}.`
      : "voici le récapitulatif de vos commissions.",
  introVide: (mois: string) =>
    mois
      ? `votre relevé de ${mois} : aucun mouvement ce mois-ci.`
      : "votre relevé : aucun mouvement ce mois-ci.",
  total: (t: string) => `Total du mois : ${t}.`,
  nombre: (n: number) => (n === 1 ? "1 commission" : `${n} commissions`) + " dans ce relevé.",
  report: (r: string) => `À reporter : ${r}`,
  joint: "Le détail commission par commission est dans le document joint.",
  pasUneFacture:
    "Ce relevé est un récapitulatif, qui n'est pas une facture : vos autofactures restent les pièces qui font foi.",
  delaisIntro: "Rappel des délais prévus par votre contrat :",
  forme: (d: string) => `forme d'une autofacture : ${d} ;`,
  calcul: (d: string) => `calcul d'une commission : ${d} ;`,
  reponse: (d: string) => `réponse motivée de notre part : ${d}.`,
} as const;

function texteOuNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function moisDe(p: Payload): string {
  return texteOuNull(p.mois) ?? "";
}

export const apporteurReleveMensuelSubject = (
  _locale: Locale,
  payload?: Record<string, unknown>,
): string => {
  const p = (payload ?? {}) as Payload;
  return p.aucunMouvement
    ? COPY_RELEVE_MENSUEL.subjectVide(moisDe(p))
    : COPY_RELEVE_MENSUEL.subject(moisDe(p));
};

export function ApporteurReleveMensuelEmail({ locale, payload }: Props) {
  const p = payload as Payload;
  const t = COPY_RELEVE_MENSUEL;
  const prenom = (texteOuNull(p.contactName) ?? "").split(/\s+/)[0] ?? "";
  const vide = p.aucunMouvement === true;
  const total = texteOuNull(p.totalMois);
  const report = texteOuNull(p.report);
  const delais = [
    texteOuNull(p.delaiForme) ? t.forme(texteOuNull(p.delaiForme)!) : null,
    texteOuNull(p.delaiCalcul) ? t.calcul(texteOuNull(p.delaiCalcul)!) : null,
    texteOuNull(p.delaiReponse) ? t.reponse(texteOuNull(p.delaiReponse)!) : null,
  ].filter((x): x is string => x !== null);
  return (
    <EmailLayout
      famille="B"
      preview={t.preview}
      title={t.title}
      locale={locale === "fr" ? "fr" : "en"}
      sansReseauxSociaux
      signature="fondateur-court"
    >
      <Text style={emailStyles.paragraphStyle}>
        {t.ouverture(prenom, vide ? t.introVide(moisDe(p)) : t.intro(moisDe(p)))}
      </Text>
      {vide ? null : (
        <>
          {total ? <Text style={emailStyles.paragraphStyle}>{t.total(total)}</Text> : null}
          {typeof p.nombreCommissions === "number" ? (
            <Text style={emailStyles.paragraphStyle}>{t.nombre(p.nombreCommissions)}</Text>
          ) : null}
          {report ? <Text style={emailStyles.paragraphStyle}>{t.report(report)}</Text> : null}
          {texteOuNull(p.pdfR2Key) ? (
            <Text style={emailStyles.paragraphStyle}>{t.joint}</Text>
          ) : null}
        </>
      )}
      <Text style={emailStyles.paragraphStyle}>{t.pasUneFacture}</Text>
      {delais.length > 0 ? (
        <>
          <Text style={emailStyles.paragraphStyle}>{t.delaisIntro}</Text>
          {delais.map((d) => (
            <Text key={d} style={{ ...emailStyles.paragraphStyle, margin: "0 0 4px" }}>
              – {d}
            </Text>
          ))}
        </>
      ) : null}
    </EmailLayout>
  );
}
