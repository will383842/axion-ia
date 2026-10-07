/**
 * Réseau d'apporteurs — DÉMARRAGE MANUEL (2026-10-05) : les règles, en fonctions pures.
 *
 * Source : le contrat d'apporteur v2 validé par Williams le 2026-10-05
 * (`_APPORTEURS-DEMARRAGE-2026-10-05/CONTRAT-APPORTEUR-V2.md`, hors dépôt). Les listes
 * fermées viennent d'Axion Partners (statut juridique et professions exclues : PR #727 ;
 * délais : `src/domain/seuils/ssot.ts`), pour que la reprise par Partners soit un import.
 *
 * ⚠️ Module PUR : aucun import serveur. Il est lu par la page publique, la console
 * et les tâches de fond.
 */

import { COMMISSION_CONFERENCE_EUR } from "@/content/pricing";

import {
  LIBELLE_PIECE,
  PIECES_POUR_SIGNER,
  estStatutJuridique,
  sirenValide,
  type TypePiece,
} from "./regles-dossier";

export * from "./regles-dossier";

// ── Délais (contrat v2) ──────────────────────────────────────────────────

/** Art. 3.4 (contrat 2.2) : durée de la protection, à compter de la DÉCLARATION. */
export const PROTECTION_MOIS = 6;
/** Art. 3.4 al. 3 : prolongation unique et automatique. */
export const PROLONGATION_MOIS = 3;
/** Art. 3.4 al. 3 (b) : un échange ou un rendez-vous de la Société dans ces derniers jours. */
export const PROLONGATION_FAITS_RECENTS_JOURS = 30;
/** Art. 3.2 : confirmation réputée acquise, à compter du premier message de la Société. */
export const CONFIRMATION_TACITE_JOURS = 30;
/**
 * Art. 3.2 : sans adresse valide dans ce délai après la déclaration, l'attribution prend fin.
 * Opéré manuellement pendant la période de démarrage (art. 2.8) : non appliqué par le passage quotidien.
 */
export const ADRESSE_VALIDE_JOURS = 45;
/** Art. 4.6 : part du parrain, en points de base, et sa durée depuis la signature du filleul. */
export const PARRAINAGE_BPS = 1000;
export const PARRAINAGE_MOIS = 6;
/** Art. 5.4 et 6.2 (L.8222-1, D.8222-5) : seuil de vigilance, et son approche. */
export const SEUIL_VIGILANCE_CENTS = 500_000;
export const APPROCHE_VIGILANCE_CENTS = 400_000;
export const VIGILANCE_VALIDITE_MOIS = 6;

const JOUR_MS = 86_400_000;

/** Ajoute des mois calendaires, au même quantième (dernier jour du mois si besoin). */
export function ajouterMois(d: Date, mois: number): Date {
  const r = new Date(d.getTime());
  const jour = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + mois);
  const dernier = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(jour, dernier));
  return r;
}

export function ajouterJours(d: Date, jours: number): Date {
  return new Date(d.getTime() + jours * JOUR_MS);
}

// ── Dossier de l'apporteur ───────────────────────────────────────────────

/**
 * Codes NAF des professions dont les règles interdisent de rémunérer un apport de
 * clientèle — liste finale de la juriste de Partners (PR #727), mot pour mot.
 * 86.90C, 86.90F et 75.00Z n'en font volontairement pas partie.
 */
export const NAF_EXCLUS = [
  "69.10Z",
  "86.10Z",
  "86.21Z",
  "86.22A",
  "86.22B",
  "86.22C",
  "86.23Z",
  "86.90A",
  "86.90B",
  "86.90D",
  "86.90E",
  "47.73Z",
] as const;

/** Codes NAF qui exigent une attestation spécifique (REQ-JUR-022 de Partners) : revue humaine. */
export const NAF_A_REVOIR = ["69.20Z", "66.19B", "66.22Z"] as const;

/** « 6920Z », « 69.20z » → « 69.20Z ». */
export function normaliserNaf(naf: string | null | undefined): string | null {
  if (!naf) return null;
  const s = naf.replace(/[\s.]/g, "").toUpperCase();
  if (!/^\d{4}[A-Z]$/.test(s)) return null;
  return `${s.slice(0, 2)}.${s.slice(2)}`;
}

export type RefusAdmission = "siren_inactif" | "siren_etranger" | "profession_exclue";

/**
 * Ce que le registre dit de l'entreprise de l'apporteur suffit-il à l'admettre ?
 * Refus nommés (repris de `jugerAdmission` de Partners) ; une profession « à revoir »
 * n'est pas refusée, elle est signalée à Williams.
 */
export function jugerAdmission(e: {
  active: boolean;
  francaise: boolean;
  naf: string | null;
}): { ok: true; aRevoir: boolean } | { ok: false; motif: RefusAdmission } {
  if (!e.francaise) return { ok: false, motif: "siren_etranger" };
  if (!e.active) return { ok: false, motif: "siren_inactif" };
  const naf = normaliserNaf(e.naf);
  if (naf && (NAF_EXCLUS as readonly string[]).includes(naf)) {
    return { ok: false, motif: "profession_exclue" };
  }
  return { ok: true, aRevoir: !!naf && (NAF_A_REVOIR as readonly string[]).includes(naf) };
}

export const LIBELLE_REFUS_ADMISSION: Readonly<Record<RefusAdmission, string>> = {
  siren_inactif:
    "Ce numéro SIREN correspond à une entreprise qui n'est plus active. Pour facturer vos commissions, il faut une activité en cours (une micro-entreprise se crée gratuitement en ligne).",
  siren_etranger:
    "Le réseau est ouvert aux activités immatriculées en France. Ce numéro ne correspond pas à une entreprise française.",
  profession_exclue:
    "Les règles de votre profession interdisent de percevoir une commission pour un apport de clientèle : nous ne pouvons pas vous proposer ce contrat.",
};

/** Ce qui manque encore pour pouvoir signer. */
export function manquesPourSigner(d: {
  siren: string | null;
  statutJuridique: string | null;
  regimeTva: "franchise_293b" | "assujetti" | null;
  numeroTva: string | null;
  iban: string | null;
  piecesDeposees: readonly TypePiece[];
}): string[] {
  const m: string[] = [];
  // Ordre de Will (07/10) : jamais de contrat sans SIREN valide (risque porté par Axion-IA).
  if (!d.siren || !sirenValide(d.siren)) m.push("votre numéro SIREN");
  if (!estStatutJuridique(d.statutJuridique)) m.push("votre statut");
  if (!d.regimeTva) m.push("votre régime de TVA");
  if (d.regimeTva === "assujetti" && !d.numeroTva) m.push("votre numéro de TVA");
  if (!d.iban) m.push("votre IBAN");
  for (const p of PIECES_POUR_SIGNER) {
    if (!d.piecesDeposees.includes(p)) m.push(LIBELLE_PIECE[p].toLowerCase());
  }
  return m;
}

// ── Protection d'une entreprise présentée ────────────────────────────────

/**
 * Fin de la protection (art. 3.4, contrat 2.2) : six mois à compter de la DÉCLARATION,
 * c'est-à-dire de l'horodatage serveur de son enregistrement (`recueAt`), plus de la confirmation.
 */
export function finDeProtection(declareeAt: Date): Date {
  return ajouterMois(declareeAt, PROTECTION_MOIS);
}

/** Date de la confirmation réputée acquise, si l'entreprise n'a pas répondu (art. 3.2). */
export function dateConfirmationTacite(contactEnvoyeAt: Date): Date {
  return ajouterJours(contactEnvoyeAt, CONFIRMATION_TACITE_JOURS);
}

export type MotifProlongation = "devis_en_cours" | "echange_recent" | "financement_en_cours";

/**
 * Art. 3.4 al. 3 : faut-il prolonger, au terme, et pour quel motif ? Une seule fois.
 * Les trois conditions se lisent dans les données de la Société, jamais dans l'activité
 * de l'apporteur.
 */
export function motifDeProlongation(e: {
  deja: boolean;
  devisEnCours: boolean;
  dernierEchangeAt: Date | null;
  financementEnCours: boolean;
  terme: Date;
}): MotifProlongation | null {
  if (e.deja) return null;
  if (e.devisEnCours) return "devis_en_cours";
  if (
    e.dernierEchangeAt &&
    e.dernierEchangeAt.getTime() <= e.terme.getTime() &&
    e.terme.getTime() - e.dernierEchangeAt.getTime() <= PROLONGATION_FAITS_RECENTS_JOURS * JOUR_MS
  ) {
    return "echange_recent";
  }
  if (e.financementEnCours) return "financement_en_cours";
  return null;
}

export const LIBELLE_PROLONGATION: Readonly<Record<MotifProlongation, string>> = {
  devis_en_cours: "un devis est en cours",
  echange_recent: "un rendez-vous ou un échange a eu lieu récemment",
  financement_en_cours: "un dossier de financement est en cours",
};

/** Une commande signée à cette date est-elle couverte par la protection ? */
export function commandeCouverte(e: {
  signeeAt: Date;
  recueAt: Date;
  confirmee: boolean;
  protegeeJusquAt: Date | null;
}): boolean {
  if (!e.confirmee || !e.protegeeJusquAt) return false;
  return (
    e.signeeAt.getTime() >= e.recueAt.getTime() &&
    e.signeeAt.getTime() <= e.protegeeJusquAt.getTime()
  );
}

// ── Commissions (annexe 1 du contrat v2) ─────────────────────────────────

/** Les paliers de formation de l'annexe 1 : prix public HT et forfait, en centimes. */
export const PALIERS_FORMATION = [
  {
    id: "formation-generale-4h",
    libelle: "Formation générale, 4 heures",
    prixCents: 120_000,
    forfaitCents: 25_000,
  },
  {
    id: "formation-generale-1j",
    libelle: "Formation générale, 1 jour",
    prixCents: 190_000,
    forfaitCents: 50_000,
  },
  {
    id: "formation-generale-2j",
    libelle: "Formation générale, 2 jours",
    prixCents: 360_000,
    forfaitCents: 100_000,
  },
  {
    id: "formation-metier-1j",
    libelle: "Formation par métier, 1 jour",
    prixCents: 190_000,
    forfaitCents: 50_000,
  },
  {
    id: "formation-metier-2j",
    libelle: "Formation par métier, 2 jours",
    prixCents: 360_000,
    forfaitCents: 100_000,
  },
  {
    id: "formation-secteur-1j",
    libelle: "Formation par secteur, 1 jour",
    prixCents: 220_000,
    forfaitCents: 50_000,
  },
  {
    id: "formation-secteur-2j",
    libelle: "Formation par secteur, 2 jours",
    prixCents: 390_000,
    forfaitCents: 100_000,
  },
] as const;
export type PalierFormation = (typeof PALIERS_FORMATION)[number]["id"];

/** Taux de l'annexe 1, en points de base, par activité facturée. */
export const TAUX_BPS = { audit: 3000, implementation: 1500, un_a_un: 3000 } as const;

/**
 * Conférence : un forfait fixe PAR CONFÉRENCE (quel que soit le nombre de participants), sans
 * prorata de remise ; une commande de plusieurs conférences : forfait × nombre de conférences. Source unique : `COMMISSION_CONFERENCE_EUR` (décision du 2026-10-01,
 * publiée sur le site), en centimes.
 */
export const FORFAIT_CONFERENCE_CENTS = COMMISSION_CONFERENCE_EUR * 100;
/** Palier posé sur la ligne d'une conférence. */
export const PALIER_CONFERENCE = "conference";

export type ActiviteCommission =
  "formation" | "un_a_un" | "audit" | "implementation" | "site_web" | "conference";

export type CalculCommission =
  | {
      statut: "calculee";
      montantCents: number;
      palier: string | null;
      prixPublicCents: number | null;
    }
  | { statut: "a_qualifier" }
  | { statut: "aucune" };

/**
 * La commission d'une facture soldée.
 * - formation : forfait × min(1, HT facturé ÷ prix public), arrondi au centime inférieur
 *   (art. 4.1 bis) ; sans palier connu, elle reste « à qualifier », jamais zéro ;
 * - 1-to-1 et coaching 30 %, audit 30 %, intégration 15 % du HT facturé ;
 * - conférence : forfait fixe de 500 € par commande, sans prorata ;
 * - développement web : aucune (annexe 1, A1.5).
 */
export function calculerCommission(e: {
  activite: ActiviteCommission | null;
  factureHtCents: number;
  palier?: string | null;
  /** Formation : nombre de sessions identiques du palier dans la commande (1 par défaut). */
  quantite?: number;
}): CalculCommission {
  if (e.activite === null) return { statut: "a_qualifier" };
  if (e.activite === "site_web") return { statut: "aucune" };
  if (
    e.activite === "conference" ||
    (e.activite === "formation" && e.palier === PALIER_CONFERENCE)
  ) {
    // Forfait fixe par conférence : aucun prorata de remise ; `quantite` = nombre de conférences de
    // la commande. Jamais plus que le prix HT facturé (annexe 1, A1.4 bis) ; une commande vide ou
    // remboursée (HT ≤ 0) ne rapporte rien.
    const ht = Math.max(0, e.factureHtCents);
    return {
      statut: "calculee",
      montantCents: Math.min(FORFAIT_CONFERENCE_CENTS * quantiteSessions(e.quantite), ht),
      palier: PALIER_CONFERENCE,
      prixPublicCents: null,
    };
  }
  if (e.activite === "formation") {
    const p = PALIERS_FORMATION.find((x) => x.id === e.palier);
    if (!p) return { statut: "a_qualifier" };
    const ht = Math.max(0, e.factureHtCents);
    // Le forfait du palier vaut pour UNE session (la durée est déjà dans le palier : 4 h = 250 €,
    // 1 jour = 500 €, 2 jours = 1 000 €). Plusieurs sessions identiques dans la même commande :
    // forfait × nombre de sessions, au prorata du prix si le prix baisse, plafonné au plein tarif.
    const q = quantiteSessions(e.quantite);
    const montant =
      ht >= p.prixCents * q ? p.forfaitCents * q : Math.floor((p.forfaitCents * ht) / p.prixCents);
    return {
      statut: "calculee",
      montantCents: montant,
      palier: p.id,
      prixPublicCents: p.prixCents * q,
    };
  }
  const bps = TAUX_BPS[e.activite];
  return {
    statut: "calculee",
    montantCents: Math.floor((Math.max(0, e.factureHtCents) * bps) / 10_000),
    palier: null,
    prixPublicCents: null,
  };
}

/** Nombre de sessions retenu : entier de 1 à 99 ; toute autre valeur vaut 1. */
export function quantiteSessions(brut: number | undefined): number {
  return typeof brut === "number" && Number.isInteger(brut) && brut >= 1 && brut <= 99 ? brut : 1;
}

/** Part du parrain : 10 % de la commission du filleul, si la commande tombe dans ses 6 mois. */
export function partParrainage(e: {
  commissionFilleulCents: number;
  filleulSigneAt: Date;
  commandeSigneeAt: Date;
}): number {
  const fin = ajouterMois(e.filleulSigneAt, PARRAINAGE_MOIS);
  if (e.commandeSigneeAt.getTime() < e.filleulSigneAt.getTime()) return 0;
  if (e.commandeSigneeAt.getTime() > fin.getTime()) return 0;
  return Math.floor((e.commissionFilleulCents * PARRAINAGE_BPS) / 10_000);
}

/**
 * Vigilance (art. 5.4 et 6.2) : à partir du cumul déjà dû et d'une nouvelle commission,
 * faut-il demander les pièces, et la nouvelle commission doit-elle attendre ?
 */
export function etatVigilance(e: {
  cumulCents: number;
  nouvelleCents: number;
  piecesValides: boolean;
}): { demander: boolean; attendre: boolean } {
  const apres = e.cumulCents + e.nouvelleCents;
  if (e.piecesValides) return { demander: false, attendre: false };
  return {
    demander: apres >= APPROCHE_VIGILANCE_CENTS,
    attendre: apres >= SEUIL_VIGILANCE_CENTS,
  };
}

/** « 1 234,56 € » */
export function euros(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
}
