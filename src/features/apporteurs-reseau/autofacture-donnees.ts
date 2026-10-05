/**
 * Réseau d'apporteurs — données de l'AUTOFACTURE (module PUR : ni Prisma, ni rendu).
 *
 * Le vendeur est l'APPORTEUR, l'acheteur est Axion (inversion décrite dans
 * `qualiopi/remuneration/autofacture-pieces.ts`). Une ligne par commission versée,
 * montants en centimes ; franchise 293 B ou TVA 20 % selon le régime de l'apporteur.
 */

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

/** Désignation d'une ligne : l'activité, le palier retenu, la part de parrainage. */
export function designationCommission(c: CommissionPourAutofacture, libelleMois: string): string {
  const base = c.parrainage ? "Commission de parrainage" : `Commission d'apport (${c.activite})`;
  const palier = c.palier ? ` — palier ${c.palier}` : "";
  return `${base}${palier} — relevé de ${libelleMois}`;
}

export function lignesAutofacture(
  commissions: readonly CommissionPourAutofacture[],
  libelleMois: string,
): LigneHonoraires[] {
  return commissions
    .filter((c) => c.montantCents !== null && c.montantCents > 0)
    .map((c) => ({
      designation: designationCommission(c, libelleMois),
      montantHtCents: c.montantCents ?? 0,
    }));
}

export function totalHtCents(lignes: readonly LigneHonoraires[]): number {
  return lignes.reduce((s, l) => s + l.montantHtCents, 0);
}

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
      dateEcheance: dateFr(e.dateEmission),
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
