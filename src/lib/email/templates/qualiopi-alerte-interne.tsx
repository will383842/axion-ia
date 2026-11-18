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
  /**
   * Ce que la cible EST, en toutes lettres — « Session : Prompt engineering,
   * 12/09/2026 » plutôt que « TrainingSession / 0d4e0c8b-… ».
   *
   * ⚠️ FACULTATIF à dessein : les messages déjà en file, produits avant ce lot,
   * ne le portent pas, et le gabarit retombe alors sur l'ancien affichage.
   */
  cibleLibelle?: string;
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
  /**
   * L4f — la rubrique de la console dont l'alerte relève. Seule valeur connue :
   * « apporteurs ». ⚠️ FACULTATIF : un ancien conteneur worker ignore la clé, un
   * job posé avant ce lot ne la porte pas, et le rendu reste alors celui d'avant.
   */
  rubrique?: string;
  /** L4f — page de la console à ouvrir ; ignorée si elle ne commence pas par `apporteurs`. */
  chemin?: string;
}

/** Un chemin d'apporteurs sûr : `apporteurs`, `apporteurs/<id>`, `apporteurs/entreprises`… */
const CHEMIN_APPORTEURS = /^apporteurs(\/[A-Za-z0-9_-]+){0,3}$/;

function cheminApporteurs(p: Payload): string | null {
  if (p.rubrique !== "apporteurs") return null;
  const c = typeof p.chemin === "string" ? p.chemin.replace(/^\/+/, "") : "";
  return CHEMIN_APPORTEURS.test(c) ? c : "apporteurs";
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
  const nature =
    p.rubrique === "apporteurs" || /apporteur/i.test(`${p.code} ${p.guichet ?? ""}`)
      ? "apporteur"
      : "formation";
  return objetCompose(`${prefix} Alerte ${nature}${compte} —`, `${p.titre ?? p.code}${pour}`);
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
  // Lot 2 (2026-09-02) : le préfixe d'administration vient de l'environnement,
  // comme pour la console elle-même (`auth.config.ts`). La valeur codée en dur
  // était celle, PUBLIQUE, du dépôt : en production le bouton menait à un 404.
  const prefixeAdmin = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";
  const cheminAppo = cheminApporteurs(p);
  const alertesHref = `${baseUrl}/fr/${prefixeAdmin}/${cheminAppo ?? "qualiopi/alertes"}`;
  const occurrences = occurrencesDe(p);
  const titre = p.titre ?? p.code;
  const entete = occurrences.length > 1 ? `${titre} — ${occurrences.length} cas` : titre;

  return (
    <EmailLayout
      famille="C"
      /* Le pré-en-tête porte ce que le titre ne dit pas : le GUICHET concerné et
         le nombre d'occurrences. Le code technique n'y figure plus (certains
         codes portent le mot de la certification) ; la console le garde. */
      preview={
        [
          p.guichet != null && p.guichet !== "" ? `Pour : ${p.guichet}` : "",
          occurrences.length > 1 ? `${occurrences.length} occurrences` : "1 occurrence",
        ]
          .filter(Boolean)
          .join(" · ") + "."
      }
      title={`Alerte ${niveauLabel} — ${entete}`}
      cta={{
        label: cheminAppo !== null ? "Ouvrir les apporteurs" : "Voir les alertes",
        href: alertesHref,
      }}
      ctaSecret
      locale={locale}
    >
      {/* Le code technique n'est plus écrit : certains codes portent le mot de
          la certification. Le bouton mène à la console, qui le garde. */}
      {p.guichet != null && p.guichet !== "" && (
        <Text style={emailStyles.paragraphStyle}>Pour : {p.guichet}</Text>
      )}

      {p.repli != null && p.repli !== "" && (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          <strong>Vous recevez ce message par défaut.</strong> {p.repli}
        </Text>
      )}

      {occurrences.map((o, i) => (
        <Text key={`${o.cibleId ?? "sans-cible"}-${i}`} style={emailStyles.paragraphStyle}>
          {occurrences.length > 1 ? `${i + 1}. ` : ""}
          {o.message ?? titre}
          {/*
            🔑 LE LIBELLÉ D'ABORD, l'ancien affichage en repli.

            Ce message portait « — TrainingSession / 0d4e0c8b-3aaa-… ». Sur un
            écran, un UUID coûte un aller-retour ; ici il coûte davantage, car le
            destinataire n'a aucun écran sur lequel cliquer : le message
            annonçait un problème sur une entité qu'il ne nommait pas.

            ⚠️ Le repli n'est pas décoratif : les messages DÉJÀ EN FILE, produits
            avant ce lot, ne portent pas `cibleLibelle`. Les laisser tomber à
            vide effacerait la seule indication qu'ils avaient.
          */}
          {o.cibleLibelle != null && o.cibleLibelle !== ""
            ? ` — ${o.cibleLibelle}`
            : o.cibleType != null && o.cibleId != null
              ? ` — ${o.cibleType} / ${o.cibleId}`
              : ""}
          {o.createdAt != null ? ` — depuis le ${o.createdAt}` : ""}
        </Text>
      ))}
    </EmailLayout>
  );
}
