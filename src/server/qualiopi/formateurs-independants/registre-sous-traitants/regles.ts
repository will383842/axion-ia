/**
 * Qualiopi ind. 27 — les règles PURES du registre des sous-traitants tenu par l'outil
 * pour les formateurs indépendants.
 *
 * - **Qui entre** : un indépendant au contrat-cadre signé, ou actif. Jamais une fiche de
 *   test : le registre est celui que lit l'auditeur.
 * - **Statut** : actif, suspendu (fiche désactivée), sorti (date et motif). Une sortie
 *   est DÉFINITIVE et rien n'est jamais retiré du registre : une fiche qui cesse d'être
 *   éligible y reste, sortie.
 * - **Plan IDEMPOTENT** : rejoué sur son propre résultat, il ne crée ni ne modifie rien.
 *   La raison sociale n'est écrite qu'à la création (corrigeable à la main sur la ligne).
 * - **Pièces et contrôles** : `controles.config.ts`, seule source des contrôles.
 *
 * Aucun import Prisma ni Next : sûr partout (écran, worker, tests).
 */

import {
  addMonths,
  type DocumentConformite,
  type TrainerStatutValue,
} from "@/server/qualiopi/trainers/conformite";

import { FRAICHEUR_CONTROLE_JOURS } from "../controle-regles";
import { LIBELLES_MOTIF_FIN, estMotifFin } from "../fin-collaboration";
import { vigilanceExigible } from "../vigilance-seuil";

import {
  CONTROLES_SOUS_TRAITANCE,
  PIECES_REGISTRE,
  ALERTE_AVANT_ECHEANCE_JOURS,
  type PieceRegistre,
} from "./controles.config";

const JOUR_MS = 24 * 3600 * 1000;

export type StatutRegistre = "actif" | "suspendu" | "sorti";
export type ResultatControle = "conforme" | "non_conforme" | "a_revoir";

/** Ce que la synchronisation lit d'une fiche formateur. */
export interface FaitsFiche {
  readonly trainerId: string;
  readonly prenom: string;
  readonly nom: string;
  readonly statut: TrainerStatutValue;
  readonly actif: boolean;
  readonly estTestInterne: boolean;
  readonly siret: string | null;
  readonly nda: string | null;
  readonly contratSigneAt: Date | null;
  readonly activationValideeAt: Date | null;
  readonly finCollaborationAt: Date | null;
  readonly finCollaborationEffetAt: Date | null;
  readonly finCollaborationMotif: string | null;
  /** Titres des formations sur lesquelles il est habilité (habilitations actives). */
  readonly formations: ReadonlyArray<string>;
  /** Numéro de DA vu sur la liste publique des OF. */
  readonly ndaVerifieListeAt: Date | null;
}

/** Les champs de la ligne du registre GÉNÉRIQUE (`SousTraitant`) tenus par l'outil. */
export interface ChampsGeneriques {
  readonly nom: string;
  readonly siret: string | null;
  readonly nda: string | null;
  readonly objetPrestation: string;
  readonly contratSigneAt: Date | null;
  readonly actif: boolean;
}

export interface StatutAttendu {
  readonly statut: StatutRegistre;
  readonly dateSortie: Date | null;
  readonly motifSortie: string | null;
}

export interface LigneExistante {
  readonly registreId: string;
  readonly trainerId: string;
  readonly sousTraitantId: string;
  readonly statut: StatutRegistre;
  readonly statutDepuis: Date;
  readonly dateSortie: Date | null;
  readonly motifSortie: string | null;
  readonly generique: ChampsGeneriques & { readonly verifieDataGouvAt: Date | null };
}

export type PlanLigne =
  | {
      readonly sorte: "creer";
      readonly trainerId: string;
      readonly libelle: string;
      readonly generique: ChampsGeneriques;
      readonly verifieDataGouvAt: Date | null;
      readonly dateEntree: Date;
      readonly statut: StatutAttendu;
    }
  | {
      readonly sorte: "mettre_a_jour";
      readonly trainerId: string;
      readonly libelle: string;
      readonly registreId: string;
      readonly sousTraitantId: string;
      /** Seuls les champs qui changent ; jamais `nom`. */
      readonly generique: Partial<Omit<ChampsGeneriques, "nom">>;
      /** Une vérification plus récente sur la liste publique, sinon `null`. */
      readonly verifieDataGouvAt: Date | null;
      /** Le nouveau statut s'il change, sinon `null`. */
      readonly statut: StatutAttendu | null;
    }
  | { readonly sorte: "inchange"; readonly trainerId: string; readonly libelle: string };

export function libelleFiche(f: Pick<FaitsFiche, "prenom" | "nom">): string {
  return `${f.prenom} ${f.nom}`.trim();
}

export function estEligible(f: FaitsFiche): boolean {
  return (
    f.statut === "sous_traitant" && !f.estTestInterne && (f.contratSigneAt !== null || f.actif)
  );
}

const MOTIF_CHANGEMENT_DE_NATURE =
  "Changement de nature de la relation : n'est plus formateur indépendant";

function motifFin(motif: string | null): string {
  if (motif === "deces") return "Fin de collaboration — décès";
  if (motif === "changement_de_nature") return MOTIF_CHANGEMENT_DE_NATURE;
  return estMotifFin(motif)
    ? `Fin de collaboration — ${LIBELLES_MOTIF_FIN[motif]}`
    : "Fin de collaboration";
}

/** Le statut au registre. Une sortie déjà inscrite est définitive. */
export function statutAttendu(
  f: FaitsFiche,
  actuel: StatutAttendu | null,
  maintenant: Date,
): StatutAttendu {
  if (actuel?.statut === "sorti") return actuel;
  if (f.finCollaborationAt !== null) {
    return {
      statut: "sorti",
      dateSortie: f.finCollaborationEffetAt ?? f.finCollaborationAt,
      motifSortie: motifFin(f.finCollaborationMotif),
    };
  }
  if (f.statut !== "sous_traitant") {
    return { statut: "sorti", dateSortie: maintenant, motifSortie: MOTIF_CHANGEMENT_DE_NATURE };
  }
  return { statut: f.actif ? "actif" : "suspendu", dateSortie: null, motifSortie: null };
}

export function objetPrestation(formations: ReadonlyArray<string>): string {
  const titres = [...new Set(formations.map((t) => t.trim()).filter((t) => t !== ""))].sort();
  return titres.length === 0
    ? "Animation de formations (formateur indépendant) — aucune habilitation enregistrée"
    : `Animation de formations (formateur indépendant) — habilité sur : ${titres.join(" ; ")}`;
}

function generiqueDe(f: FaitsFiche, statut: StatutAttendu): ChampsGeneriques {
  return {
    nom: libelleFiche(f),
    siret: f.siret,
    nda: f.nda,
    objetPrestation: objetPrestation(f.formations),
    contratSigneAt: f.contratSigneAt,
    actif: statut.statut === "actif",
  };
}

function datesEgales(a: Date | null, b: Date | null): boolean {
  return a === null || b === null ? a === b : a.getTime() === b.getTime();
}

function dateEntree(f: FaitsFiche, maintenant: Date): Date {
  const dates = [f.contratSigneAt, f.activationValideeAt].filter((d): d is Date => d !== null);
  return dates.length === 0 ? maintenant : new Date(Math.min(...dates.map((d) => d.getTime())));
}

/**
 * Le plan : une ligne par fiche éligible OU déjà au registre. Une fiche non éligible et
 * absente du registre n'y figure pas.
 */
export function planifierSynchronisation(
  fiches: ReadonlyArray<FaitsFiche>,
  existants: ReadonlyArray<LigneExistante>,
  maintenant: Date,
): PlanLigne[] {
  const parFormateur = new Map(existants.map((e) => [e.trainerId, e]));
  const plan: PlanLigne[] = [];
  for (const f of fiches) {
    const e = parFormateur.get(f.trainerId);
    const libelle = libelleFiche(f);
    if (e === undefined) {
      if (!estEligible(f)) continue;
      const statut = statutAttendu(f, null, maintenant);
      plan.push({
        sorte: "creer",
        trainerId: f.trainerId,
        libelle,
        generique: generiqueDe(f, statut),
        verifieDataGouvAt: f.ndaVerifieListeAt,
        dateEntree: dateEntree(f, maintenant),
        statut,
      });
      continue;
    }
    const statut = statutAttendu(f, e, maintenant);
    const voulu = generiqueDe(f, statut);
    const g: Partial<Omit<ChampsGeneriques, "nom">> = {
      ...(voulu.siret !== e.generique.siret ? { siret: voulu.siret } : {}),
      ...(voulu.nda !== e.generique.nda ? { nda: voulu.nda } : {}),
      ...(voulu.objetPrestation !== e.generique.objetPrestation
        ? { objetPrestation: voulu.objetPrestation }
        : {}),
      ...(!datesEgales(voulu.contratSigneAt, e.generique.contratSigneAt)
        ? { contratSigneAt: voulu.contratSigneAt }
        : {}),
      ...(voulu.actif !== e.generique.actif ? { actif: voulu.actif } : {}),
    };
    const verif =
      f.ndaVerifieListeAt !== null &&
      (e.generique.verifieDataGouvAt === null ||
        f.ndaVerifieListeAt.getTime() > e.generique.verifieDataGouvAt.getTime())
        ? f.ndaVerifieListeAt
        : null;
    const statutChange =
      statut.statut !== e.statut ||
      !datesEgales(statut.dateSortie, e.dateSortie) ||
      statut.motifSortie !== e.motifSortie;
    if (Object.keys(g).length === 0 && verif === null && !statutChange) {
      plan.push({ sorte: "inchange", trainerId: f.trainerId, libelle });
      continue;
    }
    plan.push({
      sorte: "mettre_a_jour",
      trainerId: f.trainerId,
      libelle,
      registreId: e.registreId,
      sousTraitantId: e.sousTraitantId,
      generique: g,
      verifieDataGouvAt: verif,
      statut: statutChange ? statut : null,
    });
  }
  return plan;
}

// ─── Pièces ─────────────────────────────────────────────────────────────────

export type EtatPieceValeur = "valide" | "a_echeance" | "expiree" | "absente" | "non_exigee";

export interface EtatPiece {
  readonly code: string;
  readonly libelle: string;
  readonly exigee: boolean;
  readonly etat: EtatPieceValeur;
  readonly echeance: Date | null;
  readonly alertesAilleurs: boolean;
}

function exigee(p: PieceRegistre, cumulHtCents: number | null): boolean {
  if (p.exigence === "toujours") return true;
  if (p.exigence === "au_seuil") return vigilanceExigible(cumulHtCents);
  return false;
}

/** La pièce validée la plus récente des types demandés (expirée ou non). */
function derniereValidee(
  docs: ReadonlyArray<DocumentConformite>,
  types: ReadonlyArray<string>,
): DocumentConformite | null {
  const valides = docs.filter((d) => types.includes(d.type) && d.statutValidation === "valide");
  if (valides.length === 0) return null;
  return valides.reduce((m, d) => {
    if (d.dateEmission === null) return m;
    if (m.dateEmission === null) return d;
    return d.dateEmission > m.dateEmission ? d : m;
  });
}

function echeanceDe(p: PieceRegistre, d: DocumentConformite): Date | null | "illisible" {
  if (p.validite.sorte === "date_de_la_piece") return d.dateExpiration;
  // Une attestation sans date d'émission n'est pas probante (`vigilancePerimee`).
  return d.dateEmission === null ? "illisible" : addMonths(d.dateEmission, p.validite.mois);
}

export function etatPieces(
  docs: ReadonlyArray<DocumentConformite>,
  cumulHtCents: number | null,
  maintenant: Date,
): EtatPiece[] {
  const preavis = maintenant.getTime() + ALERTE_AVANT_ECHEANCE_JOURS * JOUR_MS;
  return PIECES_REGISTRE.map((p): EtatPiece => {
    const ex = exigee(p, cumulHtCents);
    const base = {
      code: p.code,
      libelle: p.libelle,
      exigee: ex,
      alertesAilleurs: p.alertesAilleurs,
    };
    const d = derniereValidee(docs, p.types);
    if (d === null) return { ...base, etat: ex ? "absente" : "non_exigee", echeance: null };
    const ech = echeanceDe(p, d);
    if (ech === "illisible") return { ...base, etat: "expiree", echeance: null };
    if (ech === null) return { ...base, etat: "valide", echeance: null };
    if (ech.getTime() <= maintenant.getTime()) return { ...base, etat: "expiree", echeance: ech };
    if (ech.getTime() <= preavis) return { ...base, etat: "a_echeance", echeance: ech };
    return { ...base, etat: "valide", echeance: ech };
  });
}

// ─── Contrôles ──────────────────────────────────────────────────────────────

export interface TraceControle {
  readonly code: string;
  readonly faitAt: Date;
  readonly resultat: ResultatControle;
}

export interface EtatControle {
  readonly code: string;
  readonly libelle: string;
  readonly dernierAt: Date | null;
  readonly echeance: Date | null;
  readonly enRetard: boolean;
}

export interface EntreeControles {
  readonly dateEntree: Date;
  readonly traces: ReadonlyArray<TraceControle>;
  /** Dernier contrôle du registre public inscrit par l'outil (vert ou orange validé). */
  readonly dernierControleRegistreAt: Date | null;
  readonly pieces: ReadonlyArray<EtatPiece>;
}

function plusRecente(dates: ReadonlyArray<Date | null>): Date | null {
  const v = dates.filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));
  return v.length === 0 ? null : new Date(Math.max(...v.map((d) => d.getTime())));
}

function plusProche(dates: ReadonlyArray<Date | null>): Date | null {
  const v = dates.filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));
  return v.length === 0 ? null : new Date(Math.min(...v.map((d) => d.getTime())));
}

export function etatControles(e: EntreeControles, maintenant: Date): EtatControle[] {
  const dernier = (code: string, seulementConforme = false) =>
    plusRecente(
      e.traces
        .filter((t) => t.code === code && (!seulementConforme || t.resultat === "conforme"))
        .map((t) => t.faitAt),
    );
  return CONTROLES_SOUS_TRAITANCE.map((c): EtatControle => {
    const base = { code: c.code, libelle: c.libelle };
    switch (c.quand.sorte) {
      case "a_l_entree": {
        const fait = dernier(c.code, true);
        return {
          ...base,
          dernierAt: fait,
          echeance: fait === null ? e.dateEntree : null,
          enRetard: fait === null && e.dateEntree.getTime() <= maintenant.getTime(),
        };
      }
      case "a_l_echeance_des_pieces":
        // Le retard d'une pièce est porté par ses propres alertes (expirée, J-30).
        return {
          ...base,
          dernierAt: dernier(c.code),
          echeance: plusProche(e.pieces.filter((p) => p.exigee).map((p) => p.echeance)),
          enRetard: false,
        };
      case "fraicheur_du_registre": {
        const fait = plusRecente([e.dernierControleRegistreAt, dernier(c.code)]);
        const echeance =
          fait === null
            ? e.dateEntree
            : new Date(fait.getTime() + FRAICHEUR_CONTROLE_JOURS * JOUR_MS);
        return {
          ...base,
          dernierAt: fait,
          echeance,
          enRetard: echeance.getTime() < maintenant.getTime(),
        };
      }
      case "annuelle": {
        const fait = dernier(c.code);
        const echeance = addMonths(fait ?? e.dateEntree, 12);
        return {
          ...base,
          dernierAt: fait,
          echeance,
          enRetard: echeance.getTime() < maintenant.getTime(),
        };
      }
    }
  });
}

export interface EtatLigne {
  readonly controles: EtatControle[];
  readonly dernierControleAt: Date | null;
  readonly prochaineEcheance: Date | null;
}

export function etatLigneRegistre(e: EntreeControles, maintenant: Date): EtatLigne {
  const controles = etatControles(e, maintenant);
  return {
    controles,
    dernierControleAt: plusRecente(controles.map((c) => c.dernierAt)),
    prochaineEcheance: plusProche([
      ...controles.map((c) => c.echeance),
      ...e.pieces.filter((p) => p.exigee).map((p) => p.echeance),
    ]),
  };
}

// ─── Alertes ────────────────────────────────────────────────────────────────

/**
 * Les trois alertes du registre. Le CODE d'alerte est posé par la règle du moteur
 * (`alertes/regle-registre-sous-traitants.ts`), là où le verrou du catalogue le lit.
 */
export type SorteAlerteRegistre = "piece_expiree" | "piece_a_echeance" | "controle_en_retard";

export interface CandidatAlerteRegistre {
  readonly sorte: SorteAlerteRegistre;
  readonly niveau: "critique" | "important";
  readonly titre: string;
  readonly message: string;
  readonly cibleType: "Trainer";
  readonly cibleId: string;
}

export interface LigneAlertes {
  readonly trainerId: string;
  readonly libelle: string;
  readonly statut: StatutRegistre;
  readonly pieces: ReadonlyArray<EtatPiece>;
  readonly controles: ReadonlyArray<EtatControle>;
}

const jour = (d: Date | null) =>
  d === null ? "date illisible" : d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

/** Une alerte par sorte et par formateur (l'unicité ouverte est `code` + cible). */
export function candidatsAlertesRegistre(
  lignes: ReadonlyArray<LigneAlertes>,
): CandidatAlerteRegistre[] {
  const out: CandidatAlerteRegistre[] = [];
  for (const l of lignes) {
    if (l.statut !== "actif") continue;
    const suivies = l.pieces.filter((p) => p.exigee && !p.alertesAilleurs);
    const expirees = suivies.filter((p) => p.etat === "expiree");
    const proches = suivies.filter((p) => p.etat === "a_echeance");
    const retards = l.controles.filter((c) => c.enRetard);
    if (expirees.length > 0) {
      out.push({
        sorte: "piece_expiree",
        niveau: "critique",
        titre: "Registre des sous-traitants : pièce expirée",
        message: `${l.libelle} : ${expirees.map((p) => `${p.libelle} expirée le ${jour(p.echeance)}`).join(", ")}. La demander avant toute nouvelle mission (indicateur 27).`,
        cibleType: "Trainer",
        cibleId: l.trainerId,
      });
    }
    if (proches.length > 0) {
      out.push({
        sorte: "piece_a_echeance",
        niveau: "important",
        titre: `Registre des sous-traitants : pièce à renouveler sous ${ALERTE_AVANT_ECHEANCE_JOURS} jours`,
        message: `${l.libelle} : ${proches.map((p) => `${p.libelle} jusqu'au ${jour(p.echeance)}`).join(", ")}. En demander le renouvellement.`,
        cibleType: "Trainer",
        cibleId: l.trainerId,
      });
    }
    if (retards.length > 0) {
      out.push({
        sorte: "controle_en_retard",
        niveau: "important",
        titre: "Registre des sous-traitants : contrôle en retard",
        message: `${l.libelle} : ${retards.map((c) => `${c.libelle} (dû le ${jour(c.echeance)})`).join(", ")}. Faire le contrôle puis le tracer au registre.`,
        cibleType: "Trainer",
        cibleId: l.trainerId,
      });
    }
  }
  return out;
}
