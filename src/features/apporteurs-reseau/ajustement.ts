// Réseau d'apporteurs — RÉDUIRE ou ANNULER une commission pas encore facturée (contrat 2.3).
//
// Pour une commission « due », « à qualifier » ou « en attente de vigilance » qui n'a pas encore
// d'autofacture : le prix finalement conservé baisse (art. 4.2 bis), la commande est annulée ou la
// prestation n'a pas lieu (art. 4.2), la présentation est démentie ou frauduleuse (art. 4.5 bis).
// Une commission déjà FACTURÉE ne se modifie plus : après son versement, c'est une reprise (4.5).
//
// La réduction n'est JAMAIS tapée à la main : on saisit le prix HT net conservé, et la commission
// est RECALCULÉE par la règle du contrat (`calculerCommission` : forfait au prorata pour une
// formation, art. 4.1 bis ; pourcentage du HT net sinon). La part du PARRAIN née de la même
// facture suit, par la règle existante (`PARRAINAGE_BPS`, arrondi au plus proche, art. 4.6) :
//   · encore modifiable → réduite ou annulée avec elle ;
//   · déjà VERSÉE → reprise de la différence (conditions de l'art. 4.5) ;
//   · facturée mais pas encore versée → AVERTISSEMENT explicite (à reprendre après son versement).
//
// Rien ne disparaît : la ligne reste en base (statut « annulee » ou montant réduit) et chaque geste
// est tracé au journal d'audit (qui, quand, avant, après, motif).

import { prisma } from "@/lib/prisma";

import { grilleDeLaLigne } from "./commissions";
import {
  calculerCommissionSelonGrille,
  calculerCommission,
  PALIERS_FORMATION_LONGUE,
  commissionJourneeIaCents,
  PALIER_JOURNEE_IA,
  PRIX_REFERENCE_JOURNEE_IA_CENTS,
  euros,
  PALIER_CONFERENCE,
  MESSAGE_GRILLE_INCONNUE,
  PARRAINAGE_BPS,
  TAUX_BPS,
  type ActiviteCommission,
  type GrilleCommission,
} from "./regles";
import { enregistrerReprise, PREFIXE_PALIER_REPRISE } from "./resiliation";

const MODIFIABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;
const estModifiable = (statut: string) => (MODIFIABLES as readonly string[]).includes(statut);

/** Ce qui vient d'être ÉCRIT sur la part d'un parrain, pour le lui annoncer (relecture du 27/11). */
export interface EcritureParrain {
  type: "reduite" | "annulee" | "reprise";
  apporteurId: string;
  ligneId: string;
  avantCents: number;
  apresCents?: number;
  reprisCents?: number;
  /** `reprise` : l'identifiant de la ligne de reprise écrite (clé d'idempotence de l'e-mail). */
  repriseId?: string;
}

/** Rappel appelé après chaque écriture réussie sur une part de parrain ; ne doit jamais défaire. */
export type SurEcritureParrain = (e: EcritureParrain) => Promise<void> | void;

export type ResultatAjustement =
  { ok: true; montantCents?: number; avertissement?: string } | { ok: false; message: string };

async function tracer(
  action: "commission_apporteur.reduite" | "commission_apporteur.annulee",
  id: string,
  acteurId: string | null,
  changes: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteurId,
        action,
        targetType: "commission_apporteur",
        targetId: id,
        changes: changes as object,
      },
    });
  } catch {
    // La trace ne fait jamais échouer le geste.
  }
}

async function lire(id: string) {
  const l = await prisma.commissionApporteur.findUnique({
    where: { id },
    select: {
      id: true,
      statut: true,
      activite: true,
      palier: true,
      prixPublicHtCents: true,
      factureHtCents: true,
      montantCents: true,
      autofactureNumero: true,
      factureId: true,
      parrainage: true,
      presentationId: true,
    },
  });
  // Valeurs figées : la ligne lue peut être modifiée sous nos yeux.
  return l ? { ...l } : null;
}

const DEJA_FACTUREE =
  "Cette commission est déjà facturée : elle ne se modifie plus. Après son versement, enregistrez une reprise.";

/** Part du parrain recalculée sur le nouveau montant du filleul (art. 4.6). */
export const partDuParrain = (commissionFilleulCents: number): number =>
  Math.round((Math.max(0, commissionFilleulCents) * PARRAINAGE_BPS) / 10_000);

/** Nombre de sessions retenu à la création (formation) : prix public ÷ prix du palier. */
function quantiteDe(l: { palier: string | null; prixPublicHtCents: number | null }): number {
  // 3 jours ou plus : la quantité est le nombre de journées (référence = journées × prix du jour).
  const longue = PALIERS_FORMATION_LONGUE.find((p) => p.id === l.palier);
  if (longue)
    return l.prixPublicHtCents ? Math.round(l.prixPublicHtCents / longue.prixJourCents) : 0;
  const calc = calculerCommission({ activite: "formation", factureHtCents: 0, palier: l.palier });
  if (calc.statut !== "calculee" || !calc.prixPublicCents || !l.prixPublicHtCents) return 1;
  return Math.max(1, Math.round(l.prixPublicHtCents / calc.prixPublicCents));
}

/** La commission recalculée pour un prix HT net conservé ; `null` si la règle ne s'applique pas. */
export function commissionPourPrixConserve(
  l: {
    activite: string;
    palier: string | null;
    prixPublicHtCents: number | null;
    /** Grille du contrat signé de la ligne (`grilleDeLaLigne`) ; `null` : version inconnue → escalade. */
    grille: GrilleCommission | null;
  },
  prixHtCents: number,
  montantActuelCents?: number,
): number | null {
  // Journée IA (A1.1) : 500 € par journée au prorata du prix net conservé, arrondi au plus proche.
  // Avoir total (prix net 0) → 0 ; avoir partiel → prorata. Le nombre de journées se déduit du prix
  // de référence enregistré à la création de la ligne.
  if (l.palier === PALIER_JOURNEE_IA) {
    const q = l.prixPublicHtCents
      ? Math.max(1, Math.round(l.prixPublicHtCents / PRIX_REFERENCE_JOURNEE_IA_CENTS))
      : 1;
    return commissionJourneeIaCents(prixHtCents, q);
  }
  // Conférence : forfait fixe sans prorata (A1.4 bis), seulement plafonné au prix HT facturé.
  if (l.activite === "conference" || l.palier === PALIER_CONFERENCE)
    return montantActuelCents === undefined ? null : Math.min(montantActuelCents, prixHtCents);
  // Anciennes lignes de coaching créées à 30 % avant la décision du 25/11 : réduites à leur taux
  // d'origine sur le prix net (plafonnées au montant actuel), jamais laissées intactes.
  if (l.activite === "un_a_un")
    return montantActuelCents === undefined
      ? null
      : Math.min(
          montantActuelCents,
          Math.round((Math.max(0, prixHtCents) * TAUX_BPS.un_a_un) / 10_000),
        );
  // Version signée inconnue : jamais de montant, la ligne ne bouge pas. L'alerte critique part du
  // passage des avoirs (`avoir-client.ts`, code apporteur_grille_inconnue_avoir) ; `reduireCommission`
  // refuse avec MESSAGE_GRILLE_INCONNUE.
  if (l.grille === null) return null;
  const calc = calculerCommissionSelonGrille({
    activite: l.activite as ActiviteCommission,
    factureHtCents: prixHtCents,
    palier: l.palier,
    quantite: quantiteDe(l),
    grille: l.grille,
  });
  return calc.statut === "calculee" ? calc.montantCents : null;
}

/** Parts du parrain nées de la même facture, quel que soit leur état. */
async function partsDuParrain(factureId: string) {
  const ls = await prisma.commissionApporteur.findMany({
    where: { factureId, parrainage: true },
    select: {
      id: true,
      apporteurId: true,
      montantCents: true,
      statut: true,
      autofactureNumero: true,
    },
  });
  return ls.map((l) => ({ ...l }));
}

/** Reprise de `cents` sur une part de parrain déjà versée (art. 4.5) ; rend un avertissement ou null. */
async function reprendrePart(
  p: { id: string; apporteurId: string; montantCents: number | null },
  cents: number,
  motif: string,
): Promise<{ avertissement: string | null; repriseId?: string; reprisCents?: number }> {
  if (cents <= 0) return { avertissement: null };
  const deja = await prisma.commissionApporteur.findMany({
    where: { apporteurId: p.apporteurId, palier: `${PREFIXE_PALIER_REPRISE}${p.id}` },
    select: { montantCents: true },
  });
  const restant =
    (p.montantCents ?? 0) - deja.reduce((s, x) => s + Math.abs(x.montantCents ?? 0), 0);
  const montant = Math.min(cents, restant);
  if (montant <= 0) return { avertissement: null };
  const r = await enregistrerReprise({
    commissionId: p.id,
    apporteurId: p.apporteurId,
    demandeeCents: montant,
    motif,
  });
  return r.ok
    ? {
        avertissement: null,
        reprisCents: montant,
        ...(r.repriseId ? { repriseId: r.repriseId } : {}),
      }
    : {
        avertissement: `La part du parrain (${euros(p.montantCents ?? 0)}) est déjà versée et sa reprise a été refusée : ${r.message}`,
      };
}

/** Applique un nouveau montant de filleul aux parts du parrain ; rend les avertissements. */
async function suivreParrain(
  factureId: string,
  nouveauFilleulCents: number | null,
  motif: string,
  acteurId: string | null,
  suit: string,
  surEcriture?: SurEcritureParrain,
): Promise<string[]> {
  const annoncer = async (e: EcritureParrain) => {
    try {
      await surEcriture?.(e);
    } catch {
      // Prévenir ne défait jamais l'écriture.
    }
  };
  const avertissements: string[] = [];
  for (const p of await partsDuParrain(factureId)) {
    const avant = p.montantCents ?? 0;
    const apres = nouveauFilleulCents === null ? 0 : partDuParrain(nouveauFilleulCents);
    if (apres >= avant && nouveauFilleulCents !== null) continue;
    if (estModifiable(p.statut) && !p.autofactureNumero) {
      const r = await prisma.commissionApporteur.updateMany({
        where: { id: p.id, montantCents: p.montantCents, autofactureNumero: null },
        data: nouveauFilleulCents === null ? { statut: "annulee" } : { montantCents: apres },
      });
      if (r.count === 1) {
        await tracer(
          nouveauFilleulCents === null
            ? "commission_apporteur.annulee"
            : "commission_apporteur.reduite",
          p.id,
          acteurId,
          { avantCents: avant, apresCents: apres, motif, suitLaCommission: suit },
        );
        await annoncer({
          type: nouveauFilleulCents === null ? "annulee" : "reduite",
          apporteurId: p.apporteurId,
          ligneId: p.id,
          avantCents: avant,
          ...(nouveauFilleulCents === null ? {} : { apresCents: apres }),
        });
      } else {
        avertissements.push("La part du parrain a changé entre-temps : vérifiez-la.");
      }
    } else if (p.statut === "versee") {
      const a = await reprendrePart(p, avant - apres, motif);
      if (a.avertissement) avertissements.push(a.avertissement);
      else if (a.reprisCents !== undefined)
        await annoncer({
          type: "reprise",
          apporteurId: p.apporteurId,
          ligneId: p.id,
          avantCents: avant,
          reprisCents: a.reprisCents,
          ...(a.repriseId ? { repriseId: a.repriseId } : {}),
        });
    } else if (p.statut === "due" && p.autofactureNumero) {
      avertissements.push(
        `La part du parrain est déjà facturée (${p.autofactureNumero}) mais pas versée : elle n'est pas modifiée. Après son versement, enregistrez une reprise de ${euros(avant - apres)}.`,
      );
    }
  }
  return avertissements;
}

/** RÉDUIRE : à partir du prix HT net conservé, la commission est recalculée (jamais tapée). */
export async function reduireCommission(
  id: string,
  prixConserveHtCents: number,
  motif: string,
  acteurId: string | null = null,
  surEcritureParrain?: SurEcritureParrain,
): Promise<ResultatAjustement> {
  const m = motif.trim().slice(0, 300);
  if (!m) return { ok: false, message: "Indiquez le motif de la réduction." };
  if (!Number.isInteger(prixConserveHtCents) || prixConserveHtCents <= 0)
    return { ok: false, message: "Indiquez le prix HT net conservé (pour tout retirer, annulez)." };
  const avant = await lire(id);
  if (!avant) return { ok: false, message: "Commission introuvable." };
  if (avant.autofactureNumero) return { ok: false, message: DEJA_FACTUREE };
  if (!estModifiable(avant.statut))
    return { ok: false, message: "Seule une commission ni versée ni reprise se réduit." };
  if (avant.parrainage)
    return {
      ok: false,
      message: "Une part de parrainage suit la commission du filleul : réduisez celle-ci.",
    };
  if (avant.montantCents === null)
    return { ok: false, message: "Le montant n'est pas encore arrêté : classez d'abord la ligne." };
  if (prixConserveHtCents >= avant.factureHtCents)
    return {
      ok: false,
      message: `Le prix conservé doit être inférieur au prix facturé (${euros(avant.factureHtCents)} HT).`,
    };
  const { grille } = await grilleDeLaLigne(avant);
  if (grille === null) return { ok: false, message: MESSAGE_GRILLE_INCONNUE };
  const nouveau = commissionPourPrixConserve(
    { ...avant, grille },
    prixConserveHtCents,
    avant.montantCents,
  );
  if (nouveau === null)
    return { ok: false, message: "La règle de calcul ne s'applique pas à cette ligne." };
  if (nouveau >= avant.montantCents)
    return {
      ok: false,
      message: `À ce prix, la commission reste de ${euros(avant.montantCents)} (plafond du forfait) : rien à réduire.`,
    };
  const r = await prisma.commissionApporteur.updateMany({
    where: {
      id,
      montantCents: avant.montantCents,
      autofactureNumero: null,
      statut: { in: [...MODIFIABLES] },
    },
    data: { montantCents: nouveau, factureHtCents: prixConserveHtCents },
  });
  if (r.count !== 1)
    return { ok: false, message: "La commission a changé entre-temps : rechargez la page." };
  await tracer("commission_apporteur.reduite", id, acteurId, {
    avantCents: avant.montantCents,
    apresCents: nouveau,
    prixAvantHtCents: avant.factureHtCents,
    prixConserveHtCents,
    motif: m,
  });
  const av = await suivreParrain(avant.factureId, nouveau, m, acteurId, id, surEcritureParrain);
  return { ok: true, montantCents: nouveau, ...(av.length ? { avertissement: av.join(" ") } : {}) };
}

export async function annulerCommission(
  id: string,
  motif: string,
  acteurId: string | null = null,
  surEcritureParrain?: SurEcritureParrain,
): Promise<ResultatAjustement> {
  const m = motif.trim().slice(0, 300);
  if (!m) return { ok: false, message: "Indiquez le motif de l'annulation." };
  const avant = await lire(id);
  if (!avant) return { ok: false, message: "Commission introuvable." };
  if (avant.autofactureNumero) return { ok: false, message: DEJA_FACTUREE };
  if (!estModifiable(avant.statut))
    return { ok: false, message: "Seule une commission ni versée ni reprise s'annule." };
  const r = await prisma.commissionApporteur.updateMany({
    where: { id, autofactureNumero: null, statut: { in: [...MODIFIABLES] } },
    data: { statut: "annulee" },
  });
  if (r.count !== 1)
    return { ok: false, message: "La commission a changé entre-temps : rechargez la page." };
  await tracer("commission_apporteur.annulee", id, acteurId, {
    statutAvant: avant.statut,
    montantAvantCents: avant.montantCents,
    motif: m,
  });
  const av = avant.parrainage
    ? []
    : await suivreParrain(avant.factureId, null, m, acteurId, id, surEcritureParrain);
  return { ok: true, ...(av.length ? { avertissement: av.join(" ") } : {}) };
}
