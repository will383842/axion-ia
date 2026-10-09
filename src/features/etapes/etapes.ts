/**
 * LES ÉTAPES D'UNE PERSONNE, d'un mot — dans le vocabulaire de SON monde
 * (Candidatures unifiées L8a, maquette v2 validée le 2026-10-07).
 *
 * Deux fonctions, jamais une étape commune (contrainte juridique,
 * `features/personne/fiche-personne.ts`) :
 *
 *   - `etapeEmploi(statut)`   : Nouvelle → À l'étude → Échange prévu →
 *     Proposition faite → Retenue ; sorties Non retenue, Retirée, Archivée ;
 *   - `etapeApporteur(etape)` : Premier contact → Invitation envoyée →
 *     Échange prévu → Échange fait → Prêt à signer → Signé ; sorties Sans
 *     suite, Absent à l'échange, Contrat terminé.
 *
 * L'étape apporteur n'est PAS recalculée ici : elle part de `etapeDuSuivi`
 * (`lib/commercial-application/etape-suivi-apporteur.ts`, PR #1358), qui lit
 * le suivi de l'invitation, l'issue de l'échange et le dossier du réseau. Ce
 * module ne fait que la DIRE avec les mots du réseau — « Candidat », « Retenu »
 * et « Non retenu » n'y paraissent jamais (garde : `etapes.spec.ts`).
 *
 * 🔑 Le compilateur refuse un statut non traité : chaque table est un
 * `Record<…>` exhaustif sur l'énumération de la base (emploi) ou sur l'union
 * de #1358 (réseau). Un statut ajouté sans libellé casse le typecheck.
 *
 * Module PUR : lu par les listes et les fiches (composants serveur).
 */

import type { JobApplicationStatus } from "../../../prisma/generated/client";
import {
  precisionEtapeSuivi,
  type EtapeSuivi,
} from "@/lib/commercial-application/etape-suivi-apporteur";

export type TonEtape = "neutral" | "info" | "success" | "warning" | "destructive";

export interface Etape {
  /** Le mot de la pastille. */
  readonly libelle: string;
  readonly ton: TonEtape;
  /** Rang dans la barre (0 = première étape) ; `null` pour une sortie. */
  readonly rang: number | null;
  /** Précision en petit sous la pastille (« 09/10 · 10 h », « À revoir »). */
  readonly precision?: string | null;
}

// ── Emploi ──────────────────────────────────────────────────────────────────

export const BARRE_EMPLOI = [
  "Nouvelle",
  "À l'étude",
  "Échange prévu",
  "Proposition faite",
  "Retenue",
] as const;

const ETAPE_EMPLOI: Record<JobApplicationStatus, Etape> = {
  new: { libelle: "Nouvelle", ton: "info", rang: 0 },
  reviewing: { libelle: "À l'étude", ton: "neutral", rang: 1 },
  shortlisted: { libelle: "À l'étude", ton: "neutral", rang: 1, precision: "présélectionnée" },
  interview: { libelle: "Échange prévu", ton: "warning", rang: 2 },
  offer: { libelle: "Proposition faite", ton: "warning", rang: 3 },
  hired: { libelle: "Retenue", ton: "success", rang: 4 },
  rejected: { libelle: "Non retenue", ton: "neutral", rang: null },
  withdrawn: { libelle: "Retirée", ton: "neutral", rang: null },
  archived: { libelle: "Archivée", ton: "neutral", rang: null },
};

export function etapeEmploi(statut: JobApplicationStatus): Etape {
  return ETAPE_EMPLOI[statut];
}

// ── Réseau d'apporteurs ─────────────────────────────────────────────────────

export const BARRE_APPORTEUR = [
  "Premier contact",
  "Invitation envoyée",
  "Échange prévu",
  "Échange fait",
  "Prêt à signer",
  "Signé",
] as const;

/** L'issue de l'échange, dans le vocabulaire du réseau (bloc « Après l'échange »). */
export const LIBELLE_APRES_ECHANGE = {
  retenu: "On poursuit",
  a_revoir: "À revoir",
  non_retenu: "Sans suite",
} as const;

/** « 05/10 », heure de Paris. */
function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

const RANG_PRET_A_SIGNER = 4;

/** Chaque cas de #1358 → une étape du réseau. Exhaustif sur `EtapeSuivi["type"]`. */
const ETAPE_APPORTEUR: {
  readonly [K in EtapeSuivi["type"]]: (e: Extract<EtapeSuivi, { type: K }>) => Etape;
} = {
  candidat: (e) => ({
    libelle: "Premier contact",
    ton: "info",
    rang: 0,
    precision: precisionEtapeSuivi(e),
  }),
  "lien-envoye": (e) => ({
    libelle: "Invitation envoyée",
    ton: "info",
    rang: 1,
    precision: `le ${jourMois(e.le)}${e.annule ? " · échange annulé" : ""}`,
  }),
  "echange-reserve": (e) => ({
    libelle: "Échange prévu",
    ton: "success",
    rang: 2,
    precision: e.le ? jourMois(e.le) : null,
  }),
  "echange-fait": (e) => ({
    libelle: "Échange fait",
    ton: "warning",
    rang: 3,
    precision: e.aRevoir ? LIBELLE_APRES_ECHANGE.a_revoir : null,
  }),
  absent: () => ({ libelle: "Absent à l'échange", ton: "warning", rang: null }),
  retenu: () => ({
    libelle: "Échange fait",
    ton: "success",
    rang: 3,
    precision: LIBELLE_APRES_ECHANGE.retenu,
  }),
  "contrat-envoye": (e) => ({
    libelle: "Prêt à signer",
    ton: "success",
    rang: RANG_PRET_A_SIGNER,
    precision: `contrat envoyé le ${jourMois(e.le)}`,
  }),
  "dossier-a-completer": () => ({
    libelle: "Prêt à signer",
    ton: "warning",
    rang: RANG_PRET_A_SIGNER,
    precision: "dossier à compléter",
  }),
  "dossier-signe": () => ({
    libelle: "Signé",
    ton: "warning",
    rang: 5,
    precision: "à vérifier",
  }),
  "contrat-contresigne": (e) => ({
    libelle: "Signé",
    ton: "success",
    rang: 5,
    precision: e.le ? `contresigné le ${jourMois(e.le)}` : null,
  }),
  "non-retenu": () => ({ libelle: "Sans suite", ton: "neutral", rang: null }),
  "dossier-refuse": () => ({
    libelle: "Sans suite",
    ton: "neutral",
    rang: null,
    precision: "dossier refusé",
  }),
  "contrat-termine": () => ({ libelle: "Contrat terminé", ton: "neutral", rang: null }),
  "sans-suite": () => ({ libelle: "Sans suite", ton: "neutral", rang: null }),
};

/**
 * L'étape d'un futur apporteur, à partir de celle de #1358.
 *
 * `pretASigner` : le geste « Prêt à signer » de la fiche (INT-T22). Il avance
 * la personne jusqu'à cette étape tant qu'elle n'en est pas plus loin — il ne
 * fait jamais reculer un « Signé » et ne recouvre jamais une sortie.
 */
export function etapeApporteur(
  e: EtapeSuivi,
  opts: { readonly pretASigner?: boolean } = {},
): Etape {
  const etape = (ETAPE_APPORTEUR[e.type] as (x: EtapeSuivi) => Etape)(e);
  // Une SORTIE (« Sans suite », « Absent ») n'est jamais recouverte.
  if (opts.pretASigner && etape.rang !== null && etape.rang < RANG_PRET_A_SIGNER) {
    return { libelle: "Prêt à signer", ton: "success", rang: RANG_PRET_A_SIGNER };
  }
  return etape;
}
