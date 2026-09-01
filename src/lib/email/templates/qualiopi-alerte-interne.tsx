// Email — alerte interne Qualiopi (T15 — notifierAlerteInterne).
// Destinataire : équipe Axion-IA (admin). NE PAS envoyer aux stagiaires.
//
// Lot 14 (T3b) — le gabarit sait désormais porter UN LOT d'alertes du même
// code, pas seulement une alerte. C'est le même gabarit et non un second :
// l'audit du Lot 13 a compté 75 gabarits dont 23 incapables d'envoyer quoi que
// ce soit ; en ajouter un pour une variante d'affichage, c'est fabriquer le
// 76e. Le payload à une alerte reste accepté tel quel — les appelants
// existants ne changent pas.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import { objetCompose } from "../objet-email";
import type { Locale } from "../../../../prisma/generated/client";

/** Une occurrence : ce qui distingue une alerte des autres du même code. */
interface Occurrence {
  message?: string;
  cibleType?: string;
  cibleId?: string;
  createdAt?: string;
}

interface Payload extends Occurrence {
  niveau: string; // "critique" | "important" | "info"
  code: string;
  titre: string;
  /** Lot 14 — le guichet à qui ce message s'adresse (libellé humain). */
  guichet?: string;
  /** Lot 14 — les occurrences, quand le message en couvre plusieurs. */
  occurrences?: Occurrence[];
  /**
   * Lot 14 — pourquoi le destinataire nominal n'a PAS été servi.
   * 🔴 Il s'affiche dans le corps : un repli silencieux redevient un canal
   * global, et personne ne saurait que l'alerte n'est pas arrivée où il fallait.
   */
  repli?: string;
}

/** Les occurrences, quelle que soit la forme du payload (une ou N). */
function occurrencesDe(p: Payload): Occurrence[] {
  if (Array.isArray(p.occurrences) && p.occurrences.length > 0) return p.occurrences;
  return [{ ...(p.message !== undefined ? { message: p.message } : {}) }].map((o) => ({
    ...o,
    ...(p.cibleType !== undefined ? { cibleType: p.cibleType } : {}),
    ...(p.cibleId !== undefined ? { cibleId: p.cibleId } : {}),
    ...(p.createdAt !== undefined ? { createdAt: p.createdAt } : {}),
  }));
}

export const qualiopiAlerteInterneSubject = (
  _locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const prefix =
    p.niveau === "critique" ? "[CRITIQUE]" : p.niveau === "important" ? "[IMPORTANT]" : "[INFO]";
  const n = occurrencesDe(p).length;
  // 🔴 Le NOMBRE dans l'objet, et dès la deuxième occurrence. Sans lui, dix
  // situations et une situation donnent le même objet : la boîte de réception
  // ne distingue plus « une facture impayée » de « dix factures impayées », et
  // c'est exactement l'information qui décide si on ouvre maintenant ou ce soir.
  const compte = n > 1 ? ` (${n})` : "";
  const pour = p.guichet != null && p.guichet !== "" ? ` — ${p.guichet}` : "";
  // 🔴 87 caractères mesurés avec un titre d'alerte réel (« Facture
  // arrivée à échéance sans règlement »). L'objet est borné comme les autres :
  // interne ne veut pas dire illisible, et c'est la boîte de réception de Will
  // qui le reçoit. Le PRÉFIXE (niveau + compte + guichet) est ce qui trie — il
  // n'est jamais rogné ; c'est le titre qui s'abrège.
  return objetCompose(`${prefix} Alerte Qualiopi${compte} —`, `${p.titre ?? p.code}${pour}`);
};

export function QualiopiAlerteInterneEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const niveauLabel =
    p.niveau === "critique" ? "CRITIQUE" : p.niveau === "important" ? "IMPORTANT" : "INFO";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const alertesHref = `${baseUrl}/fr/admin-dev-x7k2n9/qualiopi/alertes`;
  const occurrences = occurrencesDe(p);
  const titre = p.titre ?? p.code;
  const entete = occurrences.length > 1 ? `${titre} — ${occurrences.length} cas` : titre;

  return (
    <EmailLayout
      famille="C"
      /* Le pré-en-tête recopiait le titre mot pour mot. Il porte désormais ce
         que le titre ne dit pas : le GUICHET concerné et le code technique —
         c'est-à-dire de qui c'est le sujet, et quoi chercher dans la console.
         Sur une alerte interne, c'est ce qui décide de la traiter tout de
         suite ou de la laisser à l'astreinte. */
      preview={
        [
          p.guichet != null && p.guichet !== "" ? `Pour : ${p.guichet}` : "",
          `code ${p.code}`,
          occurrences.length > 1 ? `${occurrences.length} occurrences` : "1 occurrence",
        ]
          .filter(Boolean)
          .join(" · ") + "."
      }
      title={`Alerte ${niveauLabel} — ${entete}`}
      cta={{ label: "Voir les alertes", href: alertesHref }}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        <strong>Code :</strong> {p.code}
        {p.guichet != null && p.guichet !== "" ? ` — pour : ${p.guichet}` : ""}
      </Text>

      {p.repli != null && p.repli !== "" && (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          <strong>Vous recevez ce message par défaut.</strong> {p.repli}
        </Text>
      )}

      {occurrences.map((o, i) => (
        <Text key={`${o.cibleId ?? "sans-cible"}-${i}`} style={emailStyles.paragraphStyle}>
          {occurrences.length > 1 ? `${i + 1}. ` : ""}
          {o.message ?? titre}
          {o.cibleType != null && o.cibleId != null ? ` — ${o.cibleType} / ${o.cibleId}` : ""}
          {o.createdAt != null ? ` — depuis le ${o.createdAt}` : ""}
        </Text>
      ))}
    </EmailLayout>
  );
}
