// L'accusé de réception automatique — AFFICHAGE COMMUN (2026-09-18).
//
// Un seul rendu pour la fiche d'une candidature, la liste et la fiche d'un
// message : les mêmes faits se disent avec les mêmes mots, et les libellés /
// tons viennent de ceux de l'écran « E-mails envoyés » (`statut-libelles.ts`),
// jamais retapés.
//
// Composant SERVEUR (aucun `"use client"`) : il écrit un état déjà lu, sans
// interaction, et n'ajoute rien au JavaScript envoyé au navigateur.
//
// ⚠️ Un accusé automatique n'est PAS une réponse : les phrases le rappellent, et
// « Sans réponse » garde son sens à côté.

import { AdminBadge } from "@/components/admin/ui";
import { TON_STATUT_EMAIL, libelleStatutLigne } from "@/features/admin-emails/statut-libelles";
import type { AccuseReception, EtatAccuse } from "@/server/email/accuse-noyau";
import type { EmailLogStatus } from "../../../../prisma/generated/client";

/** Ce que les écrans affichent : l'accusé, et le cas échéant une absence VOULUE. */
export type AccuseAffiche = AccuseReception & { readonly absenceVoulue?: string | null };

const STATUT_DE_L_ETAT: Record<Exclude<EtatAccuse, "absent">, EmailLogStatus> = {
  envoye: "sent",
  en_attente: "pending",
  echec: "failed",
  rebond: "bounced",
  annule: "cancelled",
};

const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Paris",
});

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Badge : les libellés et tons de l'écran « E-mails envoyés ». */
export function badgeAccuse(a: AccuseAffiche): {
  tone: "success" | "warning" | "destructive" | "neutral";
  libelle: string;
} {
  if (a.etat === "absent") {
    return { tone: "neutral", libelle: a.absenceVoulue ? "Non envoyé (voulu)" : "Introuvable" };
  }
  const statut = STATUT_DE_L_ETAT[a.etat];
  return {
    tone: TON_STATUT_EMAIL[statut],
    libelle: libelleStatutLigne({ status: statut, bounceType: a.rebond }),
  };
}

/** Le libellé compact de la LISTE — une ligne sous le badge de réponse. */
export function libelleCompactAccuse(a: AccuseAffiche): string {
  if (a.etat === "absent") {
    return a.absenceVoulue ? "Pas d’accusé auto. (voulu)" : "Aucun accusé auto. trouvé";
  }
  const le = a.date ? ` le ${DATE_COURTE.format(a.date)}` : "";
  const statut = libelleStatutLigne({ status: STATUT_DE_L_ETAT[a.etat], bounceType: a.rebond });
  return `Accusé auto. : ${statut.toLowerCase()}${le}`;
}

function phraseRebond(a: AccuseAffiche, le: string): string {
  switch (a.rebond) {
    case "hard":
      return `L’accusé de réception automatique a été refusé définitivement par le serveur du destinataire${le} : l’adresse est probablement erronée.`;
    case "soft":
      return `L’accusé de réception automatique a été refusé temporairement par le serveur du destinataire${le} (boîte pleine ou serveur indisponible) : l’adresse n’est pas en cause.`;
    default:
      return `L’accusé de réception automatique a été refusé par le serveur du destinataire${le}.`;
  }
}

/** La phrase complète, NEUTRE — valable pour une candidature comme pour un message. */
export function phraseAccuse(a: AccuseAffiche): string {
  const le = a.date ? ` le ${DATE_LONGUE.format(a.date)}` : "";
  switch (a.etat) {
    case "envoye":
      return a.essais > 1
        ? `L’accusé de réception automatique est parti${le}, au ${a.essais}ᵉ essai : les tentatives précédentes avaient échoué. Ce n’est pas une réponse — la demande reste à traiter tant que personne n’a répondu.`
        : `L’accusé de réception automatique est parti${le}. Ce n’est pas une réponse — la demande reste à traiter tant que personne n’a répondu.`;
    case "en_attente":
      return `L’accusé de réception automatique est en file d’envoi depuis${le} : il n’est pas encore parti.`;
    case "echec":
      return `L’accusé de réception automatique n’est pas parti (échec${le}). Il peut être renvoyé depuis « E-mails envoyés ».`;
    case "rebond":
      return phraseRebond(a, le);
    case "annule":
      return "L’accusé de réception automatique a été annulé avant son départ.";
    case "absent":
      return (
        a.absenceVoulue ??
        "Aucun accusé de réception automatique n’a été trouvé : rien ne dit que la personne a été avertie de la bonne réception de sa demande."
      );
  }
}

/** Un rebond TEMPORAIRE n'est pas une alerte : il ne demande aucun geste. */
function estAlerte(a: AccuseAffiche): boolean {
  return a.etat === "echec" || (a.etat === "rebond" && a.rebond !== "soft");
}

function Corps({ accuse }: { accuse: AccuseAffiche }): React.ReactElement {
  return (
    <>
      {estAlerte(accuse) ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {phraseAccuse(accuse)}
          {accuse.motif ? ` Motif : ${accuse.motif}` : ""}
        </p>
      ) : (
        <p className="text-[length:var(--text-admin-sm)]">
          {phraseAccuse(accuse)}
          {accuse.etat === "rebond" && accuse.motif ? ` Motif : ${accuse.motif}` : ""}
        </p>
      )}
      {accuse.rattachement === "adresse_et_date" ? (
        <p className="admin-meta-small">
          Rattaché par l’adresse et l’heure de dépôt (envoi antérieur au lien direct).
        </p>
      ) : null}
    </>
  );
}

/** Mention compacte pour la colonne « Réponse » d'une liste. */
export function MentionAccuse({ accuse }: { accuse: AccuseAffiche }): React.ReactElement {
  return (
    <span
      className={`admin-meta-small block ${estAlerte(accuse) ? "text-[color:var(--color-admin-danger)]" : ""}`}
      title={accuse.absenceVoulue ?? undefined}
    >
      {libelleCompactAccuse(accuse)}
    </span>
  );
}

/** Entrée d'une frise (fiche d'une candidature). */
export function LigneAccuse({ accuse }: { accuse: AccuseAffiche }): React.ReactElement {
  const badge = badgeAccuse(accuse);
  return (
    <li className="border-border-subtle border-l-2 pl-[var(--space-admin-4)]">
      <div className="flex flex-wrap items-baseline gap-x-[var(--space-admin-3)]">
        <span className="text-[length:var(--text-admin-sm)] font-semibold">
          Accusé de réception automatique
        </span>
        <span className="admin-meta-small">
          {accuse.date ? `${DATE_LONGUE.format(accuse.date)} · ` : ""}Envoi automatique
        </span>
        <AdminBadge tone={badge.tone}>{badge.libelle}</AdminBadge>
      </div>
      <Corps accuse={accuse} />
    </li>
  );
}

/** Bloc de la fiche d'un message. */
export function BlocAccuse({ accuse }: { accuse: AccuseAffiche }): React.ReactElement {
  const badge = badgeAccuse(accuse);
  return (
    <section className="admin-card">
      <div className="flex flex-wrap items-baseline gap-x-[var(--space-admin-3)]">
        <h2 className="admin-h2">Accusé de réception automatique</h2>
        <AdminBadge tone={badge.tone}>{badge.libelle}</AdminBadge>
      </div>
      <Corps accuse={accuse} />
    </section>
  );
}
