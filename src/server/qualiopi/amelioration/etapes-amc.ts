/**
 * 🔴 CHANTIER QNC, LOT L10 — la vie d'une action d'amélioration AXI-AMC (module PUR).
 *
 * Une action s'OUVRE (numéro, origine, constat, action, auteur, date serveur),
 * puis ne vit que par ses ÉTAPES, en ajout seul :
 *
 *   mise_en_oeuvre      responsable ET échéance (« qui » et « pour quand ») ;
 *   realisee            ce qui a été fait (pièce modifiée) — après une mise en œuvre ;
 *   efficacite_verifiee comment l'efficacité a été vérifiée — après la réalisation ;
 *   abandonnee          MOTIF d'abandon obligatoire ;
 *   note                suivi libre, sans changement d'état.
 *
 * Après `efficacite_verifiee` ou `abandonnee`, l'action est close : seules des
 * notes s'ajoutent. Une nouvelle mise en œuvre après la réalisation reste
 * possible (l'efficacité n'est pas au rendez-vous : on replanifie).
 *
 * ⚠️ « Besoin de schéma » : `actions_amelioration_etapes` n'a pas de colonnes
 * `responsable` ni `echeance`. Le serveur les COMPOSE dans le commentaire de la
 * mise en œuvre sous une forme fixe (`composerMiseEnOeuvre`), et ce module est
 * le seul à la relire (`lireMiseEnOeuvre`). Jamais saisie à la main.
 */

import type { ActionAmelioration as ActionPlan } from "@/server/qualiopi/revues/plan-actions";
import { jourParisIso } from "@/server/qualiopi/conformite/indicateurs-registre";

export const ETAPES_AMC = [
  "mise_en_oeuvre",
  "realisee",
  "efficacite_verifiee",
  "abandonnee",
  "note",
] as const;

export type EtapeAmc = (typeof ETAPES_AMC)[number];

export const LIBELLES_ETAPE_AMC: Record<EtapeAmc, string> = {
  mise_en_oeuvre: "Mise en œuvre",
  realisee: "Réalisée",
  efficacite_verifiee: "Efficacité vérifiée",
  abandonnee: "Abandonnée",
  note: "Note de suivi",
};

export const ORIGINES_AMC = [
  "reclamation",
  "incident",
  "appreciation",
  "revue_direction",
  "veille",
  "audit",
  "autre",
] as const;

export type OrigineAmc = (typeof ORIGINES_AMC)[number];

export const LIBELLES_ORIGINE_AMC: Record<OrigineAmc, string> = {
  reclamation: "Réclamation",
  incident: "Incident",
  appreciation: "Appréciation",
  revue_direction: "Revue de direction",
  veille: "Veille",
  audit: "Audit",
  autre: "Autre",
};

/** Motif d'abandon, vérification d'efficacité, réalisation : au moins 10 caractères. */
export const COMMENTAIRE_MIN = 10;

export interface EtapeLue {
  readonly etape: EtapeAmc;
  readonly commentaire: string;
  readonly auteurId: string | null;
  readonly auteurNom?: string;
  readonly creeLe: Date;
}

export interface ActionAmcLue {
  readonly id: string;
  readonly numero: string;
  readonly origine: OrigineAmc;
  readonly constat: string;
  readonly action: string;
  readonly auteurId: string | null;
  readonly auteurNom: string;
  readonly creeLe: Date;
  readonly etapes: ReadonlyArray<EtapeLue>;
}

const ENTETE_MEO = /^Responsable : (.+?) · Échéance : (\d{4}-\d{2}-\d{2})(?: — ([\s\S]*))?$/;

/** Le commentaire d'une mise en œuvre, composé par le serveur. */
export function composerMiseEnOeuvre(e: {
  responsable: string;
  echeance: string;
  commentaire?: string;
}): string {
  const responsable = e.responsable.replace(/\s+/g, " ").trim();
  const reste = (e.commentaire ?? "").trim();
  return `Responsable : ${responsable} · Échéance : ${e.echeance}${reste !== "" ? ` — ${reste}` : ""}`;
}

export function lireMiseEnOeuvre(
  commentaire: string,
): { responsable: string; echeance: string; commentaire: string } | null {
  const m = ENTETE_MEO.exec(commentaire);
  if (m === null) return null;
  return { responsable: m[1] ?? "", echeance: m[2] ?? "", commentaire: (m[3] ?? "").trim() };
}

function jourValide(jour: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return false;
  const d = new Date(`${jour}T12:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === jour;
}

/** Ordonne les étapes par date (l'ordre de la base n'est pas garanti). */
function chronologie(etapes: ReadonlyArray<EtapeLue>): EtapeLue[] {
  return [...etapes].sort((a, b) => a.creeLe.getTime() - b.creeLe.getTime());
}

/** La dernière étape qui change l'état (les notes n'en changent pas). */
export function derniereEtapeDEtat(etapes: ReadonlyArray<EtapeLue>): EtapeLue | null {
  const utiles = chronologie(etapes).filter((e) => e.etape !== "note");
  return utiles.at(-1) ?? null;
}

export function estClose(etapes: ReadonlyArray<EtapeLue>): boolean {
  const d = derniereEtapeDEtat(etapes);
  return d !== null && (d.etape === "efficacite_verifiee" || d.etape === "abandonnee");
}

export interface NouvelleEtape {
  readonly etape: EtapeAmc;
  readonly commentaire: string;
  readonly responsable?: string;
  readonly echeance?: string;
}

/** Pure : le refus d'une étape, en français, ou `null` si elle est recevable. */
export function refusEtape(etapes: ReadonlyArray<EtapeLue>, n: NouvelleEtape): string | null {
  const commentaire = n.commentaire.trim();
  if (n.etape === "note") return commentaire === "" ? "Une note ne peut pas être vide." : null;
  if (estClose(etapes)) {
    return "Cette action est close (efficacité vérifiée ou abandonnée) : seules des notes de suivi s'ajoutent.";
  }
  const derniere = derniereEtapeDEtat(etapes)?.etape ?? null;
  switch (n.etape) {
    case "mise_en_oeuvre":
      if ((n.responsable ?? "").trim() === "") return "Mise en œuvre : désignez un responsable.";
      if (!jourValide(n.echeance ?? "")) return "Mise en œuvre : fixez une échéance valide.";
      return null;
    case "realisee":
      if (derniere !== "mise_en_oeuvre") {
        return "Réalisée : l'action doit d'abord être mise en œuvre (responsable et échéance).";
      }
      return commentaire.length < COMMENTAIRE_MIN
        ? `Réalisée : dites ce qui a été fait et la pièce modifiée (${COMMENTAIRE_MIN} caractères au moins).`
        : null;
    case "efficacite_verifiee":
      if (derniere !== "realisee") return "Efficacité : l'action doit d'abord être réalisée.";
      return commentaire.length < COMMENTAIRE_MIN
        ? `Efficacité : dites comment elle a été vérifiée (${COMMENTAIRE_MIN} caractères au moins).`
        : null;
    case "abandonnee":
      return commentaire.length < COMMENTAIRE_MIN
        ? `Abandon : le motif est obligatoire (${COMMENTAIRE_MIN} caractères au moins).`
        : null;
  }
}

/** Le commentaire à écrire en base pour une étape recevable. */
export function commentaireAEcrire(n: NouvelleEtape): string {
  return n.etape === "mise_en_oeuvre"
    ? composerMiseEnOeuvre({
        responsable: n.responsable ?? "",
        echeance: n.echeance ?? "",
        commentaire: n.commentaire,
      })
    : n.commentaire.trim();
}

/**
 * L'action AXI-AMC lue comme une entrée du plan d'actions, pour le prédicat
 * UNIQUE d'off.32 (`evaluerCouvertureOff32`) : responsable et échéance de la
 * dernière mise en œuvre, statut et date de clôture de la dernière étape d'état.
 */
export function versActionPlan(a: ActionAmcLue): ActionPlan {
  const etapes = chronologie(a.etapes);
  const meo = etapes.filter((e) => e.etape === "mise_en_oeuvre").at(-1);
  const lu = meo !== undefined ? lireMiseEnOeuvre(meo.commentaire) : null;
  const derniere = derniereEtapeDEtat(etapes);
  const statut: ActionPlan["statut"] =
    derniere === null
      ? "a_faire"
      : derniere.etape === "mise_en_oeuvre"
        ? "en_cours"
        : derniere.etape === "abandonnee"
          ? "abandonnee"
          : "faite";
  const clos = statut === "faite" || statut === "abandonnee";
  return {
    action: `${a.numero} — ${a.action}`,
    source: `Registre AXI-AMC · ${LIBELLES_ORIGINE_AMC[a.origine]}`,
    ajouteAt: a.creeLe.toISOString(),
    responsable: lu?.responsable ?? "",
    echeance: lu?.echeance ?? null,
    statut,
    clotureAt: clos && derniere !== null ? jourParisIso(derniere.creeLe) : null,
  };
}

/** Le libellé d'état d'une action, pour l'écran et l'export. */
export function libelleEtat(a: Pick<ActionAmcLue, "etapes">): string {
  const d = derniereEtapeDEtat(a.etapes);
  return d === null ? "Ouverte — à mettre en œuvre" : LIBELLES_ETAPE_AMC[d.etape];
}
