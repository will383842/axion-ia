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

// ── Délais (contrat v2) ──────────────────────────────────────────────────

/** Art. 3.4 : durée de la protection, à compter de la confirmation. */
export const PROTECTION_MOIS = 6;
/** Art. 3.4 al. 3 : prolongation unique et automatique. */
export const PROLONGATION_MOIS = 3;
/** Art. 3.4 al. 3 (b) : un échange ou un rendez-vous de la Société dans ces derniers jours. */
export const PROLONGATION_FAITS_RECENTS_JOURS = 30;
/** Art. 3.2 : confirmation réputée acquise, à compter du premier message de la Société. */
export const CONFIRMATION_TACITE_JOURS = 30;
/** Art. 3.2 : sans adresse valide dans ce délai après la déclaration, l'attribution prend fin. */
export const ADRESSE_VALIDE_JOURS = 45;
/** Art. 3.4 al. 2 : sans rendez-vous, devis ni commande dans ce délai après la première réponse. */
export const PEREMPTION_JOURS = 90;
/** Art. 4.6 : part du parrain, en points de base, et sa durée depuis la signature du filleul. */
export const PARRAINAGE_BPS = 1000;
export const PARRAINAGE_MOIS = 6;
/** Art. 5.1 : seuil d'émission d'un relevé (hors janvier et dernier relevé), en centimes. */
export const SEUIL_RELEVE_CENTS = 5_000;
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

/** Liste fermée de Partners (`StatutJuridique`, PR #727), avec ses libellés. */
export const STATUTS_JURIDIQUES = [
  { valeur: "micro_entrepreneur", libelle: "Micro-entrepreneur (auto-entrepreneur)" },
  { valeur: "entrepreneur_individuel", libelle: "Entrepreneur individuel (hors micro)" },
  { valeur: "eurl", libelle: "EURL" },
  { valeur: "sarl", libelle: "SARL" },
  { valeur: "sasu", libelle: "SASU" },
  { valeur: "sas", libelle: "SAS" },
  { valeur: "sa", libelle: "SA" },
  { valeur: "snc", libelle: "SNC" },
] as const;
export type StatutJuridique = (typeof STATUTS_JURIDIQUES)[number]["valeur"];

export function estStatutJuridique(v: unknown): v is StatutJuridique {
  return STATUTS_JURIDIQUES.some((s) => s.valeur === v);
}

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

/** Les déclarations que l'apporteur coche avant de signer (contrat v2). */
export const DECLARATIONS = [
  {
    cle: "residence_fiscale_france",
    texte: "Ma résidence fiscale est en France.",
  },
  {
    cle: "aucune_clause_contraire",
    texte:
      "Aucune clause de non-concurrence ou d'exclusivité, ni aucune règle professionnelle ne m'interdit cette activité (art. 23).",
  },
  {
    cle: "aucun_lien_societe",
    texte: "Je ne suis ni salarié ni associé d'Axion-IA.",
  },
  {
    cle: "pas_de_travail_dissimule",
    texte: "Je n'ai recours à aucun travail dissimulé (art. 6.6).",
  },
] as const;

/** Les clauses qui exigent une acceptation distincte dans le contrat. */
export const ACCEPTATIONS = [
  { cle: "art_3_7", texte: "J'accepte l'article 3.7 (sincérité des présentations)." },
  {
    cle: "art_4_5",
    texte: "J'accepte l'article 4.5 (reprise d'une commission en cas de remboursement).",
  },
  {
    cle: "art_5_2",
    texte:
      "Je donne mandat à Axion-IA d'établir mes factures de commission (art. 5.2 et annexe 2).",
  },
  { cle: "art_7", texte: "J'accepte l'article 7 (données personnelles)." },
  { cle: "art_12", texte: "J'accepte l'article 12 (effets de la fin du contrat)." },
  {
    cle: "art_14",
    texte:
      "J'accepte l'article 14 : en cas de litige entre commerçants, les tribunaux du siège d'Axion-IA sont seuls compétents.",
  },
] as const;

/** Pièces : celles qu'il faut pour signer, et l'assurance, facultative. */
export const PIECES_POUR_SIGNER = ["identite", "rib"] as const;
export const PIECES_FACULTATIVES = ["rc_pro"] as const;
export const PIECES_VIGILANCE = ["vigilance", "immatriculation"] as const;
export type TypePiece = "identite" | "rib" | "rc_pro" | "vigilance" | "immatriculation";

export const LIBELLE_PIECE: Readonly<Record<TypePiece, string>> = {
  identite: "Pièce d'identité",
  rib: "RIB",
  rc_pro: "Attestation d'assurance RC pro",
  vigilance: "Attestation URSSAF de vigilance",
  immatriculation: "Extrait d'immatriculation (Kbis ou extrait RNE)",
};

export const AIDE_PIECE: Readonly<Record<TypePiece, string>> = {
  identite: "Carte d'identité ou passeport. Supprimée dès qu'elle est vérifiée.",
  rib: "À votre nom ou à celui de votre société.",
  rc_pro: "Facultatif : seulement si vous en avez une.",
  vigilance: "Gratuite, à télécharger dans votre espace URSSAF. Moins de 6 mois.",
  immatriculation: "Gratuit sur data.inpi.fr.",
};

export const MOTIFS_A_RETRANSMETTRE = [
  { valeur: "illisible", libelle: "illisible" },
  { valeur: "perimee", libelle: "périmé" },
  { valeur: "mauvais_nom", libelle: "pas au bon nom" },
  { valeur: "incomplete", libelle: "incomplet" },
  { valeur: "autre", libelle: "à remplacer" },
] as const;
export type MotifARetransmettre = (typeof MOTIFS_A_RETRANSMETTRE)[number]["valeur"];

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
  if (!d.siren) m.push("votre numéro SIREN");
  if (!estStatutJuridique(d.statutJuridique)) m.push("votre statut");
  if (!d.regimeTva) m.push("votre régime de TVA");
  if (d.regimeTva === "assujetti" && !d.numeroTva) m.push("votre numéro de TVA");
  if (!d.iban) m.push("votre IBAN");
  for (const p of PIECES_POUR_SIGNER) {
    if (!d.piecesDeposees.includes(p)) m.push(LIBELLE_PIECE[p].toLowerCase());
  }
  return m;
}

/** IBAN : forme et clé de contrôle (ISO 13616, modulo 97). */
export function ibanValide(brut: string): boolean {
  const s = brut.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const r = s.slice(4) + s.slice(0, 4);
  let reste = 0;
  for (const c of r) {
    const v = c >= "A" && c <= "Z" ? (c.charCodeAt(0) - 55).toString() : c;
    for (const ch of v) reste = (reste * 10 + Number(ch)) % 97;
  }
  return reste === 1;
}

/** SIREN : 9 chiffres et clé de Luhn. */
export function sirenValide(brut: string): boolean {
  const s = brut.replace(/\s+/g, "");
  if (!/^\d{9}$/.test(s)) return false;
  let somme = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(s[8 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}

// ── Protection d'une entreprise présentée ────────────────────────────────

/** Fin de la protection à partir de la confirmation (art. 3.4 al. 1). */
export function finDeProtection(confirmeeAt: Date): Date {
  return ajouterMois(confirmeeAt, PROTECTION_MOIS);
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

export type ActiviteCommission = "formation" | "un_a_un" | "audit" | "implementation" | "site_web";

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
 * - développement web : aucune (annexe 1, A1.5).
 */
export function calculerCommission(e: {
  activite: ActiviteCommission | null;
  factureHtCents: number;
  palier?: string | null;
}): CalculCommission {
  if (e.activite === null) return { statut: "a_qualifier" };
  if (e.activite === "site_web") return { statut: "aucune" };
  if (e.activite === "formation") {
    const p = PALIERS_FORMATION.find((x) => x.id === e.palier);
    if (!p) return { statut: "a_qualifier" };
    const ht = Math.max(0, e.factureHtCents);
    const montant =
      ht >= p.prixCents ? p.forfaitCents : Math.floor((p.forfaitCents * ht) / p.prixCents);
    return {
      statut: "calculee",
      montantCents: montant,
      palier: p.id,
      prixPublicCents: p.prixCents,
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

/** Un relevé est-il émis ce mois-ci (art. 5.1 et 5.3) ? */
export function releveEmis(e: { soldeCents: number; mois: number; dernier: boolean }): boolean {
  if (e.soldeCents <= 0) return false;
  if (e.mois === 1 || e.dernier) return true;
  return e.soldeCents >= SEUIL_RELEVE_CENTS;
}

/** « 1 234,56 € » */
export function euros(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
}
