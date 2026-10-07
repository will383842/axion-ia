// OÙ EN EST UN APPORTEUR, d'un mot — la colonne « Étape » de la liste
// (2026-10-07, demande de Will).
//
// ── Pourquoi ce module existe ─────────────────────────────────────────────
// La liste des apporteurs montrait une colonne « Réponse » : Sans réponse,
// Répondu (N), Échec envoi, Archivé, puis — par-dessus — les badges du suivi de
// l'invitation (Invité, Rappel 1, A répondu, Échange réservé…). Elle disait ce
// qui s'était passé dans la boîte mail, pas OÙ EN EST la personne. Will s'y
// perdait.
//
// L'étape suit le parcours, et rien d'autre :
//
//   Candidat → Lien envoyé → Échange réservé → Échange fait → Retenu →
//   Contrat envoyé le JJ/MM → Dossier signé (à vérifier) →
//   Contrat contresigné le JJ/MM ; ou Non retenu / Absent.
//
// « Lien envoyé » : le lien de réservation de l'échange est parti, la personne
// n'a pas encore réservé. Tout le monde ne le reçoit pas : qui ne l'a jamais
// reçu reste « Candidat », et la RAISON s'affiche en petit dessous quand une
// donnée existante la dit (dossier à compléter, opposition, refus de l'envoi
// automatique) — jamais devinée.
//
// ⚠️ « Candidat » est le mot demandé par Will (2026-10-07). La fiche personne
// (`features/personne/fiche-personne.ts`) s'interdit ce mot côté apporteur
// (anti-requalification) ; il n'apparaît ici que dans la liste de la console.
//
// ── Ce qui n'est PAS lu ici ──────────────────────────────────────────────
// Tout est DÉRIVÉ de données qui existent déjà : le suivi de l'invitation
// (journal des envois + échanges Calendly + issue de l'échange), et le dossier
// du réseau (`ApporteurReseau`). Aucune colonne nouvelle, aucune migration.
//
// Module PUR : aucun import serveur. Il est lu par la liste (serveur) et par le
// passage d'archivage automatique (worker).

import { estApporteur } from "./est-apporteur";
import { etapeDeLaLigne } from "./etape-apporteur";
import { ORIGINE_SAISIE_MANUELLE } from "../contact/accuse-attendu";
import type { SuiviInvitation } from "./relance-invitation";

/**
 * Pourquoi le lien de réservation n'est pas parti — seulement ce qu'une donnée
 * EXISTANTE dit : l'opposition enregistrée, le refus noté par l'envoi
 * automatique (`details.invitationAuto.issue`), ou un dossier pas terminé
 * (l'envoi automatique n'invite que le dossier complet).
 */
export type MotifSansLien =
  | "opposition"
  | "adresse-bloquee"
  | "coordonnees-effacees"
  | "adresse-annonce-tiers"
  | "accord-manquant"
  | "envoi-non-abouti"
  | "dossier-a-completer";

const LIBELLE_MOTIF: Readonly<Record<MotifSansLien, string>> = {
  opposition: "a refusé les messages",
  "adresse-bloquee": "adresse bloquée (désinscription ou adresse en erreur)",
  "coordonnees-effacees": "coordonnées effacées",
  "adresse-annonce-tiers": "adresse relevée sur l'annonce d'un tiers",
  "accord-manquant": "accord de contact manquant",
  "envoi-non-abouti": "envoi automatique non abouti",
  "dossier-a-completer": "dossier à compléter",
};

/** Les issues de l'envoi automatique qui disent POURQUOI rien n'est parti. */
const MOTIF_DE_L_ISSUE: Readonly<Record<string, MotifSansLien>> = {
  retenu: "adresse-bloquee",
  efface: "coordonnees-effacees",
  "origine-interdite": "adresse-annonce-tiers",
  "accord-manquant": "accord-manquant",
};

/** Ces issues ne sont pas un refus : la personne a été (ou va être) invitée. */
const ISSUES_SANS_MOTIF = new Set(["envoyee", "en-validation", "deja-invitee"]);

/** La raison, lue défensivement dans la fiche ; `null` : aucune donnée ne la dit. */
export function motifSansLien(input: {
  readonly details: unknown;
  /** L'adresse figure dans les oppositions (`email_oppositions`). */
  readonly opposee: boolean;
}): MotifSansLien | null {
  if (input.opposee) return "opposition";
  const d =
    input.details && typeof input.details === "object" && !Array.isArray(input.details)
      ? (input.details as Record<string, unknown>)
      : null;
  if (!d) return null;
  const auto = d["invitationAuto"];
  const issue =
    auto && typeof auto === "object" && !Array.isArray(auto)
      ? (auto as Record<string, unknown>)["issue"]
      : undefined;
  if (typeof issue === "string" && !ISSUES_SANS_MOTIF.has(issue)) {
    return MOTIF_DE_L_ISSUE[issue] ?? "envoi-non-abouti";
  }
  // La saisie manuelle n'est jamais invitée automatiquement : c'est Will qui
  // choisit. Aucune raison à afficher.
  if (d["origine"] === ORIGINE_SAISIE_MANUELLE) return null;
  return etapeDeLaLigne(d) === "dossier-complet" ? null : "dossier-a-completer";
}

export function libelleMotifSansLien(m: MotifSansLien): string {
  return LIBELLE_MOTIF[m];
}

/** Le statut du dossier du réseau — miroir de l'énumération `ApporteurReseauStatut`. */
export type StatutDossierApporteur =
  "dossier_en_cours" | "a_verifier" | "a_completer" | "signe" | "refuse" | "resilie";

/** Ce que la liste sait du dossier du réseau d'une personne. */
export interface DossierApporteurResume {
  readonly id: string;
  readonly statut: StatutDossierApporteur;
  readonly signeParSocieteAt: Date | null;
  /**
   * Dernier envoi du lien du dossier (le contrat à signer) : l'e-mail « Retenu »
   * qui le porte, ou le lien envoyé seul. Rappels automatiques exclus.
   */
  readonly contratEnvoyeLe: Date | null;
}

export interface DonneesEtapeSuivi {
  readonly suivi?: SuiviInvitation | null;
  readonly dossier?: DossierApporteurResume | null;
  /** La fiche est classée « sans suite » (`details.sansSuiteAt`). */
  readonly sansSuite?: boolean;
  /** Pourquoi le lien n'est pas parti, s'il n'est pas parti (`motifSansLien`). */
  readonly motifSansLien?: MotifSansLien | null;
}

export type EtapeSuivi =
  | { readonly type: "candidat"; readonly motif: MotifSansLien | null }
  | { readonly type: "lien-envoye"; readonly le: Date; readonly annule: boolean }
  | { readonly type: "echange-reserve"; readonly le: Date | null }
  | { readonly type: "echange-fait"; readonly aRevoir: boolean }
  | { readonly type: "absent" }
  | { readonly type: "retenu" }
  | { readonly type: "contrat-envoye"; readonly le: Date }
  | { readonly type: "dossier-a-completer" }
  | { readonly type: "dossier-signe" }
  | { readonly type: "contrat-contresigne"; readonly le: Date | null }
  | { readonly type: "non-retenu" }
  | { readonly type: "dossier-refuse" }
  | { readonly type: "contrat-termine" }
  | { readonly type: "sans-suite" };

/**
 * L'étape d'une personne. Du plus avancé au moins avancé : le dossier du réseau
 * (il vient APRÈS l'échange), puis l'issue de l'échange, puis l'échange, puis
 * l'invitation.
 */
export function etapeDuSuivi(d: DonneesEtapeSuivi, maintenant: Date): EtapeSuivi {
  const dossier = d.dossier ?? null;
  if (dossier) {
    switch (dossier.statut) {
      case "signe":
        return { type: "contrat-contresigne", le: dossier.signeParSocieteAt };
      case "resilie":
        return { type: "contrat-termine" };
      case "refuse":
        return { type: "dossier-refuse" };
      case "a_verifier":
        return { type: "dossier-signe" };
      case "a_completer":
        return { type: "dossier-a-completer" };
      case "dossier_en_cours":
        return dossier.contratEnvoyeLe
          ? { type: "contrat-envoye", le: dossier.contratEnvoyeLe }
          : { type: "retenu" };
    }
  }

  const s = d.suivi ?? null;
  const decision = s?.decision ?? null;
  if (decision?.type === "non-retenu") return { type: "non-retenu" };
  if (decision?.type === "retenu") return { type: "retenu" };
  if (decision?.type === "absent") return { type: "absent" };
  if (decision?.type === "a-revoir") return { type: "echange-fait", aRevoir: true };

  // Une fiche écartée à la main, sans issue d'échange : elle est close.
  if (d.sansSuite) return { type: "sans-suite" };

  if (s?.echange === "reserve") {
    const le = s.echangeLe ?? null;
    if (le && le.getTime() <= maintenant.getTime()) return { type: "echange-fait", aRevoir: false };
    return { type: "echange-reserve", le };
  }
  if (s?.invitation) {
    return { type: "lien-envoye", le: s.invitation, annule: s.echange === "annule" };
  }
  return { type: "candidat", motif: d.motifSansLien ?? null };
}

/** « 05/10 », heure de Paris. */
function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export function libelleEtapeSuivi(e: EtapeSuivi): string {
  switch (e.type) {
    case "candidat":
      return "Candidat";
    case "lien-envoye":
      return `Lien envoyé le ${jourMois(e.le)}${e.annule ? " · échange annulé" : ""}`;
    case "echange-reserve":
      return e.le ? `Échange réservé le ${jourMois(e.le)}` : "Échange réservé";
    case "echange-fait":
      return e.aRevoir ? "Échange fait · à revoir" : "Échange fait";
    case "absent":
      return "Absent";
    case "retenu":
      return "Retenu";
    case "contrat-envoye":
      return `Contrat envoyé le ${jourMois(e.le)}`;
    case "dossier-a-completer":
      return "Dossier à compléter";
    case "dossier-signe":
      return "Dossier signé (à vérifier)";
    case "contrat-contresigne":
      return e.le ? `Contrat contresigné le ${jourMois(e.le)}` : "Contrat contresigné";
    case "non-retenu":
      return "Non retenu";
    case "dossier-refuse":
      return "Dossier refusé";
    case "contrat-termine":
      return "Contrat terminé";
    case "sans-suite":
      return "Sans suite";
  }
}

export type TonEtape = "neutral" | "info" | "success" | "warning";

/** Le ton du badge : vert quand ça avance, orange quand il faut agir, gris quand c'est clos. */
export function tonEtapeSuivi(e: EtapeSuivi): TonEtape {
  switch (e.type) {
    case "retenu":
    case "contrat-envoye":
    case "contrat-contresigne":
    case "echange-reserve":
      return "success";
    case "dossier-signe":
    case "dossier-a-completer":
    case "absent":
    case "echange-fait":
      return "warning";
    case "lien-envoye":
      return "info";
    case "candidat":
    case "non-retenu":
    case "dossier-refuse":
    case "contrat-termine":
    case "sans-suite":
      return "neutral";
  }
}

/** La précision affichée en petit sous l'étape (la raison d'un « Candidat »), ou `null`. */
export function precisionEtapeSuivi(e: EtapeSuivi): string | null {
  return e.type === "candidat" && e.motif ? LIBELLE_MOTIF[e.motif] : null;
}

/** Un clic sur l'étape ouvre le dossier apporteur s'il existe, sinon la fiche. */
export function lienEtapeSuivi(
  d: DonneesEtapeSuivi,
  liens: { readonly fiche: string; readonly dossier: (id: string) => string },
): string {
  return d.dossier ? liens.dossier(d.dossier.id) : liens.fiche;
}

// ── L'archivage automatique ─────────────────────────────────────────────

export type MotifArchivageAuto = "contrat-contresigne" | "non-retenu";

/** Les deux étapes qui rangent la personne d'elles-mêmes, et elles seules. */
export function motifArchivageAuto(e: EtapeSuivi): MotifArchivageAuto | null {
  if (e.type === "contrat-contresigne") return "contrat-contresigne";
  if (e.type === "non-retenu") return "non-retenu";
  return null;
}

/**
 * La marque posée dans `details` par l'archivage automatique (date ISO).
 *
 * 🔑 « Désarchiver » la laisse en place. C'est elle qui empêche le passage
 * suivant de ré-archiver une fiche que Will a rouverte : sans elle, le passage
 * et Will se renverraient la fiche toutes les 5 minutes.
 *
 * Seul le passage lui-même la retire : quand un « Non retenu » est corrigé en
 * « Retenu », il défait SON archivage (voir `archivage-auto-apporteurs.ts`).
 */
export const MARQUE_ARCHIVAGE_AUTO = "archivageAutoAt";

/** Pourquoi le passage a rangé la ligne (`MotifArchivageAuto`). */
export const MARQUE_ARCHIVAGE_AUTO_MOTIF = "archivageAutoMotif";

/** Le statut de la ligne juste avant l'archivage automatique, pour le retour en arrière. */
export const MARQUE_ARCHIVAGE_AUTO_STATUT = "archivageAutoStatutAvant";

/**
 * Préfixe des identifiants de job des RAPPELS du lien du dossier
 * (`apporteurs-reseau/passage-quotidien.ts`, `PREFIXE_JOB_RAPPEL_DOSSIER`).
 * Recopié ici pour ne pas tirer le passage quotidien dans la liste ; l'égalité
 * est vérifiée par `la-liste-des-apporteurs-dit-l-etape.spec.ts`.
 */
export const PREFIXE_RAPPEL_DOSSIER = "apporteur-dossier-rappel-";

/** Cette ligne peut-elle être archivée automatiquement ? */
export function doitArchiverAutomatiquement(l: {
  readonly archivedAt: Date | null;
  readonly deletedAt: Date | null;
  readonly status: string;
  readonly details: unknown;
}): boolean {
  if (l.archivedAt !== null || l.deletedAt !== null || l.status === "archived") return false;
  if (!estApporteur(l.details)) return false;
  const details = l.details as Record<string, unknown>;
  return details[MARQUE_ARCHIVAGE_AUTO] === undefined;
}
