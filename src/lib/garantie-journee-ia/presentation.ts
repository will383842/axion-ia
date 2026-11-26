/**
 * Garantie Journée IA — présentation des échéances dans la console. Fonctions PURES.
 *
 * Règle d'affichage (plan 15, §4) : la couleur ne porte JAMAIS seule l'information, chaque niveau
 * a son TEXTE. rouge « Dépassée » / « Aujourd'hui » ; orange ≤ 2 j ; jaune ≤ 5 j ; vert > 5 j ;
 * gris « Clos ». Dates en jours civils « AAAA-MM-JJ » (jour de Paris), jamais l'heure du serveur.
 */
import { joursRestants } from "@/lib/jours-ouvres";
import {
  calculerEcheances,
  demandeHorsDelai,
  estReputeeAcceptee,
  type DonneesGarantie,
  type Echeance,
  type TypeEcheance,
} from "@/lib/garantie-journee-ia/echeances";

export type NiveauEcheance = "rouge" | "orange" | "jaune" | "vert" | "gris";

export interface EtatEcheance {
  niveau: NiveauEcheance;
  /** Texte lu à l'écran, qui double la couleur. */
  texte: string;
  /** Jours calendaires jusqu'à l'échéance (négatif si dépassée) ; null si clos. */
  jours: number | null;
}

/** Jour de Paris au format « AAAA-MM-JJ ». */
export function aujourdhuiParis(maintenant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);
}

/** Une colonne `@db.Date` (minuit UTC) → « AAAA-MM-JJ ». */
export function jourIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** « AAAA-MM-JJ » → « JJ/MM/AAAA » pour l'écran. */
export function jourFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

export function etatEcheance(
  e: Pick<Echeance, "date" | "faite">,
  aujourdhui: string,
): EtatEcheance {
  if (e.faite) return { niveau: "gris", texte: "Clos", jours: null };
  const j = joursRestants(e.date, aujourdhui);
  if (j < 0) {
    return { niveau: "rouge", texte: `Dépassée de ${-j} j`, jours: j };
  }
  if (j === 0) return { niveau: "rouge", texte: "Aujourd'hui", jours: 0 };
  if (j <= 2) return { niveau: "orange", texte: `Dans ${j} j`, jours: j };
  if (j <= 5) return { niveau: "jaune", texte: `Dans ${j} j`, jours: j };
  return { niveau: "vert", texte: `Dans ${j} j`, jours: j };
}

/** Ce qu'il reste à faire, par type d'échéance. */
export const PROCHAINE_ACTION: Readonly<Record<TypeEcheance, string>> = {
  rapport: "Remettre le rapport au client et saisir la date de remise.",
  fin_demande: "Attendre la demande écrite du client ; saisir sa date de réception si elle arrive.",
  reponse:
    "Répondre par écrit au client (rembourser, refuser ou offrir un avoir), puis saisir la décision.",
  virement: "Virer le remboursement, puis saisir la date du virement.",
};

export interface DossierPourListe extends DonneesGarantie {
  id: string;
  clientNom: string;
  archiveLe?: Date | string | null;
}

export interface LigneListe {
  dossierId: string;
  clientNom: string;
  echeance: Echeance;
  etat: EtatEcheance;
  prochaineAction: string;
  /** Demande réputée acceptée : état CALCULÉ, jamais écrit en base. */
  reputeeAcceptee: boolean;
  /** Demande reçue après les 30 jours : badge rouge « Hors délai », décision au cas par cas. */
  horsDelai: boolean;
}

/**
 * Une ligne par échéance OUVERTE, triée par date la plus proche. Les échéances closes ne sont
 * listées que si `inclureClos`. Les dossiers archivés sont toujours exclus (on archive, on ne supprime pas).
 */
export function lignesDeListe(
  dossiers: readonly DossierPourListe[],
  aujourdhui: string,
  inclureClos = false,
): LigneListe[] {
  const lignes: LigneListe[] = [];
  for (const d of dossiers) {
    if (d.archiveLe) continue;
    const reputee = estReputeeAcceptee(d, aujourdhui);
    for (const echeance of calculerEcheances(d, aujourdhui)) {
      if (echeance.faite && !inclureClos) continue;
      lignes.push({
        dossierId: d.id,
        clientNom: d.clientNom,
        echeance,
        etat: etatEcheance(echeance, aujourdhui),
        prochaineAction: echeance.faite ? "—" : PROCHAINE_ACTION[echeance.type],
        reputeeAcceptee: reputee,
        horsDelai: demandeHorsDelai(d),
      });
    }
  }
  return lignes.sort((a, b) =>
    a.echeance.date < b.echeance.date ? -1 : a.echeance.date > b.echeance.date ? 1 : 0,
  );
}
