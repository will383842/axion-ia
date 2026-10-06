/**
 * Réseau d'apporteurs — données de l'AUTOFACTURE (module PUR : ni Prisma, ni rendu).
 *
 * Le vendeur est l'APPORTEUR, l'acheteur est Axion (inversion décrite dans
 * `qualiopi/remuneration/autofacture-pieces.ts`). Une ligne par commission versée,
 * montants en centimes ; franchise 293 B ou TVA 20 % selon le régime de l'apporteur.
 */

import { ajouterJoursOuvres } from "@/lib/jours-ouvres";
import { PALIERS_FORMATION } from "./regles";
import type { AutofactureData } from "@/server/qualiopi/documents/templates/autofacture-honoraires";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import type { LigneHonoraires } from "@/server/qualiopi/remuneration/autofacture-pieces";
import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";

/** Délai de contestation de l'annexe 2 (art. 2.4) du contrat v2. */
export const DELAI_CONTESTATION_APPORTEUR_JOURS = 30;

export const REFERENCE_MANDAT_APPORTEUR =
  "Mandat de facturation donné par l'apporteur à la Société : annexe 2 du contrat d'apporteur, article 289, I, 2 du code général des impôts.";

export interface CommissionPourAutofacture {
  readonly id: string;
  readonly activite: string;
  readonly palier: string | null;
  readonly parrainage: boolean;
  readonly montantCents: number | null;
  /** Art. 4.1 bis : prix public de la formation et prix réellement facturé (HT), s'ils sont connus. */
  readonly prixPublicHtCents?: number | null;
  readonly factureHtCents?: number | null;
  /** `reprise` : ligne négative (art. 4.5), jamais une commission. */
  readonly statut?: string;
}

export interface ApporteurPourAutofacture {
  readonly nom: string;
  readonly denomination: string | null;
  readonly siren: string | null;
  readonly adresse: string | null;
  readonly regimeTva: "franchise_293b" | "assujetti" | null;
  readonly numeroTva: string | null;
  readonly email: string | null;
}

export function regimeHonorairesApporteur(
  r: ApporteurPourAutofacture["regimeTva"],
): TvaRegimeHonoraires | null {
  if (r === "franchise_293b") return "franchise_293b";
  if (r === "assujetti") return "assujetti_20";
  return null;
}

/** « 1 900,00 € » : toujours deux décimales sur une pièce comptable. */
function eurosHt(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/**
 * Désignation d'une ligne : l'activité, le palier retenu, la part de parrainage, et — par
 * commande — le prix public, le prix facturé (la commission étant le montant de la ligne), pour
 * que la proportionnalité de l'art. 4.1 bis se lise sur la pièce.
 */
export function designationCommission(c: CommissionPourAutofacture, libelleMois: string): string {
  if (c.statut === "reprise")
    return `Reprise sur une commission déjà versée (art. 4.5) — relevé de ${libelleMois}`;
  // Art. 4.6 : aucun montant par filleul. Ni prix facturé, ni prix public, ni palier du filleul.
  if (c.parrainage) return `Commission de parrainage — relevé de ${libelleMois}`;
  // Conférence : forfait fixe par commande, ni palier de formation ni prix public à rappeler.
  if (c.activite === "conference") {
    const prixConf =
      c.factureHtCents != null && c.factureHtCents > 0
        ? ` — prix facturé ${eurosHt(c.factureHtCents)} HT`
        : "";
    return `Commission d'apport — conférence${prixConf} — relevé de ${libelleMois}`;
  }
  const base = `Commission d'apport (${c.activite})`;
  // Plusieurs sessions du même palier : le prix public porté est celui de TOUTES les sessions.
  const paliers = PALIERS_FORMATION.find((p) => p.id === c.palier);
  const sessions =
    paliers && c.prixPublicHtCents != null
      ? Math.round(c.prixPublicHtCents / paliers.prixCents)
      : 1;
  const palier = c.palier
    ? ` — palier ${c.palier}${sessions > 1 ? ` × ${sessions} sessions` : ""}`
    : "";
  const prix =
    c.prixPublicHtCents != null && c.factureHtCents != null
      ? ` — prix public ${eurosHt(c.prixPublicHtCents)} HT, prix facturé ${eurosHt(c.factureHtCents)} HT`
      : c.factureHtCents != null && c.factureHtCents > 0
        ? ` — prix facturé ${eurosHt(c.factureHtCents)} HT`
        : "";
  return `${base}${palier}${prix} — relevé de ${libelleMois}`;
}

export function lignesAutofacture(
  commissions: readonly CommissionPourAutofacture[],
  libelleMois: string,
): LigneHonoraires[] {
  return commissions
    .filter((c) => c.montantCents !== null && c.montantCents !== 0)
    .map((c) => ({
      designation: designationCommission(c, libelleMois),
      montantHtCents: c.montantCents ?? 0,
    }));
}

export function totalHtCents(lignes: readonly LigneHonoraires[]): number {
  return lignes.reduce((s, l) => s + l.montantHtCents, 0);
}

/** Art. 5.3 : virement dans les dix jours ouvrés suivant l'établissement du relevé. */
export const ECHEANCE_JOURS_OUVRES = 10;

export { ajouterJoursOuvres };

function dateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

/** Données du gabarit, ou le motif pour lequel la pièce ne peut pas être établie. */
export function construireDonneesAutofacture(e: {
  numero: string;
  releveLibelle: string;
  dateEmission: Date;
  apporteur: ApporteurPourAutofacture;
  commissions: readonly CommissionPourAutofacture[];
  organisme: OrganismeIdentite;
  totalAttenduCents: number;
}): { ok: true; data: AutofactureData } | { ok: false; motif: string } {
  const regime = regimeHonorairesApporteur(e.apporteur.regimeTva);
  if (!regime) return { ok: false, motif: "régime de TVA de l'apporteur non renseigné" };
  const siren = e.apporteur.siren?.trim();
  const adresse = e.apporteur.adresse?.trim();
  if (!siren || !adresse)
    return { ok: false, motif: "identité de facturation de l'apporteur incomplète" };
  const lignes = lignesAutofacture(e.commissions, e.releveLibelle);
  if (lignes.length === 0) return { ok: false, motif: "aucune commission à facturer" };
  if (totalHtCents(lignes) !== e.totalAttenduCents)
    return { ok: false, motif: "total des lignes différent du total versé" };
  const limite = new Date(
    e.dateEmission.getTime() + DELAI_CONTESTATION_APPORTEUR_JOURS * 86_400_000,
  );
  return {
    ok: true,
    data: {
      numero: e.numero,
      dateEmission: dateFr(e.dateEmission),
      dateEcheance: dateFr(ajouterJoursOuvres(e.dateEmission, ECHEANCE_JOURS_OUVRES)),
      contestationAvant: dateFr(limite),
      periodeLabel: e.releveLibelle,
      sousTraitant: {
        nom: e.apporteur.denomination?.trim() || e.apporteur.nom,
        siret: siren,
        numeroTvaIntracom: e.apporteur.numeroTva,
        adresseProfessionnelle: adresse,
        email: e.apporteur.email,
      },
      identite: e.organisme,
      lignes,
      regimeHonoraires: regime,
      delaiContestationJours: DELAI_CONTESTATION_APPORTEUR_JOURS,
      libelleIdentifiantFournisseur: "SIREN",
      mandatReference: REFERENCE_MANDAT_APPORTEUR,
    },
  };
}
