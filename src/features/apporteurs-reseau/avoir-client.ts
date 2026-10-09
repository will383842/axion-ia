// Réseau d'apporteurs — la facture du CLIENT est annulée (ou réduite) par un AVOIR : la commission
// suit (contrat, art. 4.5 ; essai réel du 09/10/2026, où la commission restait « à verser »).
//
// « Un avoir ou un remboursement partiel diminue le prix facturé : la commission est recalculée sur
// le prix net […] et la différence fait l'objet d'une reprise […] dès que la Société constate
// l'annulation. » Passage HORAIRE (avant l'autofacturation), idempotent :
//
//   · prix net de la COMMANDE = `commandes.ts#netDeLaCommande` (SOURCE UNIQUE, RM-01 : brouillons
//     et pièces annulées écartés) ; une commande sans avoir actif n'est pas touchée ;
//   · commission du filleul pas encore facturée → RÉDUITE au prix net, ou ANNULÉE s'il ne reste
//     rien (`ajustement.ts`, qui porte SEUL la part du parrain dans ce cas) ;
//   · facturée, pas encore versée, prix net nul → RETENUE et neutralisée par un AVOIR d'autofacture
//     (`manquement.ts#retenir`, numéro pris sous verrou), envoyé à l'apporteur (gabarit
//     `apporteur-commission-avoir-client`) ; prix net seulement réduit → rien tout de suite : la
//     ligne facturée ne se modifie plus, la reprise suit d'elle-même son versement ;
//   · déjà versée → REPRISE de la différence encore non reprise (`enregistrerReprise`, sous verrou
//     par commission), datée de l'AVOIR (délai de 24 mois de l'art. 4.5).
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
import { netDeLaCommande, type FactureDeCommande } from "./commandes";
import { envoyer } from "./envois";
import { retenir, type Piece } from "./manquement";
import { enregistrerReprise, PREFIXE_PALIER_REPRISE } from "./resiliation";
import { signalerErreurReseau } from "./signaler";

const MODIFIABLES = ["a_qualifier", "due", "en_attente_vigilance"] as const;
const estModifiable = (s: string) => (MODIFIABLES as readonly string[]).includes(s);

export interface BilanAvoirsClients {
  reduites: number;
  annulees: number;
  retenues: number;
  reprises: number;
}

interface Calcul {
  activite: string;
  palier: string | null;
  prixPublicHtCents: number | null;
  montantCents: number;
}

/** Le montant cible d'une ligne pour un prix net (part du parrain : 10 % du filleul recalculé). */
export function cibleApresAvoir(l: Calcul, netCents: number, filleul?: Calcul): number | null {
  if (netCents <= 0) return 0;
  if (filleul) {
    const f = commissionPourPrixConserve(filleul, netCents, filleul.montantCents);
    return f === null ? null : Math.min(l.montantCents, partDuParrain(f));
  }
  const c = commissionPourPrixConserve(l, netCents, l.montantCents);
  return c === null ? null : Math.min(l.montantCents, c);
}

/** La date de l'annulation : celle de l'avoir actif le plus récent (émission, sinon création). */
export function dateDeLAnnulation(
  avoirs: ReadonlyArray<{ emiseAt: Date | null; createdAt?: Date | null }>,
): Date | null {
  const t = avoirs
    .map((a) => (a.emiseAt ?? a.createdAt ?? null)?.getTime())
    .filter((x): x is number => typeof x === "number");
  return t.length ? new Date(Math.max(...t)) : null;
}

async function tracer(id: string, changes: Record<string, unknown>): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action:
          (changes.apresCents as number) <= 0
            ? "commission_apporteur.annulee"
            : "commission_apporteur.reduite",
        targetType: "commission_apporteur",
        targetId: id,
        changes: changes as object,
      },
    });
  } catch {
    // La trace ne fait jamais échouer le passage.
  }
}

async function prevenirRetenue(apporteurId: string, numeroAvoir: string, avoir?: Piece) {
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
      // Une clé PAR AVOIR (relecture de a1) : deux retenues sur la même autofacture, deux e-mails.
      jobId: `apporteur-commission-avoir-client-${numeroAvoir}`,
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

type FactureLue = FactureDeCommande & { createdAt: Date | null };

const CHAMPS = {
  id: true,
  devisId: true,
  statut: true,
  avoirDeId: true,
  montantHtCents: true,
  emiseAt: true,
  createdAt: true,
} as const;

/** Les factures d'une commande et leurs avoirs, tous statuts (le tri est fait par la source unique). */
async function facturesDeLaCommande(
  factureId: string,
): Promise<{ membres: FactureLue[]; avoirs: FactureLue[] } | null> {
  const f = await prisma.factureFormation.findUnique({
    where: { id: factureId },
    select: { id: true, devisId: true },
  });
  if (!f) return null;
  const membres = (await prisma.factureFormation.findMany({
    where: f.devisId ? { devisId: f.devisId, avoirDeId: null } : { id: f.id },
    select: CHAMPS,
  })) as FactureLue[];
  const avoirs = (await prisma.factureFormation.findMany({
    where: { avoirDeId: { in: membres.map((m) => m.id) } },
    select: CHAMPS,
  })) as FactureLue[];
  return { membres, avoirs };
}

export async function reprendreApresAvoirsClients(
  maintenant: Date = new Date(),
): Promise<BilanAvoirsClients> {
  const bilan: BilanAvoirsClients = { reduites: 0, annulees: 0, retenues: 0, reprises: 0 };

  // Les factures d'origine qui portent un avoir (le statut de l'avoir est jugé plus bas).
  const avoirs = await prisma.factureFormation.findMany({
    where: { avoirDeId: { not: null } },
    select: { avoirDeId: true, devisId: true },
  });
  const origines = [...new Set(avoirs.map((a) => a.avoirDeId).filter((x): x is string => !!x))];
  if (origines.length === 0) return bilan;
  const devis = [...new Set(avoirs.map((a) => a.devisId).filter((x): x is string => !!x))];
  const surLeDevis = devis.length
    ? await prisma.factureFormation.findMany({
        where: { devisId: { in: devis }, avoirDeId: null },
        select: { id: true },
      })
    : [];
  const factureIds = [...new Set([...origines, ...surLeDevis.map((f) => f.id)])];

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
      const lu = await facturesDeLaCommande(factureId);
      if (!lu) continue;
      const { netCents, avoirs: actifs } = netDeLaCommande(lu.membres, lu.avoirs);
      if (actifs.length === 0) continue; // avoir brouillon ou annulé : sans effet
      const net = Math.max(0, netCents);
      const annulationLe = dateDeLAnnulation(actifs as FactureLue[]) ?? maintenant;
      const motif = `Art. 4.5 : facture du client annulée ou réduite par un avoir (prix net ${(net / 100).toFixed(2).replace(".", ",")} € HT).`;

      // Le FILLEUL d'abord : s'il n'est pas encore facturé, `ajustement.ts` porte la part du parrain
      // (réduction, annulation ou reprise) — elle n'est alors jamais reprise une seconde fois ici.
      const filleul = groupe.find((l) => !l.parrainage) ?? null;
      const parrainParAjustement =
        !!filleul && !filleul.autofactureNumero && estModifiable(filleul.statut);
      const ordre = [...groupe].sort((a, b) => Number(a.parrainage) - Number(b.parrainage));

      for (const l of ordre) {
        const montant = l.montantCents ?? 0;
        if (l.parrainage && parrainParAjustement) continue;

        if (!l.autofactureNumero && estModifiable(l.statut) && l.parrainage) {
          // Part de parrain pas encore facturée alors que le filleul l'est : elle suit le filleul
          // recalculé (art. 4.6), par une écriture conditionnelle tracée.
          const cible = filleul
            ? cibleApresAvoir({ ...l, montantCents: montant }, net, {
                ...filleul,
                montantCents: filleul.montantCents ?? 0,
              })
            : null;
          if (cible === null || cible >= montant) continue;
          const u = await prisma.commissionApporteur.updateMany({
            where: { id: l.id, montantCents: montant, autofactureNumero: null, statut: l.statut },
            data: cible <= 0 ? { statut: "annulee" } : { montantCents: cible },
          });
          if (u.count === 1) {
            if (cible <= 0) bilan.annulees += 1;
            else bilan.reduites += 1;
            await tracer(l.id, { avantCents: montant, apresCents: cible, motif });
          }
          continue;
        }

        if (!l.autofactureNumero && estModifiable(l.statut)) {
          if (net >= l.factureHtCents) continue; // déjà au prix net (idempotence)
          const r =
            net <= 0
              ? await annulerCommission(l.id, motif)
              : await reduireCommission(l.id, net, motif);
          if (r.ok) {
            if (net <= 0) bilan.annulees += 1;
            else bilan.reduites += 1;
          }
          continue;
        }

        const cible = cibleApresAvoir(
          { ...l, montantCents: montant },
          net,
          l.parrainage && filleul
            ? { ...filleul, montantCents: filleul.montantCents ?? 0 }
            : undefined,
        );
        if (cible === null || cible >= montant) continue;

        if (l.statut === "due" && l.autofactureNumero && !l.verseeAt) {
          if (cible > 0) continue; // réduction partielle : la reprise suivra le versement
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
            `annulation après l'avoir du client au ${dateFr(annulationLe)} (art. 4.5)`,
          );
          if (r.ok && r.numero) {
            bilan.retenues += 1;
            await prevenirRetenue(l.apporteurId, r.numero, r.avoir);
            if (r.avertissement) signalerErreurReseau("avoir client", new Error(r.avertissement));
          }
          continue;
        }

        if (l.statut === "versee") {
          const deja = await prisma.commissionApporteur.findMany({
            where: { apporteurId: l.apporteurId, palier: `${PREFIXE_PALIER_REPRISE}${l.id}` },
            select: { montantCents: true },
          });
          const repris = deja.reduce((s, x) => s + Math.abs(x.montantCents ?? 0), 0);
          const aReprendre = montant - cible - repris;
          if (aReprendre <= 0) continue;
          // `enregistrerReprise` relit sous verrou : un passage concurrent ne reprend pas deux fois.
          const r = await enregistrerReprise({
            commissionId: l.id,
            apporteurId: l.apporteurId,
            demandeeCents: aReprendre,
            motif,
            annulationLe,
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
