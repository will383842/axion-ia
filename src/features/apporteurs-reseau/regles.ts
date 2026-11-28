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

import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
import { normaliserNaf } from "@/lib/siret";
import {
  COMMISSION_CONFERENCE_EUR,
  PRICING_CATEGORIES,
  UN_A_UN_RECURRING_TIER,
} from "@/content/pricing";
import { etatSeuilVigilance } from "@/lib/vigilance";

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
 * Art. 3.2 : la Société prend contact avec la personne déclarée dans les 30 jours de
 * l'enregistrement de la déclaration ; À DÉFAUT, le délai de confirmation court à compter de
 * l'expiration de ce délai. Une déclaration jamais contactée est donc réputée confirmée
 * 30 + 30 jours après sa réception (relecture de a1, 2026-10-08 : elle restait « à l'étude »).
 */
export const PRISE_DE_CONTACT_JOURS = 30;
/**
 * Rappel INTERNE (non contractuel) : une déclaration sans réponse de Williams depuis ce nombre
 * de jours lui est signalée, et l'apporteur voit « En attente d'une réponse ». Ce n'est PAS un
 * délai du contrat : aucun texte ne doit le présenter comme tel.
 */
export const RAPPEL_SANS_REPONSE_JOURS = 15;
/**
 * Art. 3.2 : sans adresse valide dans ce délai après la déclaration, l'attribution prend fin.
 * Opéré manuellement pendant la période de démarrage (art. 2.8) : non appliqué par le passage quotidien.
 */
export const ADRESSE_VALIDE_JOURS = 45;
/** Art. 4.6 : part du parrain, en points de base, et sa durée depuis la signature du filleul. */
export const PARRAINAGE_BPS = 1000;
export const PARRAINAGE_MOIS = 6;
/**
 * Art. 5.4 et 6.2 (L.8222-1, D.8222-5) : seuil de vigilance, et son approche. Valeurs
 * COMMUNES aux apporteurs et aux formateurs indépendants (lot G1) : elles vivent dans
 * `lib/vigilance.ts`, et la durée de validité aussi (FAC-5).
 */
export {
  APPROCHE_VIGILANCE_CENTS,
  SEUIL_VIGILANCE_CENTS,
  VIGILANCE_VALIDITE_MOIS,
} from "@/lib/vigilance";

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

const FORMAT_PARIS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  hourCycle: "h23",
});

function composantesParis(t: number): { y: number; m: number; d: number; h: number } {
  const p: Record<string, number> = {};
  for (const x of FORMAT_PARIS.formatToParts(new Date(t))) p[x.type] = Number(x.value);
  return { y: p.year ?? NaN, m: p.month ?? NaN, d: p.day ?? NaN, h: p.hour ?? NaN };
}

/**
 * Fonction UNIQUE de la fin d'un délai en jours calendaires (décision du dirigeant N1,
 * 2026-11-25) : le dernier instant (23:59:59.999, heure de Paris, heure d'été/hiver comprise)
 * du `n`-ième jour calendaire à Paris, le jour de `d` étant le jour 1, quelle que soit l'heure de
 * la saisie. Exemple : 25 nov. 15 h, n = 60 → 23 janv. 23:59:59.999 ; le 24 janv. 00:00 est libre.
 * Date illisible : `Invalid Date`.
 */
export function finDuNiemeJourParis(d: Date, n: number): Date {
  if (!Number.isFinite(d.getTime())) return new Date(NaN);
  const { y, m, d: j } = composantesParis(d.getTime());
  const minuit = new Date(Date.UTC(y, m - 1, j + n)); // minuit Paris après le n-ième jour (jour 1 = jour de d), en « heure murale »
  // Les changements d'heure ont lieu à 2 h/3 h, jamais à minuit : un seul des deux décalages tombe juste.
  for (const decalageH of [1, 2]) {
    const t = minuit.getTime() - decalageH * 3_600_000;
    const c = composantesParis(t);
    if (
      c.h === 0 &&
      c.d === minuit.getUTCDate() &&
      c.m === minuit.getUTCMonth() + 1 &&
      c.y === minuit.getUTCFullYear()
    )
      return new Date(t - 1);
  }
  return new Date(NaN);
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

/** « 6920Z », « 69.20z » → « 69.20Z » (validateur neutre, FAC-5). */
export { normaliserNaf };

export type RefusAdmission =
  "siren_inactif" | "siren_etranger" | "profession_exclue" | "siren_de_la_societe";

/**
 * Ce que le registre dit de l'entreprise de l'apporteur suffit-il à l'admettre ?
 * Refus nommés (repris de `jugerAdmission` de Partners) ; une profession « à revoir »
 * n'est pas refusée, elle est signalée à Williams.
 */
export function jugerAdmission(e: {
  active: boolean;
  francaise: boolean;
  naf: string | null;
  siren?: string | null;
}): { ok: true; aRevoir: boolean } | { ok: false; motif: RefusAdmission } {
  // Analyse du 09/10 (point 3) : un contrat d'apporteur ne se conclut jamais avec AXION IA elle-même.
  if (e.siren && e.siren.replace(/\s+/g, "") === IDENTITE_LEGALE.siren)
    return { ok: false, motif: "siren_de_la_societe" };
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
  siren_de_la_societe:
    "Ce numéro est celui d'Axion-IA : indiquez le numéro SIRET de votre propre activité.",
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

/**
 * Art. 3.2 : confirmation réputée acquise d'une déclaration que la Société n'a PAS contactée dans
 * ses 30 jours : le délai de 30 jours court à compter de l'expiration du premier.
 */
export function dateConfirmationTaciteSansContact(recueAt: Date): Date {
  return ajouterJours(recueAt, PRISE_DE_CONTACT_JOURS + CONFIRMATION_TACITE_JOURS);
}

/**
 * Art. 3.2 + 2.8 (relecture de a1, 08/10) : un contact envoyé EN RETARD (après J+30) ne repousse
 * pas l'échéance — le délai de confirmation court dès l'expiration des 30 jours de prise de
 * contact. Échéance = la plus proche de « contact + 30 j » et « déclaration + 60 j ».
 * Ex. : déclaration le 1/10, contact le 15/11 → confirmée le 30/11, pas le 15/12.
 */
export function dateConfirmationTaciteAvecContact(contactEnvoyeAt: Date, recueAt: Date): Date {
  const parContact = dateConfirmationTacite(contactEnvoyeAt);
  const plafond = dateConfirmationTaciteSansContact(recueAt);
  return parContact.getTime() <= plafond.getTime() ? parContact : plafond;
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

/**
 * Une commande signée à cette date est-elle couverte par la protection ?
 *
 * `reservation` (facultatif, règle par rendez-vous, cf. `regle-attribution.ts`) : une présentation
 * au statut `reservee`, pas encore confirmée, couvre la commande de la saisie au terme de sa
 * réservation provisoire, bornes incluses. Sans ce champ, le résultat est celui d'avant.
 *
 * ⚠️ Une présentation confirmée est jugée sur sa SEULE protection, et tout autre statut
 * (`terminee`, `dementie`, `deja_connue`, `hors_champ`) n'est jamais couvert par la réservation :
 * la résiliation coupe le droit en ramenant `protegeeJusquAt` à sa date (`resiliation.ts`, art.
 * 12.3), la réservation ne doit pas le rouvrir.
 */
export function commandeCouverte(e: {
  signeeAt: Date;
  recueAt: Date;
  confirmee: boolean;
  protegeeJusquAt: Date | null;
  reservation?: { reserveeJusquAt: Date; statut: string } | null;
  /**
   * Date d'émission du devis (`sentAt ?? createdAt`, la plus ancienne de la chaîne de remplacement).
   * Facultatif, lu par la SEULE branche réservation : un devis émis AVANT la saisie ne couvre pas
   * la commande (il n'est pas le fruit de la présentation). La protection et la commission n'y
   * touchent pas.
   */
  devisEmisAt?: Date | null;
}): boolean {
  const signee = e.signeeAt.getTime();
  const apresLaSaisie = signee >= e.recueAt.getTime();
  if (e.confirmee && e.protegeeJusquAt && apresLaSaisie && signee <= e.protegeeJusquAt.getTime())
    return true;
  if (e.reservation && e.reservation.statut === "reservee" && !e.confirmee) {
    if (e.devisEmisAt && e.devisEmisAt.getTime() < e.recueAt.getTime()) return false;
    return apresLaSaisie && signee <= e.reservation.reserveeJusquAt.getTime();
  }
  return false;
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

/**
 * Formation de 3 jours ou plus (décision du dirigeant du 27/11/2026, Q1) : la règle dépend de la
 * grille du contrat SIGNÉ.
 * - Grille v3 (contrat 2.8, ou avenant 2.8 signé) : **1 000 € HT au plus**, réduit au prorata en
 *   cas de remise (art. 4.1 bis).
 * - Grille v2 (contrats 2.3 à 2.6 sans avenant) : le plafond de 1 000 € NE S'APPLIQUE PAS. Annexe 1
 *   du contrat 2.6, A1.1 : « Forfait de 500 € HT par journée de formation vendue, au prix public,
 *   réduit au prorata en cas de remise » et « cinq journées de formation générale vendues 9 500 € HT
 *   (au prix public) donnent 5 × 500 € = 2 500 € ; vendues 8 550 € HT (remise de 10 %), elles donnent
 *   2 500 € × 8 550 ÷ 9 500 = 2 250 €. Aucune limite n'est fixée au nombre de journées. » Donc 3 jours
 *   au prix de base = 1 500 €.
 * Ces formations sont « sur devis » : le prix de référence est le nombre de journées × le prix public
 * d'une journée de la même famille (méthode de l'exemple ci-dessus). Hors de `PALIERS_FORMATION` : la
 * grille publique ne change pas. Sur ces paliers, la quantité est le NOMBRE DE JOURNÉES (3 au moins).
 */
export const FORFAIT_JOURNEE_FORMATION_V2_CENTS = 50_000;
export const PLAFOND_FORMATION_LONGUE_CENTS = 100_000;
export const JOURNEES_MIN_FORMATION_LONGUE = 3;
export const PALIERS_FORMATION_LONGUE = [
  {
    id: "formation-generale-3j-plus",
    libelle: "Formation générale, 3 jours ou plus",
    prixJourCents: 190_000,
  },
  {
    id: "formation-metier-3j-plus",
    libelle: "Formation par métier, 3 jours ou plus",
    prixJourCents: 190_000,
  },
  {
    id: "formation-secteur-3j-plus",
    libelle: "Formation par secteur, 3 jours ou plus",
    prixJourCents: 220_000,
  },
] as const;

/** Libellé d'un palier de formation (y compris 3 jours ou plus) ; `null` s'il est inconnu. */
export function libellePalierFormation(id: string | null | undefined): string | null {
  return (
    PALIERS_FORMATION.find((p) => p.id === id)?.libelle ??
    PALIERS_FORMATION_LONGUE.find((p) => p.id === id)?.libelle ??
    null
  );
}

/** Palier de formation connu (grille publique ou 3 jours ou plus) ? */
export function estPalierFormation(id: string | null | undefined): boolean {
  return libellePalierFormation(id) !== null;
}

/**
 * Commission d'une formation de 3 jours ou plus : v3 = 1 000 € × min(1, HT ÷ référence) ;
 * v2 = 500 € × journées × min(1, HT ÷ référence), sans plafond (annexe 1 du contrat 2.6, A1.1).
 */
function commissionFormationLongue(
  p: (typeof PALIERS_FORMATION_LONGUE)[number],
  htCents: number,
  journees: number | undefined,
  grille: GrilleCommission,
): CalculCommission {
  if (
    typeof journees !== "number" ||
    !Number.isInteger(journees) ||
    journees < JOURNEES_MIN_FORMATION_LONGUE ||
    journees > 99
  )
    return { statut: "a_qualifier" };
  const reference = p.prixJourCents * journees;
  const ht = Math.max(0, htCents);
  const pleinCents =
    grille === "v2"
      ? FORFAIT_JOURNEE_FORMATION_V2_CENTS * journees
      : PLAFOND_FORMATION_LONGUE_CENTS;
  return {
    statut: "calculee",
    montantCents: ht >= reference ? pleinCents : Math.round((pleinCents * ht) / reference),
    palier: p.id,
    prixPublicCents: reference,
  };
}

// ── Grille selon la version du contrat signé (décision du dirigeant du 27/11/2026) ─────────

/**
 * Les deux grilles de l'annexe 1 : « v2 » = contrats 2.3, 2.4, 2.5 et 2.6 (annexes identiques,
 * lues dans l'historique de `contrat-v2.ts`) ; « v3 » = contrat 2.8. La 2.7 n'a jamais existé.
 */
export type GrilleCommission = "v2" | "v3";

/** Versions signées dont la grille est connue. Toute autre version : inconnue → escalade. */
export const GRILLE_DE_LA_VERSION: Readonly<Record<string, GrilleCommission>> = Object.freeze({
  "2.3": "v2",
  "2.4": "v2",
  "2.5": "v2",
  "2.6": "v2",
  "2.8": "v3",
});

/** Message d'escalade : jamais un 0 € silencieux quand la version signée est inconnue. */
export const MESSAGE_GRILLE_INCONNUE =
  "Version du contrat signé inconnue : aucune grille ne s'applique d'office. Calcul à faire à la main, selon le contrat signé par l'apporteur.";

/**
 * La grille d'une commande (pur).
 * 1. Avenant 2.8 en vigueur (`avenant28EffetAt`), entreprise déclarée ET commande signée à partir de
 *    sa date d'effet → v3 (art. 13.5 : les déclarations antérieures gardent leur grille ; art. 4.1 :
 *    grille acceptée à la signature de la commande).
 * 2. Sinon, la version inscrite dans la signature de l'apporteur (`signatureApporteur.version`).
 * 3. `null` = inconnue (version absente, illisible, antérieure à la 2.3, 2.7, future) : ESCALADE.
 *
 * `avenant28EffetAt` : la date d'effet viendra de la table de l'avenant (lot S1) ; d'ici là, `null`.
 */
export function grilleDeLaCommande(e: {
  signature: unknown;
  declareeAt: Date;
  commandeSigneeAt: Date;
  avenant28EffetAt: Date | null;
}): GrilleCommission | null {
  const effet = e.avenant28EffetAt?.getTime();
  if (
    effet !== undefined &&
    Number.isFinite(effet) &&
    e.declareeAt.getTime() >= effet &&
    e.commandeSigneeAt.getTime() >= effet
  )
    return "v3";
  if (!e.signature || typeof e.signature !== "object" || Array.isArray(e.signature)) return null;
  if (!Object.hasOwn(e.signature, "version")) return null;
  const v = (e.signature as { version?: unknown }).version;
  if (typeof v !== "string" || !Object.hasOwn(GRILLE_DE_LA_VERSION, v)) return null;
  return GRILLE_DE_LA_VERSION[v] ?? null;
}

/**
 * Développement web (A1.5 du contrat 2.8) : commissionné seulement pour une commande signée à partir
 * de cette date (4.1 : une nouvelle grille ne vaut que pour les ventes signées après son entrée en
 * vigueur ; jamais de commission rétroactive sur les ventes passées). Recalée le 26/11/2026, date de
 * fusion prévue du contrat 2.8 (`CONTRAT_VERSION`) ; à recaler encore si la fusion glisse.
 */
export const DEVELOPPEMENT_WEB_COMMISSIONNE_DEPUIS = new Date(
  "2026-11-25T23:00:00Z",
); /* 26/11/2026 00:00, heure de Paris */

/**
 * Conférence : plus de commission pour une commande signée à partir de cette date (même date d'effet
 * que le développement web, décision du pilote du 26/11). Une conférence commandée AVANT garde le
 * forfait de l'ancien contrat.
 */
export const CONFERENCE_SANS_COMMISSION_DEPUIS = DEVELOPPEMENT_WEB_COMMISSIONNE_DEPUIS;

/** Taux de l'annexe 1, en points de base, par activité facturée. */
/** ⚠️ `un_a_un` reste 30 % ICI (grille affichée, contrat 2.6, pricing.ts) ; le CALCUL ne le paie plus (aucune commission, décision du 25/11 ; contrat 2.8, A1.3). */
export const TAUX_BPS = {
  audit: 3000,
  implementation: 1500,
  un_a_un: 3000,
  /** A1.5 (contrat 2.8) : tout développement effectué pour l'entreprise, 15 % du HT facturé. */
  site_web: 1500,
} as const;

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

/**
 * Journée IA (annexe 1, A1.1, grille v3) : prix de référence et forfait, en centimes. Une
 * Journée IA se repère par `devis.journee_ia`, jamais par une valeur d'énumération.
 */
export const PRIX_REFERENCE_JOURNEE_IA_CENTS = 149_000;
export const FORFAIT_JOURNEE_IA_CENTS = 50_000;
/** Palier posé sur la ligne de commission d'une Journée IA. */
export const PALIER_JOURNEE_IA = "journee-ia";

/**
 * Commission d'une commande de Journées IA : 500 € par journée facturée, au prorata du prix
 * payé (art. 4.1 bis : forfait × net HT ÷ prix de référence, jamais plus que le forfait),
 * arrondie au centime le plus proche. `netHtCents` = base de la commission (net après avoirs :
 * avoir total → 0, avoir partiel → prorata). `journees` = journées facturées de la commande.
 * Un acompte ne donne jamais rien : la fonction ne reçoit que des commandes soldées.
 */
export function commissionJourneeIaCents(netHtCents: number, journees?: number): number {
  const q = quantiteSessions(journees);
  const net = Math.max(0, netHtCents);
  if (net >= PRIX_REFERENCE_JOURNEE_IA_CENTS * q) return FORFAIT_JOURNEE_IA_CENTS * q;
  return Math.round((FORFAIT_JOURNEE_IA_CENTS * net) / PRIX_REFERENCE_JOURNEE_IA_CENTS);
}

/** Une ligne de devis est-elle une Journée IA ? Repère du catalogue, sinon libellé (jamais une demi-journée). */
function estLigneJourneeIa(l: Record<string, unknown>): boolean {
  const code = [l.offreCode, l.offreTierId].some(
    (v) => typeof v === "string" && /journee-ia/i.test(v),
  );
  const d = typeof l.designation === "string" ? l.designation : "";
  return code || (/journ[ée]e/i.test(d) && /\bIA\b/i.test(d) && !/demi/i.test(d));
}

/**
 * Lecture des lignes d'un devis marqué Journée IA : nombre de journées (quantités entières
 * positives), présence d'autres lignes, et ambiguïté (quantité non entière). Pur.
 */
export function analyserLignesJourneeIa(lignes: unknown): {
  journees: number;
  autresLignes: boolean;
  ambigue: boolean;
} {
  let journees = 0;
  let autresLignes = false;
  let ambigue = false;
  if (!Array.isArray(lignes)) return { journees: 0, autresLignes: false, ambigue: true };
  for (const l of lignes) {
    if (!l || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    if (!estLigneJourneeIa(o)) {
      autresLignes = true;
      continue;
    }
    if (typeof o.quantite === "number" && Number.isInteger(o.quantite) && o.quantite > 0)
      journees += o.quantite;
    else ambigue = true;
  }
  return { journees, autresLignes, ambigue };
}

/**
 * Commission d'une commande dont le devis est marqué Journée IA (A1.1). Elle ne se calcule seule
 * que si la commande est UNIQUEMENT des Journées IA, lisibles, d'une activité de facturation
 * ordinaire ; dans tous les autres cas (autres lignes, quantité illisible, case cochée sur une
 * facture de site web, de coaching, de conférence ou non classée) elle reste « à qualifier » :
 * un humain tranche, jamais un montant silencieux.
 */
export function calculerCommissionJourneeIa(e: {
  activite: ActiviteCommission | null;
  lignes: unknown;
  netHtCents: number;
}): CalculCommission {
  const a = analyserLignesJourneeIa(e.lignes);
  const ordinaire =
    e.activite === "formation" || e.activite === "audit" || e.activite === "implementation";
  if (a.journees < 1 || a.autresLignes || a.ambigue || !ordinaire) return { statut: "a_qualifier" };
  return {
    statut: "calculee",
    montantCents: commissionJourneeIaCents(e.netHtCents, a.journees),
    palier: PALIER_JOURNEE_IA,
    prixPublicCents: PRIX_REFERENCE_JOURNEE_IA_CENTS * a.journees,
  };
}

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
 * - formation : forfait × min(1, HT facturé ÷ prix public), arrondi au centime le plus proche
 *   (décision du 25/11 ; art. 4.1 bis) ; sans palier connu, elle reste « à qualifier », jamais zéro ;
 * - coaching « one to one » : aucune ; audit 30 %, intégration 15 % du HT, arrondi au centime le plus proche ;
 * - conférence : aucune commission (contrat 2.8) pour une commande signée à partir du 26/11/2026 ;
 *   avant, forfait de l'ancien contrat ;
 * - développement web : 15 % du HT facturé (annexe 1, A1.5 du contrat 2.8).
 *
 * ⚠️ C'est la grille v3 (contrat 2.8) SEULE. Pour une commande d'apporteur, appeler
 * `calculerCommissionSelonGrille` : un signataire 2.6 sans avenant garde sa grille (27/11).
 */
export function calculerCommission(e: {
  activite: ActiviteCommission | null;
  factureHtCents: number;
  palier?: string | null;
  /** Formation : nombre de sessions identiques du palier dans la commande (1 par défaut). */
  quantite?: number;
  /** Date de signature de la commande : une conférence signée avant l'entrée en vigueur garde le forfait. */
  signeeAt?: Date | null;
}): CalculCommission {
  if (e.activite === null) return { statut: "a_qualifier" };
  // Coaching « one to one » (décision du 25/11, A1.3) : aucune commission.
  if (e.activite === "un_a_un") return { statut: "aucune" };
  // Conférence (contrat 2.8, décision de Will) : 0 €, aucune ligne, aucune part de parrain.
  if (
    e.activite === "conference" ||
    (e.activite === "formation" && e.palier === PALIER_CONFERENCE)
  ) {
    // Commande signée avant la date d'effet : forfait de l'ancien contrat, plafonné au HT facturé.
    if (e.signeeAt && e.signeeAt < CONFERENCE_SANS_COMMISSION_DEPUIS) {
      const ht = Math.max(0, e.factureHtCents);
      return {
        statut: "calculee",
        montantCents: Math.min(FORFAIT_CONFERENCE_CENTS * quantiteSessions(e.quantite), ht),
        palier: PALIER_CONFERENCE,
        prixPublicCents: null,
      };
    }
    return { statut: "aucune" };
  }
  if (e.activite === "formation") {
    const longue = PALIERS_FORMATION_LONGUE.find((x) => x.id === e.palier);
    if (longue) return commissionFormationLongue(longue, e.factureHtCents, e.quantite, "v3");
    const p = PALIERS_FORMATION.find((x) => x.id === e.palier);
    if (!p) return { statut: "a_qualifier" };
    const ht = Math.max(0, e.factureHtCents);
    // Le forfait du palier vaut pour UNE session (la durée est déjà dans le palier : 4 h = 250 €,
    // 1 jour = 500 €, 2 jours = 1 000 €). Plusieurs sessions identiques dans la même commande :
    // forfait × nombre de sessions, au prorata du prix si le prix baisse, plafonné au plein tarif.
    const q = quantiteSessions(e.quantite);
    const montant =
      ht >= p.prixCents * q ? p.forfaitCents * q : Math.round((p.forfaitCents * ht) / p.prixCents);
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
    montantCents: Math.round((Math.max(0, e.factureHtCents) * bps) / 10_000),
    palier: null,
    prixPublicCents: null,
  };
}

/**
 * La commission d'une facture soldée selon la GRILLE de la commande (`grilleDeLaCommande`) — c'est
 * la fonction à appeler pour toute commande d'un apporteur (passage quotidien, console).
 * - v3 (contrat 2.8) : `calculerCommission`, inchangé ;
 * - v2 (contrats 2.3 à 2.6, annexe 1 « version 2 ») : coaching 30 % du HT (A1.2), conférence 500 € par
 *   conférence sans prorata et jamais plus que le HT (A1.4 bis), développement web aucune (A1.5) ;
 *   formations de 3 jours ou plus : 500 € par journée au prorata, SANS plafond (A1.1 du 2.6) ;
 *   autres formations, audit et intégration identiques à la v3. Le plafond de 1 000 € est v3 seul.
 */
export function calculerCommissionSelonGrille(
  e: Parameters<typeof calculerCommission>[0] & { grille: GrilleCommission },
): CalculCommission {
  if (e.grille === "v3") return calculerCommission(e);
  if (e.activite === "un_a_un")
    return {
      statut: "calculee",
      montantCents: Math.round((Math.max(0, e.factureHtCents) * TAUX_BPS.un_a_un) / 10_000),
      palier: null,
      prixPublicCents: null,
    };
  if (e.activite === "conference" || (e.activite === "formation" && e.palier === PALIER_CONFERENCE))
    return {
      statut: "calculee",
      montantCents: Math.min(
        FORFAIT_CONFERENCE_CENTS * quantiteSessions(e.quantite),
        Math.max(0, e.factureHtCents),
      ),
      palier: PALIER_CONFERENCE,
      prixPublicCents: null,
    };
  if (e.activite === "site_web") return { statut: "aucune" };
  if (e.activite === "formation") {
    const longue = PALIERS_FORMATION_LONGUE.find((x) => x.id === e.palier);
    if (longue) return commissionFormationLongue(longue, e.factureHtCents, e.quantite, "v2");
  }
  // Autres formations, audit, intégration : même calcul ; `signeeAt` ne joue que pour la v3.
  return calculerCommission({ ...e, signeeAt: null });
}

/**
 * Codes de la « règle appliquée » (relevé mensuel, plan § 5.3) : liste FERMÉE, posée au calcul sur
 * `CommissionApporteur.regleAppliquee`, jamais recalculée ensuite. `formation_3j_plus` est réservé
 * et volontairement absent tant que la question Q7 n'est pas tranchée.
 */
export const CODES_REGLE_APPLIQUEE = [
  "forfait_palier",
  "prorata_remise",
  "forfait_sessions",
  "taux_ht",
  "plafond_base",
  "parrainage_10",
  "tarif_avant_date_effet",
  "journee_ia",
  "prime_challenge",
] as const;
export type RegleAppliquee = (typeof CODES_REGLE_APPLIQUEE)[number];

/**
 * `calculerCommission` + le code de la règle qui a produit le montant. Le calcul rendu est EXACTEMENT
 * celui de `calculerCommission` (aucun montant ne change) ; `regle` vaut `null` quand rien n'est calculé.
 */
export function calculerCommissionAvecRegle(e: Parameters<typeof calculerCommission>[0]): {
  calcul: CalculCommission;
  regle: RegleAppliquee | null;
} {
  const calcul = calculerCommission(e);
  if (calcul.statut !== "calculee") return { calcul, regle: null };
  if (e.activite === "conference" || e.palier === PALIER_CONFERENCE)
    return { calcul, regle: "tarif_avant_date_effet" };
  if (e.activite !== "formation") return { calcul, regle: "taux_ht" };
  const p = PALIERS_FORMATION.find((x) => x.id === e.palier);
  if (!p) return { calcul, regle: null };
  const q = quantiteSessions(e.quantite);
  if (Math.max(0, e.factureHtCents) < p.prixCents * q) return { calcul, regle: "prorata_remise" };
  return { calcul, regle: q > 1 ? "forfait_sessions" : "forfait_palier" };
}

/**
 * Code de règle après le plafond de base : `plafond_base` seulement si le montant vient d'un
 * pourcentage de la base (`taux_ht`) ET que le plafond a réduit cette base. Un forfait (palier,
 * conférence d'avant la date d'effet, remise au prorata…) garde son code : le plafond ne change pas
 * son montant. `null` reste `null`. Pur.
 */
export function regleApresPlafond(
  regle: RegleAppliquee | null,
  baseAvantPlafond: number,
  plafondBase: number,
): RegleAppliquee | null {
  if (regle === "taux_ht" && plafondBase < baseAvantPlafond) return "plafond_base";
  return regle;
}

/**
 * Version du contrat signée par l'apporteur (« 2.6 », « 2.8 »…), lue dans `signatureApporteur`.
 * `null` si absente ou illisible : rien n'est inventé.
 */
export function versionContratSignee(signature: unknown): string | null {
  if (!signature || typeof signature !== "object" || Array.isArray(signature)) return null;
  const v = (signature as { version?: unknown }).version;
  return typeof v === "string" && /^\d{1,3}\.\d{1,3}$/.test(v) ? v : null;
}

/**
 * `calculerCommissionSelonGrille` + le code de la règle (relevé mensuel, lot R). Le calcul rendu est
 * EXACTEMENT celui de `calculerCommissionSelonGrille` (aucun montant ne change). v3 : codes de
 * `calculerCommissionAvecRegle` ; v2 : coaching au taux, conférence au forfait, formation longue au
 * forfait ou au prorata, le reste comme la v3.
 */
export function calculerCommissionSelonGrilleAvecRegle(
  e: Parameters<typeof calculerCommission>[0] & { grille: GrilleCommission },
): { calcul: CalculCommission; regle: RegleAppliquee | null } {
  if (e.grille === "v3") return calculerCommissionAvecRegle(e);
  const calcul = calculerCommissionSelonGrille(e);
  if (calcul.statut !== "calculee") return { calcul, regle: null };
  if (e.activite === "un_a_un") return { calcul, regle: "taux_ht" };
  if (e.activite === "conference" || (e.activite === "formation" && e.palier === PALIER_CONFERENCE))
    return { calcul, regle: "tarif_avant_date_effet" };
  const longue = PALIERS_FORMATION_LONGUE.find((x) => x.id === e.palier);
  if (e.activite === "formation" && longue) {
    const journees = typeof e.quantite === "number" ? e.quantite : 0;
    const complet = Math.max(0, e.factureHtCents) >= longue.prixJourCents * journees;
    return { calcul, regle: complet ? "forfait_palier" : "prorata_remise" };
  }
  return calculerCommissionAvecRegle({ ...e, signeeAt: null });
}

/**
 * Lignes d'abonnement, de maintenance, d'hébergement, de licence, de support, de TMA ou
 * d'infogérance portées par un devis (règle de Will : aucune commission sur les abonnements, la
 * maintenance ni le coaching ; seule la mise en service donne 15 %). Pur (#2464, point 16).
 *
 * Repère PRINCIPAL : le CATALOGUE des offres. Les seuls champs produit qu'une ligne de devis
 * stocke sont `offreCode` et `offreTierId` (`devis-edition-lignes.ts`, `vers-payload.ts`) ; la
 * colonne est MIXTE (d'anciennes lignes rangent le code dans `offreTierId`). Une ligne dont l'un
 * des deux désigne un palier récurrent du catalogue (`recurrenceFr` : maintenance, coaching
 * régulier) est récurrente, quelle que soit sa désignation (« Forfait mensuel »). La désignation
 * (regex) n'est qu'un FILET en dernier recours : elle ne retire jamais un palier du catalogue.
 */
const MOTS_RECURRENTS =
  "maintenance|abonnement|h[ée]bergement|licence|support\\s+(?:mensuel|r[ée]current|annuel)|tma(?![\\p{L}\\d])|infog[ée]rance|tierce\\s+maintenance";
const LIGNE_RECURRENTE = new RegExp(`(?<![\\p{L}\\d])(?:${MOTS_RECURRENTS})`, "iu");

/** Les identifiants de palier du catalogue (`pricing.ts`) qui se facturent à la période. */
export const TIERS_RECURRENTS: ReadonlySet<string> = new Set(
  [...Object.values(PRICING_CATEGORIES).flat(), UN_A_UN_RECURRING_TIER]
    .filter((t) => !!t.recurrenceFr)
    .map((t) => t.id.toLowerCase()),
);

function ligneRecurrente(o: Record<string, unknown>): boolean {
  for (const champ of ["offreTierId", "offreCode"]) {
    const v = o[champ];
    if (typeof v === "string" && TIERS_RECURRENTS.has(v.trim().toLowerCase())) return true;
  }
  const d = typeof o.designation === "string" ? o.designation : "";
  return LIGNE_RECURRENTE.test(d);
}

export function htLignesRecurrentesCents(lignes: unknown): number {
  if (!Array.isArray(lignes)) return 0;
  let total = 0;
  for (const l of lignes) {
    if (!l || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    if (!ligneRecurrente(o)) continue;
    // Quantité 0 ou négative (option non retenue) : la ligne ne pèse rien ; illisible : 1.
    const q = typeof o.quantite === "number" ? Math.max(0, o.quantite) : 1;
    const pu = typeof o.prixUnitaireHtCents === "number" ? o.prixUnitaireHtCents : 0;
    total += Math.abs(Math.round(q * pu));
  }
  return Math.max(0, total);
}

/**
 * Lignes récurrentes RESTANTES d'une commande : le MINIMUM entre (a) celles du devis (ou de la facture)
 * et (b) celles des factures actives de la commande moins la part récurrente rendue par les avoirs
 * actifs. (b) évite qu'une facture refaite après un avoir total, ou une facture complémentaire de
 * maintenance, ne laisse la maintenance déduite deux fois du net (le net la contient déjà une fois
 * de moins). Sans `lignesDesFacturesActives`, seul (a) moins les avoirs s'applique. Un avoir à ligne
 * générique (« avoir partiel ») ne se rattache à aucune ligne : prudence, il réduit la base. Jamais
 * négatif. Pur.
 */
export function htLignesRecurrentesRestantesCents(
  lignesCommande: unknown,
  lignesDesAvoirsActifs: readonly unknown[],
  lignesDesFacturesActives?: readonly unknown[],
): number {
  const rendu = lignesDesAvoirsActifs.reduce<number>((s, l) => s + htLignesRecurrentesCents(l), 0);
  const duDevis = Math.max(0, htLignesRecurrentesCents(lignesCommande) - rendu);
  // Factures sans lignes détaillées (ligne unique, JSON vide) : on ne sait rien de leur récurrent,
  // le plafond ne s'applique pas (prudence : la maintenance du devis reste retirée de la base).
  if (
    !lignesDesFacturesActives ||
    !lignesDesFacturesActives.some((l) => Array.isArray(l) && l.length > 0)
  )
    return duDevis;
  const facture = lignesDesFacturesActives.reduce<number>(
    (s, l) => s + htLignesRecurrentesCents(l),
    0,
  );
  const duDevisBrut = htLignesRecurrentesCents(lignesCommande);
  // Les factures ne portent pas toute la maintenance du devis (acomptes à ligne unique, facture libre
  // « selon devis ») : leur détail ne prouve rien, la maintenance du devis reste retirée.
  if (facture < duDevisBrut) return duDevis;
  return Math.min(duDevisBrut, Math.max(0, facture - rendu));
}

/**
 * PLAFOND STRICT de la base commissionnable d'une commande (décision du pilote 26/11) : total HT du
 * devis (à défaut, de la facture) moins le récurrent BRUT (maintenance, abonnement, hébergement,
 * licence). Quelle que soit la façon dont les factures sont détaillées, la base ne le dépasse
 * jamais. Total inconnu : aucun plafond (Infinity). Jamais négatif. Pur.
 */
export function plafondBaseCommissionnableCents(
  totalHtCents: number | null | undefined,
  lignesCommande: unknown,
  journeeIa = false,
): number {
  if (typeof totalHtCents !== "number" || !Number.isFinite(totalHtCents))
    return Number.POSITIVE_INFINITY;
  const brut = journeeIa ? 0 : htLignesRecurrentesCents(lignesCommande);
  return Math.max(0, totalHtCents - brut);
}

/** Base commissionnable : le net HT moins les lignes récurrentes du devis (jamais négatif). */
export function baseHorsLignesRecurrentes(netHtCents: number, lignes: unknown): number {
  return Math.max(0, netHtCents - htLignesRecurrentesCents(lignes));
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
  return Math.round((e.commissionFilleulCents * PARRAINAGE_BPS) / 10_000);
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
  return etatSeuilVigilance(e);
}

/** « 1 234,56 € » */
export function euros(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
}
