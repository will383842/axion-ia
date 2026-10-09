// Réseau d'apporteurs — la facture du CLIENT est annulée (ou réduite) par un AVOIR : la commission
// suit (contrat, art. 4.5 ; essai réel du 09/10/2026, où la commission restait « à verser »).
//
// « Un avoir ou un remboursement partiel diminue le prix facturé : la commission est recalculée sur
// le prix net […] et la différence fait l'objet d'une reprise […] dès que la Société constate
// l'annulation. » Passage HORAIRE (avant l'autofacturation), idempotent :
//
//   · prix net de la COMMANDE = HT de ses factures (toutes celles du même devis, ou la facture
//     seule) + HT de leurs avoirs (négatifs) ; une commande sans avoir n'est pas touchée ;
//   · commission pas encore facturée → RÉDUITE au prix net, ou ANNULÉE s'il ne reste rien
//     (`ajustement.ts` : la part du parrain suit) ;
//   · facturée, pas encore versée, prix net nul → RETENUE et neutralisée par un AVOIR d'autofacture
//     (`manquement.ts#retenir`), envoyé à l'apporteur (gabarit `apporteur-commission-avoir-client`) ;
//     prix net seulement réduit → rien tout de suite : la ligne facturée ne se modifie plus, et la
//     reprise de la différence est enregistrée d'elle-même au passage qui suit son versement ;
//   · déjà versée → REPRISE de la différence encore non reprise (`enregistrerReprise`), déduite
//     de la prochaine autofacture.
//
// Rien n'est supprimé ; chaque geste est tracé au journal par les modules réutilisés.
//
// ⚠️ Atteint par le WORKER (job horaire `reseau-facturation`, tsx hors Next) : aucun `server-only`.

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import {
  annulerCommission,
  commissionPourPrixConserve,
  partDuParrain,
  reduireCommission,
} from "./ajustement";
import { dateFr } from "./autofacture-donnees";
import { envoyer } from "./envois";
import { retenir, type Piece } from "./manquement";
import { enregistrerReprise, PREFIXE_PALIER_REPRISE } from "./resiliation";
import { signalerErreurReseau } from "./signaler";

const MODIFIABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;

export interface BilanAvoirsClients {
  reduites: number;
  annulees: number;
  retenues: number;
  reprises: number;
}

/** Le prix HT net d'une commande : ses factures plus leurs avoirs (montants négatifs). */
export function prixNetCommande(
  factures: ReadonlyArray<{ montantHtCents: number; avoirDeId: string | null }>,
): { brutCents: number; netCents: number; aDesAvoirs: boolean } {
  const brut = factures.filter((f) => !f.avoirDeId).reduce((s, f) => s + f.montantHtCents, 0);
  const avoirs = factures.filter((f) => f.avoirDeId);
  // Un avoir est toujours une diminution, quel que soit le signe sous lequel il est rangé.
  const retire = avoirs.reduce((s, f) => s + Math.abs(f.montantHtCents), 0);
  return { brutCents: brut, netCents: Math.max(0, brut - retire), aDesAvoirs: avoirs.length > 0 };
}

/** Le montant cible d'une ligne pour un prix net (part du parrain : 10 % du filleul recalculé). */
export function cibleApresAvoir(
  l: {
    activite: string;
    palier: string | null;
    prixPublicHtCents: number | null;
    montantCents: number;
  },
  netCents: number,
  filleul?: {
    activite: string;
    palier: string | null;
    prixPublicHtCents: number | null;
    montantCents: number;
  },
): number | null {
  if (netCents <= 0) return 0;
  if (filleul) {
    const f = commissionPourPrixConserve(filleul, netCents, filleul.montantCents);
    return f === null ? null : Math.min(l.montantCents, partDuParrain(f));
  }
  const c = commissionPourPrixConserve(l, netCents, l.montantCents);
  return c === null ? null : Math.min(l.montantCents, c);
}

async function prevenirRetenue(apporteurId: string, numero: string, avoir?: Piece): Promise<void> {
  try {
    const a = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { prenom: true, email: true },
    });
    const destinataire = a ? (decryptPii(a.email) ?? "") : "";
    if (!destinataire) return;
    await envoyer({
      gabarit: "apporteur-commission-avoir-client",
      destinataire,
      payload: { contactName: decryptPii(a!.prenom) ?? "" },
      entityType: "ApporteurReseau",
      entityId: apporteurId,
      jobId: `apporteur-commission-avoir-client-${numero}`,
      ...(avoir
        ? {
            attachments: [
              { filename: avoir.filename, r2Key: avoir.r2Key, contentType: "application/pdf" },
            ],
          }
        : {}),
    });
  } catch {
    // Prévenir ne fait jamais échouer le passage.
  }
}

/** Les factures (et leurs avoirs) d'une commande, à partir de la facture d'une commission. */
async function facturesDeLaCommande(factureId: string) {
  const f = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: { id: true, devisId: true },
  });
  if (!f) return null;
  const meres = f.devisId
    ? await prisma.factureFormation.findMany({
        where: { devisId: f.devisId, avoirDeId: null, statut: { not: "brouillon" } },
        select: { id: true, montantHtCents: true, avoirDeId: true },
      })
    : await prisma.factureFormation.findMany({
        where: { id: f.id },
        select: { id: true, montantHtCents: true, avoirDeId: true },
      });
  const avoirs = await prisma.factureFormation.findMany({
    where: { avoirDeId: { in: meres.map((m) => m.id) }, statut: { not: "brouillon" } },
    select: { id: true, montantHtCents: true, avoirDeId: true },
  });
  return [...meres, ...avoirs];
}

export async function reprendreApresAvoirsClients(
  maintenant: Date = new Date(),
): Promise<BilanAvoirsClients> {
  const bilan: BilanAvoirsClients = { reduites: 0, annulees: 0, retenues: 0, reprises: 0 };

  // Les factures d'origine qui portent un avoir…
  const avoirs = await prisma.factureFormation.findMany({
    where: { avoirDeId: { not: null }, statut: { not: "brouillon" } },
    select: { avoirDeId: true, devisId: true },
  });
  if (avoirs.length === 0) return bilan;
  const origines = [...new Set(avoirs.map((a) => a.avoirDeId).filter((x): x is string => !!x))];
  if (origines.length === 0) return bilan;
  const devis = [...new Set(avoirs.map((a) => a.devisId).filter((d): d is string => !!d))];
  const surLeDevis = devis.length
    ? await prisma.factureFormation.findMany({
        where: { devisId: { in: devis }, avoirDeId: null },
        select: { id: true },
      })
    : [];
  const factureIds = [...new Set([...origines, ...surLeDevis.map((f) => f.id)])];

  // … et les commissions nées de ces commandes, encore vivantes.
  const lignes = await prisma.commissionApporteur.findMany({
    where: {
      factureId: { in: factureIds },
      statut: { in: [...MODIFIABLES, "versee"] },
      montantCents: { gt: 0 },
    },
    select: {
      id: true,
      apporteurId: true,
      factureId: true,
      parrainage: true,
      statut: true,
      activite: true,
      palier: true,
      prixPublicHtCents: true,
      factureHtCents: true,
      montantCents: true,
      autofactureNumero: true,
      autofactureEmiseAt: true,
      verseeAt: true,
    },
  });
  if (lignes.length === 0) return bilan;

  const parFacture = new Map<string, typeof lignes>();
  for (const l of lignes) parFacture.set(l.factureId, [...(parFacture.get(l.factureId) ?? []), l]);

  for (const [factureId, groupe] of parFacture) {
    try {
      const factures = await facturesDeLaCommande(factureId);
      if (!factures) continue;
      const { netCents, aDesAvoirs } = prixNetCommande(factures);
      if (!aDesAvoirs) continue;
      const motif = `Art. 4.5 : facture du client annulée ou réduite par un avoir (prix net ${(netCents / 100).toFixed(2).replace(".", ",")} € HT).`;
      const filleul = groupe.find((l) => !l.parrainage) ?? null;

      for (const l of groupe) {
        const montant = l.montantCents ?? 0;

        // Pas encore facturée : le module d'ajustement réduit ou annule (la part du parrain suit).
        if (!l.autofactureNumero && (MODIFIABLES as readonly string[]).includes(l.statut)) {
          if (l.parrainage) continue; // suit la commission du filleul
          if (netCents >= l.factureHtCents) continue; // déjà au prix net (idempotence)
          const r =
            netCents <= 0
              ? await annulerCommission(l.id, motif)
              : await reduireCommission(l.id, netCents, motif);
          if (r.ok) {
            if (netCents <= 0) bilan.annulees += 1;
            else bilan.reduites += 1;
          }
          continue;
        }

        const cible = cibleApresAvoir(
          { ...l, montantCents: montant },
          netCents,
          l.parrainage && filleul
            ? { ...filleul, montantCents: filleul.montantCents ?? 0 }
            : undefined,
        );
        if (cible === null || cible >= montant) continue;

        // Facturée, pas versée, plus rien à payer : retenue + avoir d'autofacture, apporteur prévenu.
        if (l.statut === "due" && l.autofactureNumero && !l.verseeAt) {
          if (cible > 0) continue; // réduction partielle : reprise après le versement
          const r = await retenir(
            {
              id: l.id,
              apporteurId: l.apporteurId,
              statut: l.statut,
              montantCents: montant,
              autofactureNumero: l.autofactureNumero,
              autofactureEmiseAt: l.autofactureEmiseAt,
              parrainage: l.parrainage,
            },
            motif,
            maintenant,
            `annulation après l'avoir du client au ${dateFr(maintenant)} (art. 4.5)`,
          );
          if (r.ok) {
            bilan.retenues += 1;
            await prevenirRetenue(l.apporteurId, l.autofactureNumero, r.avoir);
            if (r.avertissement) signalerErreurReseau("avoir client", new Error(r.avertissement));
          }
          continue;
        }

        // Déjà versée : reprise de la différence encore non reprise.
        if (l.statut === "versee") {
          const deja = await prisma.commissionApporteur.findMany({
            where: { apporteurId: l.apporteurId, palier: `${PREFIXE_PALIER_REPRISE}${l.id}` },
            select: { montantCents: true },
          });
          const repris = deja.reduce((s, x) => s + Math.abs(x.montantCents ?? 0), 0);
          const aReprendre = montant - cible - repris;
          if (aReprendre <= 0) continue;
          const r = await enregistrerReprise({
            commissionId: l.id,
            apporteurId: l.apporteurId,
            demandeeCents: aReprendre,
            motif,
            annulationLe: maintenant,
            maintenant,
          });
          if (r.ok) bilan.reprises += 1;
        }
      }
    } catch (err) {
      // Une commande en échec n'arrête pas les autres ; le passage suivant la reprend.
      signalerErreurReseau("avoir client : commande", err);
    }
  }
  return bilan;
}
