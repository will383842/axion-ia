/**
 * L'ÉTAPE d'une mission de formateur indépendant (lot L11c, 08 §2.5, 08b §3.3)
 * — fonction PURE, calculée, jamais stockée.
 *
 * La console (page « Missions », pastille, tuile), le moteur
 * (`reevaluerMission`) et les alertes lisent la MÊME fonction : un écran ne
 * peut pas dire « lettre envoyée » pendant que le moteur croit la lettre due.
 *
 * 🔑 Un fait inconnu n'est jamais lu comme « fait » (T1) : client engagé,
 * garde passée, lettre signée ne valent que s'ils sont établis.
 *
 * Module PUR (le worker l'importe).
 */

import type { MissionFormateurStatut } from "../../../../prisma/generated/client";

export interface FaitsEtapeMission {
  readonly statut: MissionFormateurStatut;
  readonly sessionStatut: string;
  readonly dateDebut: Date;
  readonly dateFin: Date;
  /** Le formateur est encore le formateur principal de la session. */
  readonly affecte: boolean;
  /**
   * Au moins une pièce engageante (convention, convention tripartite,
   * contrat) signée par toutes ses parties et non annulée.
   */
  readonly clientEngage: boolean;
  /** Une condition suspensive OPCO est encore en attente. */
  readonly financeurEnAttente: boolean;
  /** Raisons de la garde de mission ; vide = la garde laisse passer. */
  readonly gardeRefus: ReadonlyArray<string>;
  /** La lettre VIVANTE liée à la mission (`lettreMissionId`), ou `null`. */
  readonly lettre: {
    readonly signeeFormateur: boolean;
    readonly signeeAxion: boolean;
    /** Empreinte enregistrée à l'émission ; `null` = inconnue. */
    readonly empreinte: string | null;
  } | null;
  /** Empreinte recalculée sur les faits d'aujourd'hui ; `null` = incalculable. */
  readonly empreinteActuelle: string | null;
}

export type EtapeMission =
  | "proposee"
  | "client_pas_engage"
  | "bloquee"
  | "lettre_due"
  | "lettre_envoyee"
  | "lettre_perimee"
  | "lettre_signee"
  | "confirmee"
  | "en_cours"
  | "realisee"
  /** Refusée, sans réponse, désistée, retirée, expirée, ou plus affecté. */
  | "close";

export type QuiAgit = "vous" | "formateur" | "client" | "rien";

export const ETAPES_MISSION: Readonly<
  Record<EtapeMission, { readonly libelle: string; readonly quiAgit: QuiAgit }>
> = {
  proposee: { libelle: "Proposée, réponse attendue", quiAgit: "formateur" },
  client_pas_engage: { libelle: "Acceptée, le client n'a pas encore signé", quiAgit: "client" },
  bloquee: { libelle: "Acceptée, un élément manque", quiAgit: "vous" },
  lettre_due: { libelle: "Lettre de mission à émettre", quiAgit: "vous" },
  lettre_envoyee: { libelle: "Lettre envoyée, signature attendue", quiAgit: "formateur" },
  lettre_perimee: { libelle: "Lettre à rectifier : les conditions ont changé", quiAgit: "vous" },
  lettre_signee: { libelle: "Lettre signée, à contresigner", quiAgit: "vous" },
  confirmee: { libelle: "Confirmée", quiAgit: "rien" },
  en_cours: { libelle: "En cours", quiAgit: "formateur" },
  realisee: { libelle: "Réalisée", quiAgit: "rien" },
  close: { libelle: "Close", quiAgit: "rien" },
};

const ACCORD: ReadonlySet<MissionFormateurStatut> = new Set(["acceptee", "accord_hors_outil"]);

export function etapeMission(f: FaitsEtapeMission, maintenant: Date): EtapeMission {
  if (f.statut === "en_attente") {
    return f.affecte && f.dateDebut.getTime() > maintenant.getTime() ? "proposee" : "close";
  }
  if (!ACCORD.has(f.statut) || !f.affecte) return "close";
  if (f.sessionStatut === "annulee" || f.sessionStatut === "reportee") return "close";
  if (f.lettre !== null) {
    const perimee =
      f.lettre.empreinte !== null &&
      f.empreinteActuelle !== null &&
      f.lettre.empreinte !== f.empreinteActuelle;
    if (perimee) return "lettre_perimee";
    if (!f.lettre.signeeFormateur) return "lettre_envoyee";
    if (!f.lettre.signeeAxion) return "lettre_signee";
    if (f.dateFin.getTime() <= maintenant.getTime()) return "realisee";
    if (f.dateDebut.getTime() <= maintenant.getTime()) return "en_cours";
    return "confirmee";
  }
  if (!f.clientEngage || f.financeurEnAttente) return "client_pas_engage";
  if (f.gardeRefus.length > 0) return "bloquee";
  return "lettre_due";
}
