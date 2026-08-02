// Email — relance d'une facture impayée (audit certification 2026-07-26, F59).
//
// 🔴 2026-08-02 — ce gabarit était écrit, enregistré, testé… et appelé par AUCUN
// code. Les relances partaient sous le gabarit `facture-envoi` (rédaction d'un
// PREMIER envoi : « veuillez trouver votre facture »), avec pour corps la note
// interne du hub (« Facture X — solde de N € TTC échu le … — relance J30. »).
// C'est désormais LUI que `envoyerRelanceAction` utilise.
//
// ## Validation : elle a lieu EN AMONT, plus dans la corbeille
//
// Ce message ne passe plus par la corbeille de validation (cf. `outbox-policy`).
// La double validation est faite dans la boîte de dialogue du hub : l'admin y
// atteste avoir pointé son relevé bancaire, puis confirme — et l'e-mail part.
// Garer ensuite une seconde fois ferait qu'aucune relance ne partirait jamais.
//
// ## Un gabarit, quatre tons
//
// Le ton suit le palier (`relance-paliers.ts`) : rappel, ferme, mise en demeure,
// avant contentieux. Un seul fichier plutôt que quatre : le squelette du message
// est identique (qui, quelle facture, quel montant, quelle échéance) et seule
// la fermeté change. Quatre copies divergeraient sur le montant ou l'échéance.
//
// Deux cas distincts, et la nuance compte :
//   - facture entière impayée ;
//   - SOLDE impayé après versement partiel — le cas du reste à charge, quand
//     l'OPCO a versé sa part et que l'entreprise n'a pas réglé la sienne.
// Confondre les deux revient à réclamer à un client une somme qu'il a déjà
// partiellement payée. C'est la première chose qu'il vérifiera.
//
// ⚠️ Pénalités : `penalitesLabel` n'est renseigné QUE si le client a le drapeau
// `penalitesRetardActives`. Par défaut, RIEN n'est chiffré dans le corps — les
// mentions légales figurent déjà sur la facture (art. L.441-10) et les répéter
// durcit inutilement une relance. Décision produit explicite du propriétaire.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

/** Miroir de `TonRelance` (relance-paliers.ts) — les templates ne dépendent pas de `src/server`. */
type Ton = "rappel" | "ferme" | "mise_en_demeure" | "avant_contentieux";

interface Payload {
  destinataireNom: string;
  numeroFacture: string;
  /** Reste dû NET, déjà formaté. JAMAIS le TTC total d'une facture entamée. */
  montantDu: string;
  dateEcheance: string;
  joursRetard: number;
  /** Ton de rédaction, dérivé du palier. Défaut : le moins agressif. */
  ton?: Ton;
  /** Vrai si un versement partiel a déjà eu lieu (reste à charge). */
  soldePartiel?: boolean;
  /** Pénalités chiffrées — présent UNIQUEMENT si activées pour ce client. */
  penalitesLabel?: string;
  /** Bloc libre saisi par l'admin avant l'envoi. Facultatif. */
  messagePersonnalise?: string;
  lienFacture?: string;
}

function tonDe(p: Payload): Ton {
  return p.ton ?? "rappel";
}

export const qualiopiRelanceImpayeeSubject = (
  locale: Locale,
  payload: Record<string, unknown>,
): string => {
  const p = payload as unknown as Payload;
  const objet = p.soldePartiel === true ? "Solde de la facture" : "Facture";
  const num = p.numeroFacture ?? "";
  if (locale !== "fr") {
    switch (tonDe(p)) {
      case "mise_en_demeure":
        return `FORMAL NOTICE — invoice ${num} unpaid · Axion-IA`;
      case "avant_contentieux":
        return `Invoice ${num} — final notice before recovery proceedings · Axion-IA`;
      default:
        return `Invoice ${num} — payment overdue · Axion-IA`;
    }
  }
  switch (tonDe(p)) {
    case "ferme":
      return `${objet} ${num} — relance, règlement attendu · Axion-IA`;
    case "mise_en_demeure":
      return `MISE EN DEMEURE — ${objet.toLowerCase()} ${num} impayée · Axion-IA`;
    case "avant_contentieux":
      return `${objet} ${num} — dernier avis avant recouvrement · Axion-IA`;
    default:
      return `${objet} ${num} — échéance dépassée · Axion-IA`;
  }
};

/** Titre du bandeau, par ton. */
function titreDe(ton: Ton, estSolde: boolean): string {
  switch (ton) {
    case "ferme":
      return estSolde ? "Solde de facture toujours en attente" : "Facture toujours impayée";
    case "mise_en_demeure":
      return "Mise en demeure de payer";
    case "avant_contentieux":
      return "Dernier avis avant recouvrement";
    default:
      return estSolde ? "Solde de facture en attente" : "Facture en attente de règlement";
  }
}

export function QualiopiRelanceImpayeeEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const estSolde = p.soldePartiel === true;
  const ton = tonDe(p);
  const intitule = estSolde ? "le solde de la facture" : "la facture";

  return (
    <EmailLayout
      preview={`${estSolde ? "Solde" : "Facture"} ${p.numeroFacture ?? ""} — échéance dépassée`}
      title={titreDe(ton, estSolde)}
      {...(p.lienFacture
        ? { cta: { label: "Consulter la facture", href: p.lienFacture } }
        : { cta: { label: "Nous contacter", href: `${baseUrl}/fr/contact` } })}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>Bonjour {p.destinataireNom},</Text>

      {ton === "rappel" && (
        <Text style={emailStyles.paragraphStyle}>
          Sauf erreur de notre part, {intitule} <strong>{p.numeroFacture}</strong>, d&apos;un
          montant de <strong>{p.montantDu}</strong>, demeure en attente de règlement. Son échéance
          était fixée au {p.dateEcheance}, soit il y a {p.joursRetard} jours.
        </Text>
      )}

      {ton === "ferme" && (
        <Text style={emailStyles.paragraphStyle}>
          Malgré nos précédents messages, {intitule} <strong>{p.numeroFacture}</strong>, d&apos;un
          montant de <strong>{p.montantDu}</strong>, reste impayée. Son échéance était fixée au{" "}
          {p.dateEcheance}, soit un retard de {p.joursRetard} jours. Nous vous remercions de
          procéder au règlement sans délai.
        </Text>
      )}

      {ton === "mise_en_demeure" && (
        <>
          <Text style={emailStyles.paragraphStyle}>
            Par la présente, nous vous mettons en demeure de régler {intitule}{" "}
            <strong>{p.numeroFacture}</strong>, d&apos;un montant de <strong>{p.montantDu}</strong>,
            échue depuis le {p.dateEcheance}, soit {p.joursRetard} jours de retard.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            Le règlement doit nous parvenir sous huit jours à compter de la réception de ce message.
            Cette mise en demeure vous est adressée par courrier électronique et vous sera, le cas
            échéant, confirmée par lettre recommandée avec accusé de réception.
          </Text>
        </>
      )}

      {ton === "avant_contentieux" && (
        <>
          <Text style={emailStyles.paragraphStyle}>
            {intitule.charAt(0).toUpperCase() + intitule.slice(1)}{" "}
            <strong>{p.numeroFacture}</strong>, d&apos;un montant de <strong>{p.montantDu}</strong>,
            demeure impayée {p.joursRetard} jours après son échéance du {p.dateEcheance}, malgré nos
            relances et notre mise en demeure.
          </Text>
          <Text style={emailStyles.paragraphStyle}>
            À défaut de règlement ou d&apos;un accord écrit sur un échéancier dans les huit jours,
            nous confierons le recouvrement de cette créance sans autre avis.
          </Text>
        </>
      )}

      {estSolde && (
        <Text style={emailStyles.paragraphStyle}>
          Un premier versement a bien été enregistré sur cette facture : le montant ci-dessus
          correspond au solde restant dû.
        </Text>
      )}

      {/* Chiffré UNIQUEMENT si les pénalités sont activées pour ce client. */}
      {p.penalitesLabel ? <Text style={emailStyles.paragraphStyle}>{p.penalitesLabel}</Text> : null}

      {/* Bloc libre : ce que l'admin ajoute avant de confirmer l'envoi. */}
      {p.messagePersonnalise ? (
        <Text style={emailStyles.paragraphStyle}>{p.messagePersonnalise}</Text>
      ) : null}

      <Text style={emailStyles.paragraphStyle}>
        Si le règlement a été effectué entre-temps, merci de ne pas tenir compte de ce message. Si
        vous rencontrez une difficulté ou si un élément vous manque pour procéder au paiement,
        répondez simplement à cet email : nous trouverons une solution.
      </Text>
    </EmailLayout>
  );
}
