// Email — l'exemplaire INTÉGRALEMENT SIGNÉ, remis au signataire.
//
// 🔴 Le gabarit qui manquait, et le défaut qu'il ferme (constat du 2026-09-04).
//
// La convention AXI-DOC-2026-039 a été envoyée à la cliente à 20:47 UTC, signée
// par elle, contresignée par l'organisme à 21:33 UTC. Et RIEN N'EST PARTI. La
// cliente n'a jamais reçu l'exemplaire signé.
//
// Ce n'est pas une politesse manquante : un contrat de formation professionnelle
// n'existe qu'une fois REMIS aux deux parties. Tant que l'exemplaire ne part
// pas, l'organisme détient seul la preuve d'un engagement réciproque — et
// l'écran de retour du portail promet pourtant, mot pour mot, que
// « … vous adressera l'exemplaire contresigné ».
//
// Le PDF EST joint, contrairement à `convention-envoi` qui ne joint rien. La
// raison est exactement inverse de celle qui vaut là-bas : avant signature, un
// PDF joint inviterait à signer hors circuit ; après signature, le PDF EST la
// pièce, et un lien qui expire ferait de la remise une remise à durée limitée.
//
// Famille A — pièce contractuelle nominative. Aucun lien social, aucune
// soupape de réponse commerciale : ce message porte une preuve, pas une offre.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  /** N° de la pièce. Ex. « AXI-DOC-2026-039 ». */
  numero: string;
  /** Libellé du circuit. Ex. « la convention de formation ». */
  libellePiece: string;
  /** Noms des signataires, dans l'ordre où ils ont signé. */
  signataires?: readonly string[];
  /**
   * Empreinte SHA-256 COMPLÈTE de la pièce scellée (S6a, k). Imprimée en
   * entier : une empreinte tronquée ne prouve rien.
   */
  empreinte?: string;
  /**
   * Copie PARTIELLE (S6a) : le signataire reçoit la pièce portant SA
   * signature, d'autres parties doivent encore signer. Le texte ne doit
   * jamais laisser croire que l'accord est conclu.
   */
  partielle?: boolean;
}

function field(p: Partial<Payload>, key: "numero" | "libellePiece", fallback: string): string {
  const v = p[key];
  return v === undefined || v === null || `${v}`.trim() === "" ? fallback : `${v}`;
}

function listeSignataires(p: Partial<Payload>): string {
  const s = p.signataires;
  if (!Array.isArray(s)) return "";
  const noms = s.map((n) => `${n}`.trim()).filter((n) => n.length > 0);
  if (noms.length === 0) return "";
  if (noms.length === 1) return noms[0] as string;
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

const COPY = {
  fr: {
    title: "Votre exemplaire signé",
    intro: "Bonjour,",
    body: (libelle: string) =>
      `${libelle.charAt(0).toUpperCase()}${libelle.slice(1)} est désormais signée par l'ensemble des parties. Vous en trouverez l'exemplaire complet en pièce jointe.`,
    preview: "Toutes les parties ont signé — votre exemplaire est en pièce jointe.",
    // Ce que le destinataire doit RETENIR, et qui n'est écrit nulle part
    // ailleurs : ce PDF est sa copie à lui, pas un accusé de réception.
    conserver:
      "Ce document fait foi de l'accord conclu entre nous : conservez-le, il vous sera demandé en cas de contrôle de votre financeur.",
    qui: (noms: string) => `Signataires : ${noms}.`,
    ref: (n: string) => `Référence du document : ${n}`,
    empreinte: (e: string) => `Empreinte SHA-256 du document signé : ${e}`,
    titlePartielle: "Copie de votre signature",
    bodyPartielle: (libelle: string) =>
      `Votre signature sur ${libelle} est bien enregistrée. Vous trouverez en pièce jointe une copie du document portant votre signature.`,
    previewPartielle: "Votre signature est enregistrée — l'exemplaire complet suivra.",
    conserverPartielle:
      "D'autres parties doivent encore signer : cette copie n'est pas l'exemplaire final. Celui-ci vous sera adressé dès que toutes les signatures seront réunies.",
    questions:
      "Pour toute question sur cette pièce ou sur la suite du parcours, répondez simplement à cet email.",
    close: "Bien cordialement,\nL'équipe Axion-IA",
  },
  en: {
    title: "Your signed copy",
    intro: "Hello,",
    body: (libelle: string) =>
      `${libelle.charAt(0).toUpperCase()}${libelle.slice(1)} has now been signed by all parties. Please find the complete signed copy attached.`,
    preview: "All parties have signed — your copy is attached.",
    conserver:
      "This document evidences the agreement between us: please keep it, your funding body may ask for it.",
    qui: (noms: string) => `Signatories: ${noms}.`,
    ref: (n: string) => `Document reference: ${n}`,
    empreinte: (e: string) => `SHA-256 fingerprint of the signed document: ${e}`,
    titlePartielle: "Copy of your signature",
    bodyPartielle: (libelle: string) =>
      `Your signature on ${libelle} has been recorded. Please find attached a copy of the document bearing your signature.`,
    previewPartielle: "Your signature is recorded — the complete copy will follow.",
    conserverPartielle:
      "Other parties still have to sign: this copy is not the final document. It will be sent to you once all signatures are collected.",
    questions:
      "For any question about this document or the next steps, simply reply to this email.",
    close: "Best regards,\nThe Axion-IA team",
  },
} as const;

export const pieceExemplaireSigneSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as Partial<Payload>;
  const numero = field(p, "numero", "");
  if (p.partielle === true) {
    return locale === "fr"
      ? objetCompose("Copie de votre signature —", numero)
      : objetCompose("Copy of your signature —", numero);
  }
  // Le NUMÉRO plutôt que l'intitulé : c'est une pièce d'archive, et c'est par
  // son numéro qu'on la retrouve — dans la boîte du client comme au registre.
  if (locale === "fr") return objetCompose("Votre exemplaire signé —", numero);
  return objetCompose("Your signed copy —", numero);
};

export function PieceExemplaireSigneEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as Partial<Payload>;
  const t = COPY[locale];
  const noms = listeSignataires(p);
  const partielle = p.partielle === true;
  const libelle = field(p, "libellePiece", locale === "fr" ? "la pièce" : "the document");
  const empreinte = typeof p.empreinte === "string" ? p.empreinte.trim() : "";

  return (
    <EmailLayout
      famille="A"
      locale={locale}
      title={partielle ? t.titlePartielle : t.title}
      preview={partielle ? t.previewPartielle : t.preview}
    >
      <Text style={emailStyles.paragraphStyle}>{t.intro}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {partielle ? t.bodyPartielle(libelle) : t.body(libelle)}
      </Text>
      <Text style={emailStyles.paragraphStyle}>
        {partielle ? t.conserverPartielle : t.conserver}
      </Text>
      {noms !== "" && (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          {t.qui(noms)}
        </Text>
      )}
      <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
        {t.ref(field(p, "numero", ""))}
      </Text>
      {empreinte !== "" && (
        <Text
          style={{
            ...emailStyles.paragraphStyle,
            color: emailStyles.COLORS.textMuted,
            wordBreak: "break-all",
          }}
        >
          {t.empreinte(empreinte)}
        </Text>
      )}
      <Text style={emailStyles.paragraphStyle}>{t.questions}</Text>
      <Text style={emailStyles.paragraphStyle}>
        {t.close.split("\n").map((line, i) => (
          <span key={i}>
            {line}
            <br />
          </span>
        ))}
      </Text>
    </EmailLayout>
  );
}
